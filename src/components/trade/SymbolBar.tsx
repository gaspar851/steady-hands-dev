import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Stats {
  last: number;
  changePct: number;
  high: number;
  low: number;
  volQuote: number;
}

export function SymbolBar({ symbol }: { symbol: string }) {
  const { t } = useTranslation();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        const j = await res.json();
        if (!alive) return;
        setS({
          last: +j.lastPrice,
          changePct: +j.priceChangePercent,
          high: +j.highPrice,
          low: +j.lowPrice,
          volQuote: +j.quoteVolume,
        });
      } catch {}
    };
    setS(null);
    tick();
    const id = window.setInterval(tick, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol]);

  const up = (s?.changePct ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{symbol.replace("USDT", "")}/USDT</div>
        <div className={cn("font-mono text-lg font-semibold leading-tight", up ? "text-primary" : "text-destructive")}>
          {s ? fmt(s.last) : "—"}
        </div>
      </div>
      <Cell label={t("trade.sb_24h_change")} value={s ? `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%` : "—"} tone={up ? "pos" : "neg"} />
      <Cell label={t("trade.sb_24h_high")} value={s ? fmt(s.high) : "—"} />
      <Cell label={t("trade.sb_24h_low")} value={s ? fmt(s.low) : "—"} />
      <Cell label={t("trade.sb_24h_vol")} value={s ? compact(s.volQuote) : "—"} />
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-xs", tone === "pos" && "text-primary", tone === "neg" && "text-destructive")}>{value}</div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
function compact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(0);
}
