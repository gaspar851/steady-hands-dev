import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBalanceEvents } from "@/lib/balance.functions";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const fmtDt = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const TYPE_LABEL: Record<string, string> = {
  add: "Deposit",
  remove: "Withdrawal",
  adjust: "Adjustment",
  reset: "Reset",
  trade: "Trade P&L",
};

export function TransactionsTable({ userId }: { userId: string }) {
  const list = useServerFn(listBalanceEvents);
  const { data, isLoading } = useQuery({
    queryKey: ["balanceEvents", userId],
    queryFn: () => list({ data: { userId } }),
    refetchInterval: 30_000,
    staleTime: 5_000,
  });
  const events = data?.events ?? [];

  if (isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading…</div>;
  }
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-transparent">
      <table className="w-full text-xs">
        <thead className="bg-card/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Date</th>
            <th className="px-2 py-2 text-left">Type</th>
            <th className="px-2 py-2 text-right">Amount</th>
            <th className="px-2 py-2 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const amt = Number(e.amount);
            return (
              <tr key={e.id} className="border-t border-border">
                <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{fmtDt(e.created_at)}</td>
                <td className="px-2 py-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {TYPE_LABEL[e.type] ?? e.type}
                  </span>
                </td>
                <td className={cn("px-2 py-2 text-right font-mono", amt >= 0 ? "text-primary" : "text-destructive")}>
                  {amt >= 0 ? "+" : ""}{usd(amt)}
                </td>
                <td className="px-2 py-2 text-muted-foreground">{e.note ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
