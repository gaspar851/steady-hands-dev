import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { adjustBalance } from "@/lib/balance.functions";
import { usd } from "@/lib/format";
import { Plus, Minus, RotateCcw, Settings2, Wallet } from "lucide-react";
import { toast } from "sonner";

export function BalanceControls({ userId, balance }: { userId: string; balance: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5">
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</span>
        <span className="font-mono text-sm font-semibold">{usd(balance)}</span>
      </div>
      <Dlg userId={userId} type="add" title="Add funds" trigger={<><Plus className="mr-1 h-3.5 w-3.5" />Add</>} />
      <Dlg userId={userId} type="remove" title="Remove funds" trigger={<><Minus className="mr-1 h-3.5 w-3.5" />Remove</>} />
      <Dlg userId={userId} type="adjust" title="Set balance to…" trigger={<><Settings2 className="mr-1 h-3.5 w-3.5" />Adjust</>} />
      <Dlg userId={userId} type="reset" title="Reset to…" trigger={<><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</>} />
    </div>
  );
}

function Dlg({ userId, type, title, trigger }: { userId: string; type: "add" | "remove" | "adjust" | "reset"; title: string; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const adj = useServerFn(adjustBalance);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => adj({ data: { userId, type, amount: +amount, note: note || undefined } }),
    onSuccess: (r) => {
      toast.success(`Balance is now ${usd(r.newBalance)}`);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["adminProfile", userId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
      setOpen(false); setAmount(""); setNote("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">{trigger}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Logged in profile history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Input type="number" step="any" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !amount}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
