import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, Star } from "lucide-react";

const FAV_KEY = "marketwatch.favorites";

interface Ticker {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
}

type SortKey = "symbol" | "price" | "change" | "volume";
type SortDir = "asc" | "desc";

export function MarketWatch({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (s: string) => void;
}) {
  const { t } = useTranslation();
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        const json: any[] = await res.json();
        if (!alive) return;
        const list: Ticker[] = json
          .filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT"))
          .map((t) => ({
            symbol: t.symbol,
            price: +t.lastPrice,
            changePct: +t.priceChangePercent,
            volume: +t.quoteVolume,
          }))
          .filter((t) => Number.isFinite(t.price) && t.price > 0);
        setTickers((prev) => {
          if (prev.length === list.length) {
            let same = true;
            for (let i = 0; i < list.length; i++) {
              const a = prev[i], b = list[i];
              if (a.symbol !== b.symbol || a.price !== b.price || a.changePct !== b.changePct) {
                same = false; break;
              }
            }
            if (same) return prev;
          }
          return list;
        });
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "change" || key === "volume" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    let list = tickers;
    if (q) list = list.filter((t) => t.symbol.includes(q));
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "change":
          cmp = a.changePct - b.changePct;
          break;
        case "volume":
          cmp = a.volume - b.volume;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    list = [...list].sort((a, b) => {
      const af = favorites.has(a.symbol) ? 0 : 1;
      const bf = favorites.has(b.symbol) ? 0 : 1;
      return af - bf;
    });
    return list;
  }, [tickers, query, sortKey, sortDir, favorites]);

  const activeSort = (key: SortKey) => sortKey === key;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("trade.mw_title")} {tickers.length > 0 && <span className="text-muted-foreground/70">({filtered.length})</span>}
        </h2>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("trade.search_placeholder")}
          className="h-7 pl-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto rounded-md border border-border bg-transparent">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="w-6 px-1 py-1" aria-label="Favorite" />
              <th
                className={cn(
                  "cursor-pointer px-2 py-1 text-left font-medium hover:text-foreground",
                  activeSort("symbol") && "text-foreground"
                )}
                onClick={() => toggleSort("symbol")}
              >
                {t("trade.col_symbol")} {sortArrow("symbol", sortKey, sortDir)}
              </th>
              <th
                className={cn(
                  "cursor-pointer px-2 py-1 text-right font-medium hover:text-foreground",
                  activeSort("price") && "text-foreground"
                )}
                onClick={() => toggleSort("price")}
              >
                {t("trade.mw_price")} {sortArrow("price", sortKey, sortDir)}
              </th>
              <th
                className={cn(
                  "cursor-pointer px-2 py-1 text-right font-medium hover:text-foreground",
                  activeSort("change") && "text-foreground"
                )}
                onClick={() => toggleSort("change")}
              >
                {t("trade.mw_24h")} {sortArrow("change", sortKey, sortDir)}
              </th>
              <th
                className={cn(
                  "cursor-pointer px-2 py-1 text-right font-medium hover:text-foreground",
                  activeSort("volume") && "text-foreground"
                )}
                onClick={() => toggleSort("volume")}
              >
                {t("trade.mw_vol")} {sortArrow("volume", sortKey, sortDir)}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const up = t.changePct >= 0;
              const fav = favorites.has(t.symbol);
              return (
                <tr
                  key={t.symbol}
                  onClick={() => onSelect(t.symbol)}
                  className={cn(
                    "cursor-pointer border-t border-border first:border-t-0 hover:bg-accent/30",
                    t.symbol === active && "bg-primary/10",
                  )}
                >
                  <td className="w-6 px-1 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(t.symbol); }}
                      aria-label={fav ? "Unfavorite" : "Favorite"}
                      title={fav ? "Unfavorite" : "Favorite"}
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-sm transition-colors",
                        fav
                          ? "text-yellow-400/90 hover:text-yellow-300"
                          : "text-muted-foreground/30 hover:text-muted-foreground/70",
                      )}
                    >
                      <Star className="h-3 w-3" fill={fav ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {t.symbol.replace("USDT", "")}<span className="text-muted-foreground">/USDT</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[11px]">
                    {t.price}
                  </td>
                  <td className={cn(
                    "px-2 py-1.5 text-right font-mono text-[11px]",
                    up ? "text-primary" : "text-destructive",
                  )}>
                    {up ? "+" : ""}{t.changePct.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                    {compactVol(t.volume)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-[11px] text-muted-foreground">{t("trade.loading")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sortArrow(key: SortKey, activeKey: SortKey, dir: SortDir) {
  if (key !== activeKey) return <span className="ml-1 text-muted-foreground/50">↕</span>;
  return <span className="ml-1 text-foreground">{dir === "asc" ? "↑" : "↓"}</span>;
}

function compactVol(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}
