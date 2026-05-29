import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Check, Upload, Wallet as WalletIcon, Bitcoin, CreditCard, Landmark, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  listActivePlatformWallets,
  listMyDepositRequests,
  createDepositRequest,
  type PlatformWalletDTO,
  type DepositRequestDTO,
} from "@/lib/deposits.functions";
import { listActiveWireDetails, type WireTransferDetailDTO } from "@/lib/wire.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Open Trader" }] }),
  component: WalletPage,
});

type Method = "crypto" | "card" | "wire" | "skrill" | "neteller";

function WalletPage() {
  const listMine = useServerFn(listMyDepositRequests);
  const mine = useQuery({
    queryKey: ["my-deposit-requests"],
    queryFn: () => listMine(),
  });
  const [method, setMethod] = useState<Method>("crypto");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-lg font-semibold">Deposit Funds</h1>
        <p className="text-sm text-muted-foreground">
          Choose a deposit method to fund your trading account.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MethodTab active={method === "crypto"} onClick={() => setMethod("crypto")} icon={<Bitcoin className="h-4 w-4" />} label="Crypto" />
        <MethodTab active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard className="h-4 w-4" />} label="Card" />
        <MethodTab active={method === "wire"} onClick={() => setMethod("wire")} icon={<Landmark className="h-4 w-4" />} label="Wire" />
        <MethodTab active={method === "skrill"} onClick={() => setMethod("skrill")} icon={<Banknote className="h-4 w-4" />} label="Skrill" />
        <MethodTab active={method === "neteller"} onClick={() => setMethod("neteller")} icon={<Banknote className="h-4 w-4" />} label="Neteller" />
      </div>

      {method === "crypto" && <CryptoTab />}
      {method === "card" && <CardTab />}
      {method === "wire" && <WireTab />}
      {method === "skrill" && <SkrillTab />}
      {method === "neteller" && <NetellerTab />}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">My deposits</h2>
        <MyDepositsTable rows={mine.data?.rows ?? []} loading={mine.isLoading} />
      </Card>
    </div>
  );
}

function MethodTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------------- Crypto ---------------- */

function CryptoTab() {
  const listWallets = useServerFn(listActivePlatformWallets);
  const qc = useQueryClient();
  const wallets = useQuery({
    queryKey: ["platform-wallets"],
    queryFn: () => listWallets(),
  });

  const [coin, setCoin] = useState<string>("");
  const [network, setNetwork] = useState<string>("");
  const [revealed, setRevealed] = useState(false);

  const rows = wallets.data?.rows ?? [];
  const coins = useMemo(() => Array.from(new Set(rows.map((r) => r.coin))).sort(), [rows]);
  const networksForCoin = useMemo(() => rows.filter((r) => r.coin === coin).map((r) => r.network), [rows, coin]);
  const selected: PlatformWalletDTO | undefined = useMemo(
    () => rows.find((r) => r.coin === coin && r.network === network),
    [rows, coin, network],
  );

  return (
    <>
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Generate my deposit address</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Coin</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={coin}
              onChange={(e) => { setCoin(e.target.value); setNetwork(""); setRevealed(false); }}
            >
              <option value="">Select coin…</option>
              {coins.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Network</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={network}
              onChange={(e) => { setNetwork(e.target.value); setRevealed(false); }}
              disabled={!coin}
            >
              <option value="">Select network…</option>
              {networksForCoin.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {!revealed ? (
          <Button className="w-full" disabled={!selected} onClick={() => setRevealed(true)}>
            <WalletIcon className="mr-2 h-4 w-4" /> Generate my wallet
          </Button>
        ) : selected ? (
          <DepositAddressCard wallet={selected} />
        ) : null}
      </Card>

      {selected && revealed ? (
        <DepositProofForm
          wallet={selected}
          onSubmitted={() => qc.invalidateQueries({ queryKey: ["my-deposit-requests"] })}
        />
      ) : null}
    </>
  );
}

function DepositAddressCard({ wallet }: { wallet: PlatformWalletDTO }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-3 rounded-md border border-border bg-card/40 p-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-md bg-white p-2">
          <QRCodeSVG value={wallet.address} size={140} />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {wallet.coin} · {wallet.network}
            </div>
            <div className="break-all font-mono text-xs">{wallet.address}</div>
          </div>
          {wallet.memo ? (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Memo / tag (required)</div>
              <div className="break-all font-mono text-xs">{wallet.memo}</div>
            </div>
          ) : null}
          <Button size="sm" variant="outline" onClick={onCopy}>
            {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy address"}
          </Button>
        </div>
      </div>
      <p className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
        Send only <strong>{wallet.coin}</strong> on the <strong>{wallet.network}</strong> network. Sending any other asset or using another network will result in permanent loss.
      </p>
      {wallet.notes ? <p className="text-xs text-muted-foreground">{wallet.notes}</p> : null}
    </div>
  );
}

function DepositProofForm({
  wallet,
  onSubmitted,
}: {
  wallet: PlatformWalletDTO;
  onSubmitted: () => void;
}) {
  const submit = useServerFn(createDepositRequest);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [fromAddr, setFromAddr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (txHash.trim().length < 4) { toast.error("Enter the transaction hash."); return; }
    if (file && file.size > 5 * 1024 * 1024) { toast.error("Proof image must be 5 MB or smaller."); return; }
    setBusy(true);
    try {
      let proofPath: string | null = null;
      if (file) {
        const { data: sess } = await supabase.auth.getUser();
        const uid = sess.user?.id;
        if (!uid) throw new Error("Not signed in");
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("deposit-proofs").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        proofPath = path;
      }
      await submit({
        data: {
          platform_wallet_id: wallet.id,
          amount: amt,
          tx_hash: txHash.trim(),
          from_address: fromAddr.trim() || null,
          proof_image_url: proofPath,
        },
      });
      toast.success("Deposit submitted. An assistant will verify shortly.");
      setAmount(""); setTxHash(""); setFromAddr(""); setFile(null);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Submit deposit proof</h2>
        <p className="text-xs text-muted-foreground">
          After you send {wallet.coin} on {wallet.network}, paste the transaction hash and (optionally) attach a screenshot.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="amount" className="text-xs">Amount ({wallet.coin})</Label>
          <Input id="amount" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tx" className="text-xs">Transaction hash</Label>
          <Input id="tx" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x… or base58…" required />
        </div>
        <div>
          <Label htmlFor="from" className="text-xs">Sender address (optional)</Label>
          <Input id="from" value={fromAddr} onChange={(e) => setFromAddr(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="proof" className="text-xs">Screenshot of confirmation (optional, ≤5 MB)</Label>
          <Input id="proof" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          {busy ? "Submitting…" : "Submit for verification"}
        </Button>
      </form>
    </Card>
  );
}

/* ---------------- Wire Transfer ---------------- */

function WireTab() {
  const list = useServerFn(listActiveWireDetails);
  const q = useQuery({ queryKey: ["wire-details"], queryFn: () => list() });
  const rows: WireTransferDetailDTO[] = q.data?.rows ?? [];

  const [country, setCountry] = useState("");
  const [amount, setAmount] = useState("");

  const countries = useMemo(() => Array.from(new Set(rows.map((r) => r.country))).sort(), [rows]);
  const selected = useMemo(() => rows.find((r) => r.country === country), [rows, country]);

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-sm font-semibold">Wire Transfer</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Country</Label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={q.isLoading}
          >
            <option value="">Select your country…</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Amount {selected ? `(${selected.currency})` : "(USD)"}</Label>
          <Input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {!q.isLoading && countries.length === 0 ? (
        <p className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Wire transfer details are not yet configured. Please contact support or try another method.
        </p>
      ) : null}

      {selected ? (
        <div className="space-y-3 rounded-md border border-border bg-card/40 p-4 text-xs">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bank details</div>
          <KV label="Bank name" value={selected.bank_name} />
          <KV label="Account holder" value={selected.account_name} mono />
          {selected.iban && <KV label="IBAN" value={selected.iban} mono />}
          {selected.account_number && <KV label="Account number" value={selected.account_number} mono />}
          {selected.swift && <KV label="SWIFT / BIC" value={selected.swift} mono />}
          {selected.routing_number && <KV label="Routing / ABA" value={selected.routing_number} mono />}
          {selected.bank_address && <KV label="Bank address" value={selected.bank_address} />}
          {selected.reference_instructions && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-primary">
              <div className="mb-1 text-[10px] uppercase tracking-wide">Reference / instructions</div>
              <div className="whitespace-pre-wrap text-xs">{selected.reference_instructions}</div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            After sending the wire, contact support with your transfer receipt. Your balance will be credited once funds arrive (typically 1-3 business days).
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("break-all text-xs", mono && "font-mono")}>{value}</div>
      </div>
      <button onClick={copy} className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] hover:bg-accent">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/* ---------------- Card / Skrill / Neteller (non-functional placeholders) ---------------- */

function CardTab() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Credit / Debit Card</h2>
        <div className="flex items-center gap-2">
          <BrandPill text="VISA" />
          <BrandPill text="Mastercard" />
          <BrandPill text="AMEX" />
        </div>
      </div>
      <CardForm />
      <p className="text-[11px] text-muted-foreground">
        Card processing is currently in onboarding. Your submission will be queued and a member of the team will contact you to complete the deposit.
      </p>
    </Card>
  );
}

function CardForm() {
  const [amount, setAmount] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); toast.info("Card processing not yet available. Please use Crypto or Wire Transfer, or contact support."); }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Amount (USD)</Label>
        <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label className="text-xs">Card number</Label>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="0000 0000 0000 0000" inputMode="numeric" />
      </div>
      <div>
        <Label className="text-xs">Cardholder name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="As on card" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Expiry</Label>
          <Input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" />
        </div>
        <div>
          <Label className="text-xs">CVC</Label>
          <Input value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" inputMode="numeric" />
        </div>
      </div>
      <Button type="submit" className="w-full">Continue</Button>
    </form>
  );
}

function SkrillTab() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Skrill</h2>
        <BrandPill text="Skrill" tone="violet" />
      </div>
      <EWalletForm provider="Skrill" />
    </Card>
  );
}

function NetellerTab() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Neteller</h2>
        <BrandPill text="Neteller" tone="green" />
      </div>
      <EWalletForm provider="Neteller" />
    </Card>
  );
}

function EWalletForm({ provider }: { provider: string }) {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); toast.info(`${provider} integration not yet available. Please use Crypto or Wire Transfer.`); }}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs">Amount (USD)</Label>
        <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label className="text-xs">{provider} account email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <Button type="submit" className="w-full">Continue to {provider}</Button>
      <p className="text-[11px] text-muted-foreground">
        {provider} processing is currently in onboarding. Please use Crypto or Wire Transfer for instant deposits.
      </p>
    </form>
  );
}

function BrandPill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "violet" | "green" }) {
  const cls =
    tone === "violet"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
      : tone === "green"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-border bg-card text-foreground";
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", cls)}>
      {text}
    </span>
  );
}

/* ---------------- My deposits table ---------------- */

function MyDepositsTable({
  rows,
  loading,
}: {
  rows: DepositRequestDTO[];
  loading: boolean;
}) {
  if (loading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  if (!rows.length) return <div className="text-xs text-muted-foreground">No deposits yet.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-left">Date</th>
            <th className="px-2 py-1 text-left">Asset</th>
            <th className="px-2 py-1 text-right">Amount</th>
            <th className="px-2 py-1 text-left">Tx</th>
            <th className="px-2 py-1 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-2 py-1.5">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-2 py-1.5">{r.coin} · {r.network}</td>
              <td className="px-2 py-1.5 text-right font-mono">{r.amount}</td>
              <td className="px-2 py-1.5"><span className="font-mono">{r.tx_hash.slice(0, 10)}…</span></td>
              <td className="px-2 py-1.5">
                <StatusPill status={r.status} />
                {r.reviewer_note ? <div className="mt-0.5 text-[10px] text-muted-foreground">{r.reviewer_note}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: DepositRequestDTO["status"] }) {
  const cls =
    status === "approved" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "rejected" ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
