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
import {
  adminListWireDetails,
  adminUpsertWireDetail,
  adminDeleteWireDetail,
  type WireTransferDetailDTO,
} from "@/lib/wire.functions";

export const Route = createFileRoute("/_authenticated/admin/wire")({
  head: () => ({ meta: [{ title: "Wire Transfers — Admin" }] }),
  component: AdminWirePage,
});

function AdminWirePage() {
  const list = useServerFn(adminListWireDetails);
  const upsert = useServerFn(adminUpsertWireDetail);
  const del = useServerFn(adminDeleteWireDetail);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-wire"], queryFn: () => list() });
  const rows = q.data?.rows ?? [];
  const [editing, setEditing] = useState<Partial<WireTransferDetailDTO> | null>(null);

  const save = async () => {
    if (!editing) return;
    try {
      await upsert({
        data: {
          id: editing.id,
          country: editing.country ?? "",
          currency: editing.currency ?? "USD",
          bank_name: editing.bank_name ?? "",
          account_name: editing.account_name ?? "",
          account_number: editing.account_number ?? null,
          iban: editing.iban ?? null,
          swift: editing.swift ?? null,
          routing_number: editing.routing_number ?? null,
          bank_address: editing.bank_address ?? null,
          reference_instructions: editing.reference_instructions ?? null,
          notes: editing.notes ?? null,
          is_active: editing.is_active ?? true,
        },
      });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-wire"] });
      qc.invalidateQueries({ queryKey: ["wire-details"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Wire Transfer — bank details per country</h1>
        <Link to="/admin" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
          ← Back to admin
        </Link>
      </div>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Configured countries</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                country: "",
                currency: "USD",
                bank_name: "",
                account_name: "",
                is_active: true,
              })
            }
          >
            Add country
          </Button>
        </div>
        {q.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">No countries configured yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">Country</th>
                  <th className="px-2 py-1 text-left">Currency</th>
                  <th className="px-2 py-1 text-left">Bank</th>
                  <th className="px-2 py-1 text-left">IBAN / Acc#</th>
                  <th className="px-2 py-1 text-left">SWIFT</th>
                  <th className="px-2 py-1 text-left">Active</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="px-2 py-1.5">{w.country}</td>
                    <td className="px-2 py-1.5 font-mono">{w.currency}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5">{w.bank_name}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5 font-mono">
                      {w.iban || w.account_number || "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono">{w.swift ?? "—"}</td>
                    <td className="px-2 py-1.5">{w.is_active ? "✓" : "✗"}</td>
                    <td className="space-x-2 px-2 py-1.5 text-right">
                      <button className="text-primary hover:underline" onClick={() => setEditing(w)}>
                        Edit
                      </button>
                      <button
                        className="text-rose-400 hover:underline"
                        onClick={async () => {
                          if (!confirm("Delete this entry?")) return;
                          try {
                            await del({ data: { id: w.id } });
                            qc.invalidateQueries({ queryKey: ["admin-wire"] });
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
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
          <h3 className="text-sm font-semibold">{editing.id ? "Edit" : "New"} wire transfer details</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Country" value={editing.country} onChange={(v) => setEditing({ ...editing, country: v })} placeholder="United States" />
            <Field label="Currency" value={editing.currency} onChange={(v) => setEditing({ ...editing, currency: v })} placeholder="USD" />
            <Field label="Bank name" value={editing.bank_name} onChange={(v) => setEditing({ ...editing, bank_name: v })} />
            <Field label="Account holder name" value={editing.account_name} onChange={(v) => setEditing({ ...editing, account_name: v })} />
            <Field label="Account number" value={editing.account_number ?? ""} onChange={(v) => setEditing({ ...editing, account_number: v })} />
            <Field label="IBAN" value={editing.iban ?? ""} onChange={(v) => setEditing({ ...editing, iban: v })} />
            <Field label="SWIFT / BIC" value={editing.swift ?? ""} onChange={(v) => setEditing({ ...editing, swift: v })} />
            <Field label="Routing / ABA number" value={editing.routing_number ?? ""} onChange={(v) => setEditing({ ...editing, routing_number: v })} />
            <div className="sm:col-span-2">
              <Label className="text-xs">Bank address</Label>
              <Textarea rows={2} value={editing.bank_address ?? ""} onChange={(e) => setEditing({ ...editing, bank_address: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Reference / wire instructions (shown to user)</Label>
              <Textarea rows={3} value={editing.reference_instructions ?? ""} onChange={(e) => setEditing({ ...editing, reference_instructions: e.target.value })} placeholder="Include your account email in the wire reference field." />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Internal notes (admin only)</Label>
              <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
