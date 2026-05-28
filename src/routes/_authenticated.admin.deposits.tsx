import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListDepositRequests,
  adminReviewDepositRequest,
  adminListPlatformWallets,
  adminUpsertPlatformWallet,
  adminDeletePlatformWallet,
  type PlatformWalletDTO,
  type DepositRequestDTO,
} from "@/lib/deposits.functions";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  head: () => ({ meta: [{ title: "Deposits — Admin" }] }),
  component: AdminDepositsPage,
});

function AdminDepositsPage() {
  const [tab, setTab] = useState<"requests" | "wallets">("requests");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Deposits</h1>
        <Link
          to="/admin"
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          ← Back to admin
        </Link>
      </div>
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "requests"} onClick={() => setTab("requests")}>
          Requests
        </TabBtn>
        <TabBtn active={tab === "wallets"} onClick={() => setTab("wallets")}>
          Platform wallets
        </TabBtn>
      </div>
      {tab === "requests" ? <RequestsTab /> : <WalletsTab />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------- Requests ----------------

function RequestsTab() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    "pending",
  );
  const list = useServerFn(adminListDepositRequests);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-deposits", status],
    queryFn: () => list({ data: { status } }),
  });
  const rows = q.data?.rows ?? [];

  return (
    <Card className="p-4">
      <div className="mb-3 flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <TabBtn key={s} active={status === s} onClick={() => setStatus(s)}>
            {s}
          </TabBtn>
        ))}
      </div>
      {q.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          No {status} requests.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RequestRow
              key={r.id}
              row={r}
              onChanged={() => qc.invalidateQueries({ queryKey: ["admin-deposits"] })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function explorerUrl(coin: string, network: string, hash: string): string {
  const n = network.toLowerCase();
  if (n === "bitcoin") return `https://mempool.space/tx/${hash}`;
  if (n === "ethereum") return `https://etherscan.io/tx/${hash}`;
  if (n === "tron") return `https://tronscan.org/#/transaction/${hash}`;
  if (n === "solana") return `https://solscan.io/tx/${hash}`;
  return `https://www.google.com/search?q=${coin}+${hash}`;
}

function RequestRow({
  row,
  onChanged,
}: {
  row: DepositRequestDTO;
  onChanged: () => void;
}) {
  const review = useServerFn(adminReviewDepositRequest);
  const [amount, setAmount] = useState(String(row.amount));
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProof = async () => {
    if (!row.proof_image_url) return;
    const { data } = await supabase.storage
      .from("deposit-proofs")
      .createSignedUrl(row.proof_image_url, 300);
    setProofUrl(data?.signedUrl ?? null);
  };

  const act = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      await review({
        data: {
          id: row.id,
          action,
          note: note.trim() || null,
          amount: action === "approve" ? Number(amount) : undefined,
        },
      });
      toast.success(`Marked ${action}d.`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-muted-foreground">
            {new Date(row.created_at).toLocaleString()}
          </span>{" "}
          · <strong>{row.user_email ?? row.user_id.slice(0, 8)}</strong>
        </div>
        <div className="font-mono">
          {row.coin} · {row.network}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div>
            <span className="text-muted-foreground">Claimed amount:</span>{" "}
            <span className="font-mono">{row.amount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tx:</span>{" "}
            <a
              className="font-mono text-primary underline-offset-2 hover:underline"
              href={explorerUrl(row.coin, row.network, row.tx_hash)}
              target="_blank"
              rel="noreferrer"
            >
              {row.tx_hash}
            </a>
          </div>
          {row.from_address ? (
            <div>
              <span className="text-muted-foreground">From:</span>{" "}
              <span className="font-mono">{row.from_address}</span>
            </div>
          ) : null}
          {row.proof_image_url ? (
            <div>
              <button
                className="text-primary underline-offset-2 hover:underline"
                onClick={loadProof}
              >
                {proofUrl ? "Reload proof" : "View proof image"}
              </button>
              {proofUrl ? (
                <div className="mt-2">
                  <img
                    src={proofUrl}
                    alt="proof"
                    className="max-h-64 rounded-md border border-border"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {row.reviewer_note ? (
            <div className="text-muted-foreground">
              Note: {row.reviewer_note}
            </div>
          ) : null}
        </div>
        {row.status === "pending" ? (
          <div className="space-y-2">
            <div>
              <Label className="text-[10px]">Amount to credit (USDT-equivalent)</Label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px]">Note (optional)</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act("approve")}
                className="flex-1"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => act("reject")}
                className="flex-1"
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">
            Reviewed {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Platform wallets ----------------

function WalletsTab() {
  const list = useServerFn(adminListPlatformWallets);
  const upsert = useServerFn(adminUpsertPlatformWallet);
  const del = useServerFn(adminDeletePlatformWallet);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-wallets"], queryFn: () => list() });
  const rows = q.data?.rows ?? [];

  const [editing, setEditing] = useState<Partial<PlatformWalletDTO> | null>(null);

  const save = async () => {
    if (!editing) return;
    try {
      await upsert({
        data: {
          id: editing.id,
          coin: editing.coin ?? "",
          network: editing.network ?? "",
          address: editing.address ?? "",
          memo: editing.memo ?? null,
          qr_image_url: editing.qr_image_url ?? null,
          is_active: editing.is_active ?? true,
          notes: editing.notes ?? null,
        },
      });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-wallets"] });
      qc.invalidateQueries({ queryKey: ["platform-wallets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Receive addresses</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                coin: "USDT",
                network: "ethereum",
                address: "",
                is_active: true,
              })
            }
          >
            Add wallet
          </Button>
        </div>
        {q.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">Coin</th>
                  <th className="px-2 py-1 text-left">Network</th>
                  <th className="px-2 py-1 text-left">Address</th>
                  <th className="px-2 py-1 text-left">Memo</th>
                  <th className="px-2 py-1 text-left">Active</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{w.coin}</td>
                    <td className="px-2 py-1.5 font-mono">{w.network}</td>
                    <td className="max-w-[18rem] truncate px-2 py-1.5 font-mono">
                      {w.address}
                    </td>
                    <td className="px-2 py-1.5 font-mono">{w.memo ?? "—"}</td>
                    <td className="px-2 py-1.5">{w.is_active ? "✓" : "✗"}</td>
                    <td className="space-x-2 px-2 py-1.5 text-right">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setEditing(w)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-400 hover:underline"
                        onClick={async () => {
                          if (!confirm("Delete this wallet?")) return;
                          try {
                            await del({ data: { id: w.id } });
                            qc.invalidateQueries({ queryKey: ["admin-wallets"] });
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Delete failed",
                            );
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing ? (
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">
            {editing.id ? "Edit wallet" : "New wallet"}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Coin</Label>
              <Input
                value={editing.coin ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, coin: e.target.value })
                }
                placeholder="USDT, BTC, ETH, SOL"
              />
            </div>
            <div>
              <Label className="text-xs">Network</Label>
              <Input
                value={editing.network ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, network: e.target.value })
                }
                placeholder="bitcoin, ethereum, tron, solana"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Input
                value={editing.address ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, address: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Memo / tag (optional)</Label>
              <Input
                value={editing.memo ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, memo: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes (shown to user, optional)</Label>
              <Textarea
                rows={2}
                value={editing.notes ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, is_active: e.target.checked })
                }
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
