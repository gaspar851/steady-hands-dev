import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllProfiles, listAllOpenTrades } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { usd, pct } from "@/lib/format";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Master dashboard — Open Trader" }] }),
  component: MasterDashboard,
});

function MasterDashboard() {
  const list = useServerFn(listAllProfiles);
  const { data, isLoading } = useQuery({ queryKey: ["adminProfiles"], queryFn: () => list() });
  const listOpen = useServerFn(listAllOpenTrades);
  const { data: openData, isLoading: openLoading } = useQuery({
    queryKey: ["adminOpenTrades"],
    queryFn: () => listOpen(),
    refetchInterval: 15000,
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Master dashboard</h1>
          <p className="text-sm text-muted-foreground">All strategies. Click a profile to manage their trades and balance.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/deposits"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Deposits →
          </Link>
          <Link
            to="/admin/wire"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Wire Transfer →
          </Link>
          <Link
            to="/admin/knowledge"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Manage AI Knowledge →
          </Link>
        </div>

      </div>
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No users yet.</Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-card/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">Starting</th>
                <th className="px-3 py-2 text-right">Change</th>
                <th className="px-3 py-2 text-right">Open</th>
                <th className="px-3 py-2 text-right">Closed</th>
                <th className="px-3 py-2 text-left">Roles</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const change = r.starting_balance > 0 ? ((r.balance - r.starting_balance) / r.starting_balance) * 100 : 0;
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-3 py-2">
                      <Link to="/admin/$userId" params={{ userId: r.id }} className="font-medium text-primary hover:underline">
                        {r.full_name || r.email}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">{r.email}</div>
                      {r.archived && <span className="text-[10px] uppercase text-muted-foreground">archived</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{usd(Number(r.balance))}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{usd(Number(r.starting_balance))}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", change >= 0 ? "text-primary" : "text-destructive")}>{pct(change)}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.open_count}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.closed_count}</td>
                    <td className="px-3 py-2">
                      {r.roles.map((role) => (
                        <span key={role} className={cn("mr-1 rounded px-1.5 py-0.5 text-[10px] uppercase",
                          role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{role}</span>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link to="/admin/$userId" params={{ userId: r.id }} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Global open trades</h2>
        <span className="text-xs text-muted-foreground">
          {openLoading ? "Loading…" : `${openData?.trades.length ?? 0} open across all profiles`}
        </span>
      </div>
      {(openData?.trades.length ?? 0) === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {openLoading ? "Loading open trades…" : "No open trades anywhere."}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-card/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Side</th>
                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Lev</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">TP</th>
                <th className="px-3 py-2 text-left">Entry time</th>
              </tr>
            </thead>
            <tbody>
              {openData!.trades.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-2">
                    <Link to="/admin/$userId" params={{ userId: t.user_id }} className="font-medium text-primary hover:underline">
                      {t.profile_full_name || t.profile_email}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">{t.profile_email}</div>
                  </td>
                  <td className="px-3 py-2 font-medium">{t.symbol}</td>
                  <td className={cn("px-3 py-2 uppercase", t.direction === "long" ? "text-primary" : "text-destructive")}>{t.direction}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(t.entry_price)}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(t.position_size)}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(t.leverage)}x</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{t.stop_loss ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{t.take_profit ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(t.entry_time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

  );
}
