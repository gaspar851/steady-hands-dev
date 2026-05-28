import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TradeDTO } from "@/lib/types";
import { pnl, pnlPct } from "@/lib/calc";
import { usd, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPrice } from "@/lib/binance";

const fmtDt = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

export function PositionsTable({

  trades,
  onEdit,
}: {
  trades: TradeDTO[];
  onEdit: (t: TradeDTO) => void;
}) {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const symbols = Array.from(new Set(trades.filter((t) => t.status === "open").map((t) => t.symbol)));
    if (!symbols.length) return;
    let alive = true;
    const tick = async () => {
      const results = await Promise.all(
        symbols.map((s) => getPrice(s).then((p) => [s, p] as const).catch(() => null)),
      );
      if (!alive) return;
      setPrices((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const r of results) {
          if (!r) continue;
          if (next[r[0]] !== r[1]) { next[r[0]] = r[1]; changed = true; }
        }
        return changed ? next : prev;
      });
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [trades]);

  if (trades.length === 0) {
    return <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t("trade.no_trades")}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-transparent">
      <table className="w-full text-xs">
        <thead className="bg-card/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">{t("trade.col_symbol")}</th>
            <th className="px-2 py-2 text-left">{t("trade.col_side")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_size")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_lev")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_entry")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_mark_exit")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_sl_tp")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_pnl")}</th>
            <th className="px-2 py-2 text-right">{t("trade.col_pnl_pct")}</th>
            <th className="px-2 py-2 text-left">Opened</th>
            <th className="px-2 py-2 text-left">Closed</th>
            <th className="px-2 py-2 text-right">{t("trade.col_status")}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((tr) => {
            const mark = tr.status === "open" ? prices[tr.symbol] : tr.exit_price ?? undefined;
            const p = pnl(tr, mark);
            const pp = pnlPct(tr, mark);
            const sideLabel = tr.direction === "long" ? t("trade.ot_long") : t("trade.ot_short");
            const statusLabel = tr.status === "open" ? t("trade.tab_open") : t("trade.tab_closed");
            return (
              <tr
                key={tr.id}
                onClick={() => onEdit(tr)}
                className="cursor-pointer border-t border-border hover:bg-accent/30"
              >
                <td className="px-2 py-2 font-mono">{tr.symbol}</td>
                <td className="px-2 py-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    tr.direction === "long" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
                    {sideLabel}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono">{usd(Number(tr.position_size))}</td>
                <td className="px-2 py-2 text-right font-mono">{Number(tr.leverage)}x</td>
                <td className="px-2 py-2 text-right font-mono">{Number(tr.entry_price)}</td>
                <td className="px-2 py-2 text-right font-mono">{mark ?? "—"}</td>
                <td className="px-2 py-2 text-right font-mono text-muted-foreground">
                  {tr.stop_loss ?? "—"} / {tr.take_profit ?? "—"}
                </td>
                <td className={cn("px-2 py-2 text-right font-mono", p >= 0 ? "text-primary" : "text-destructive")}>{usd(p)}</td>
                <td className={cn("px-2 py-2 text-right font-mono", pp >= 0 ? "text-primary" : "text-destructive")}>{pct(pp)}</td>
                <td className="px-2 py-2 text-left font-mono text-[11px] text-muted-foreground whitespace-nowrap">{fmtDt(tr.entry_time)}</td>
                <td className="px-2 py-2 text-left font-mono text-[11px] text-muted-foreground whitespace-nowrap">{tr.exit_time ? fmtDt(tr.exit_time) : "—"}</td>
                <td className="px-2 py-2 text-right">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase",
                    tr.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{statusLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
