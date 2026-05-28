import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBinanceStream, type TradeMessage } from "@/lib/binance-ws";
import { cn } from "@/lib/utils";

interface Row { id: number; price: number; qty: number; time: number; buy: boolean }

export function TradeFeed({ symbol, max = 30 }: { symbol: string; max?: number }) {
  const { t } = useTranslation();
  const msg = useBinanceStream<TradeMessage>(symbol, "trade");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { setRows([]); }, [symbol]);
  useEffect(() => {
    if (!msg || msg.e !== "trade") return;
    setRows((prev) => {
      const next: Row = {
        id: msg.t,
        price: +msg.p,
        qty: +msg.q,
        time: msg.T,
        buy: !msg.m, // m=true → buyer maker → sell aggressor
      };
      const arr = [next, ...prev];
      if (arr.length > max) arr.length = max;
      return arr;
    });
  }, [msg, max]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{t("trade.mt_title")}</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{t("trade.ob_price")}</span>
        <span className="text-right">{t("trade.ob_size")}</span>
        <span className="text-right">{t("trade.mt_time")}</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-transparent">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 py-[2px] font-mono text-[11px]">
            <span className={cn(r.buy ? "text-primary" : "text-destructive")}>{format(r.price)}</span>
            <span className="text-right text-foreground/80">{r.qty.toFixed(r.qty >= 1 ? 3 : 5)}</span>
            <span className="text-right text-muted-foreground">{timeStr(r.time)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">{t("trade.mt_waiting")}</div>
        )}
      </div>
    </div>
  );
}

function format(n: number) {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
function timeStr(t: number) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
