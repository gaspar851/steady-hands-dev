import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBinanceStream, type DepthMessage } from "@/lib/binance-ws";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  onPriceClick?: (price: number) => void;
  rows?: number;
}

export function OrderBook({ symbol, onPriceClick, rows = 12 }: Props) {
  const { t } = useTranslation();
  const depth = useBinanceStream<DepthMessage>(symbol, "depth20@100ms");

  const { asks, bids, spread, spreadPct, mid } = useMemo(() => {
    if (!depth) return { asks: [], bids: [], spread: 0, spreadPct: 0, mid: 0 };
    const asks = depth.asks.slice(0, rows).map(([p, q]) => ({ price: +p, qty: +q }));
    const bids = depth.bids.slice(0, rows).map(([p, q]) => ({ price: +p, qty: +q }));
    const bestAsk = asks[0]?.price ?? 0;
    const bestBid = bids[0]?.price ?? 0;
    const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : bestAsk || bestBid;
    const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
    const spreadPct = mid ? (spread / mid) * 100 : 0;
    return { asks: asks.reverse(), bids, spread, spreadPct, mid };
  }, [depth, rows]);

  const maxQty = useMemo(() => {
    let m = 0;
    for (const r of asks) if (r.qty > m) m = r.qty;
    for (const r of bids) if (r.qty > m) m = r.qty;
    return m || 1;
  }, [asks, bids]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{t("trade.ob_title")}</span>
        <span className="font-mono normal-case">{symbol}</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{t("trade.ob_price")}</span>
        <span className="text-right">{t("trade.ob_size")}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <Side rows={asks} side="ask" maxQty={maxQty} onClick={onPriceClick} />
        <div className="flex items-center justify-between border-y border-border px-2 py-1 text-[11px] font-mono">
          <span className={cn(mid ? "text-foreground" : "text-muted-foreground")}>
            {mid ? mid.toFixed(precision(mid)) : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {t("trade.ob_spread")} {spread ? spread.toFixed(precision(mid)) : "—"} · {spreadPct.toFixed(3)}%
          </span>
        </div>
        <Side rows={bids} side="bid" maxQty={maxQty} onClick={onPriceClick} />
      </div>
    </div>
  );
}

function Side({
  rows, side, maxQty, onClick,
}: {
  rows: { price: number; qty: number }[];
  side: "ask" | "bid";
  maxQty: number;
  onClick?: (p: number) => void;
}) {
  return (
    <div>
      {rows.map((r, i) => {
        const w = (r.qty / maxQty) * 100;
        return (
          <button
            key={i} type="button"
            onClick={() => onClick?.(r.price)}
            className="relative grid w-full grid-cols-[1fr_1fr] gap-2 px-2 py-[2px] font-mono text-[11px] hover:bg-accent/30"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 right-0",
                side === "ask" ? "bg-destructive/10" : "bg-primary/10",
              )}
              style={{ width: `${w}%` }}
            />
            <span className={cn("relative text-left", side === "ask" ? "text-destructive" : "text-primary")}>
              {r.price.toFixed(precision(r.price))}
            </span>
            <span className="relative text-right text-foreground/80">{formatQty(r.qty)}</span>
          </button>
        );
      })}
    </div>
  );
}

function precision(n: number) {
  if (!n) return 2;
  if (n >= 1000) return 2;
  if (n >= 1) return 4;
  if (n >= 0.01) return 5;
  return 8;
}
function formatQty(q: number) {
  if (q >= 1000) return q.toFixed(0);
  if (q >= 1) return q.toFixed(3);
  return q.toFixed(5);
}
