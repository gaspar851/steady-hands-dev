import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SymbolPicker } from "@/components/trade/SymbolPicker";
import { getBookTicker } from "@/lib/binance";
import { createTrade } from "@/lib/trades.functions";
import { usd } from "@/lib/format";
import { feeOn, notionalOf, TAKER_FEE_BPS } from "@/lib/costs";
import { toast } from "sonner";


interface Props {
  targetUserId?: string;
  symbol: string;
  onSymbolChange: (s: string) => void;
  defaultLeverage?: number;
  isAdmin?: boolean;
  priceHint?: number | null;
}

export function OrderTicket({ targetUserId, symbol, onSymbolChange, defaultLeverage = 10, isAdmin = false, priceHint }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const create = useServerFn(createTrade);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [positionSize, setPositionSize] = useState("1000");
  const [leverage, setLeverage] = useState(defaultLeverage.toString());
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [fees, setFees] = useState("0");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [book, setBook] = useState<{ bid: number; ask: number; spread: number; spreadPct: number } | null>(null);

  useEffect(() => {
    if (entryPrice) return;
    fillMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (priceHint != null) setEntryPrice(String(priceHint));
  }, [priceHint]);

  // Live spread refresh every 3s
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const bt = await getBookTicker(symbol);
        if (alive) setBook(bt);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol]);

  const fillMarket = async () => {
    setLoadingPrice(true);
    try {
      const bt = await getBookTicker(symbol);
      setBook(bt);
      // Long buys at the ask, short sells at the bid (taker, Binance-style)
      const px = direction === "long" ? bt.ask : bt.bid;
      setEntryPrice(px.toString());
    }
    catch { toast.error(t("trade.toast_price_failed")); }
    finally { setLoadingPrice(false); }
  };


  const mutation = useMutation({
    mutationFn: async () => {
      const ep = +entryPrice;
      const ps = +positionSize;
      if (!ep || !ps) throw new Error(t("trade.toast_entry_required"));
      const sl = stopLoss ? +stopLoss : null;
      const tp = takeProfit ? +takeProfit : null;
      if (direction === "long") {
        if (sl != null && sl >= ep) throw new Error("Stop Loss must be below entry for long");
        if (tp != null && tp <= ep) throw new Error("Take Profit must be above entry for long");
      } else {
        if (sl != null && sl <= ep) throw new Error("Stop Loss must be above entry for short");
        if (tp != null && tp >= ep) throw new Error("Take Profit must be below entry for short");
      }
      // Entry fee = taker fee on notional. Admin override (if set) takes priority.
      const notional = notionalOf(ps, +leverage || 1);
      const autoEntryFee = feeOn(notional);
      const adminFee = +fees;
      const entryFee = isAdmin && adminFee > 0 ? adminFee : autoEntryFee;
      return create({
        data: {
          userId: targetUserId,
          symbol,
          direction,
          entry_time: new Date().toISOString(),
          entry_price: ep,
          position_size: ps,
          leverage: +leverage || 1,
          stop_loss: sl,
          take_profit: tp,
          fees: entryFee,
          swaps: 0,
        },
      });

    },
    onSuccess: () => {
      toast.success(t("trade.toast_opened"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      setEntryPrice(""); fillMarket();
    },
    onError: (e: any) => toast.error(e?.message || t("trade.toast_failed")),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="grid gap-3">
      <div>
        <Label className="text-xs">{t("trade.ot_symbol")}</Label>
        <SymbolPicker value={symbol} onChange={onSymbolChange} />
      </div>
      <Tabs value={direction} onValueChange={(v) => { setDirection(v as any); if (book) setEntryPrice(String(v === "long" ? book.ask : book.bid)); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="long" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">{t("trade.ot_long")}</TabsTrigger>
          <TabsTrigger value="short" className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive">{t("trade.ot_short")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Field label={t("trade.ot_entry_price")}>
        <div className="flex gap-1">
          <Input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className="font-mono" />
          <Button type="button" size="sm" variant="outline" onClick={fillMarket} disabled={loadingPrice}>
            {loadingPrice ? "…" : t("trade.ot_mkt")}
          </Button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("trade.ot_size_usdt")}><Input type="number" step="any" value={positionSize} onChange={(e) => setPositionSize(e.target.value)} className="font-mono" /></Field>
        <Field label={t("trade.ot_leverage")}><Input type="number" step="any" value={leverage} onChange={(e) => setLeverage(e.target.value)} className="font-mono" /></Field>
      </div>

      {/* Spread + fee preview (Binance-style taker model) */}
      {(() => {
        const ps = +positionSize;
        const lev = +leverage || 1;
        const notional = notionalOf(ps, lev);
        const roundTripFee = feeOn(notional) * 2;
        return (
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[10px]">
            <div>
              <div className="uppercase tracking-wide text-muted-foreground">Bid / Ask</div>
              <div className="font-mono">{book ? `${book.bid} / ${book.ask}` : "…"}</div>
            </div>
            <div>
              <div className="uppercase tracking-wide text-muted-foreground">Spread</div>
              <div className="font-mono">{book ? `${book.spread.toPrecision(4)} (${book.spreadPct.toFixed(3)}%)` : "…"}</div>
            </div>
            <div>
              <div className="uppercase tracking-wide text-muted-foreground">Fee (round-trip)</div>
              <div className="font-mono">{usd(roundTripFee)} <span className="text-muted-foreground">@ {TAKER_FEE_BPS}bps</span></div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const ep = +entryPrice;

        const ps = +positionSize;
        const lev = +leverage || 1;
        const sl = +stopLoss;
        const tp = +takeProfit;
        const qty = ep > 0 ? (ps * lev) / ep : 0;
        const sign = direction === "long" ? 1 : -1;
        const slPnl = ep && sl && qty ? (sl - ep) * qty * sign : null;
        const tpPnl = ep && tp && qty ? (tp - ep) * qty * sign : null;
        const slInvalid = ep && sl ? (direction === "long" ? sl >= ep : sl <= ep) : false;
        const tpInvalid = ep && tp ? (direction === "long" ? tp <= ep : tp >= ep) : false;
        return (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("trade.ot_stop_loss")}>
              <Input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className={`font-mono ${slInvalid ? "border-destructive" : ""}`} />
              {slInvalid ? (
                <span className="text-[10px] text-destructive">{direction === "long" ? "Must be < entry" : "Must be > entry"}</span>
              ) : slPnl != null && (
                <span className={`text-[10px] font-mono ${slPnl >= 0 ? "text-primary" : "text-destructive"}`}>≈ {usd(slPnl)}</span>
              )}
            </Field>
            <Field label={t("trade.ot_take_profit")}>
              <Input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className={`font-mono ${tpInvalid ? "border-destructive" : ""}`} />
              {tpInvalid ? (
                <span className="text-[10px] text-destructive">{direction === "long" ? "Must be > entry" : "Must be < entry"}</span>
              ) : tpPnl != null && (
                <span className={`text-[10px] font-mono ${tpPnl >= 0 ? "text-primary" : "text-destructive"}`}>≈ {usd(tpPnl)}</span>
              )}
            </Field>
          </div>
        );
      })()}

      {isAdmin && (
        <Field label={t("trade.ot_fees_usdt")}><Input type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} className="font-mono" /></Field>
      )}
      <Button type="submit" disabled={mutation.isPending} className={direction === "long" ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"}>
        {mutation.isPending ? t("trade.ot_placing") : `${direction === "long" ? t("trade.ot_buy_long") : t("trade.ot_sell_short")}`}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
