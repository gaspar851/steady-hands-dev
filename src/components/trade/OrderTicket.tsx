import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Crosshair, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getBookTicker } from "@/lib/binance";
import { createTrade } from "@/lib/trades.functions";
import { usd } from "@/lib/format";
import { feeOn, notionalOf } from "@/lib/costs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


interface Props {
  targetUserId?: string;
  symbol: string;
  onSymbolChange: (s: string) => void;
  defaultLeverage?: number;
  isAdmin?: boolean;
  isGuest?: boolean;
  priceHint?: number | null;
  balance?: number;
  available?: number;
  pickMode?: "sl" | "tp" | null;
  onRequestPick?: (mode: "sl" | "tp" | null) => void;
  pickedPrice?: { mode: "sl" | "tp"; price: number | null; nonce: number } | null;
  onDraftChange?: (draft: { entry: number | null; sl: number | null; tp: number | null; direction: "long" | "short"; slUsd: number | null; tpUsd: number | null }) => void;
}

type OrderType = "market" | "limit";

export function OrderTicket({
  targetUserId,
  symbol,
  defaultLeverage = 10,
  isAdmin = false,
  isGuest = false,
  priceHint,
  balance,
  available,
  pickMode,
  onRequestPick,
  pickedPrice,
  onDraftChange,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const create = useServerFn(createTrade);
  const navigate = useNavigate();


  const [direction, setDirection] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [entryPrice, setEntryPrice] = useState("");
  const [positionSize, setPositionSize] = useState("500");
  const leverage = defaultLeverage; // fixed per user setting; no per-trade override
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [adminFee, setAdminFee] = useState("0");
  const [book, setBook] = useState<{ bid: number; ask: number } | null>(null);

  // Live ticker polling
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const bt = await getBookTicker(symbol);
        if (!alive) return;
        setBook({ bid: bt.bid, ask: bt.ask });
        if (orderType === "market") {
          setEntryPrice(String(direction === "long" ? bt.ask : bt.bid));
        } else if (!entryPrice) {
          setEntryPrice(String(direction === "long" ? bt.ask : bt.bid));
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, orderType, direction]);

  useEffect(() => {
    if (priceHint != null) {
      setOrderType("limit");
      setEntryPrice(String(priceHint));
    }
  }, [priceHint]);

  // Apply prices picked from chart
  useEffect(() => {
    if (!pickedPrice) return;
    const v = pickedPrice.price.toString();
    if (pickedPrice.mode === "sl") setStopLoss(v);
    else setTakeProfit(v);
  }, [pickedPrice?.nonce]);

  const ep = +entryPrice || 0;
  const ps = +positionSize || 0;
  const sl = stopLoss ? +stopLoss : null;
  const tp = takeProfit ? +takeProfit : null;

  // Leveraged % move vs margin. SL is shown as negative loss, TP as positive gain.
  const slPct =
    ep && sl
      ? ((sl - ep) / ep) * leverage * 100 * (direction === "long" ? 1 : -1)
      : null;
  const tpPct =
    ep && tp
      ? ((tp - ep) / ep) * leverage * 100 * (direction === "long" ? 1 : -1)
      : null;
  const slLossUsd = slPct != null && ps ? (ps * slPct) / 100 : null;
  const tpGainUsd = tpPct != null && ps ? (ps * tpPct) / 100 : null;

  const slInvalid = ep && sl ? (direction === "long" ? sl >= ep : sl <= ep) : false;
  const tpInvalid = ep && tp ? (direction === "long" ? tp <= ep : tp >= ep) : false;

  // Push current draft up so the chart can show live SL/TP/entry lines
  useEffect(() => {
    onDraftChange?.({ entry: ep || null, sl, tp, direction, slUsd: slLossUsd, tpUsd: tpGainUsd });
  }, [ep, sl, tp, direction, slLossUsd, tpGainUsd, onDraftChange]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!ep || !ps) throw new Error(t("trade.toast_entry_required"));
      if (slInvalid) throw new Error(direction === "long" ? "Stop Loss must be below entry" : "Stop Loss must be above entry");
      if (tpInvalid) throw new Error(direction === "long" ? "Take Profit must be above entry" : "Take Profit must be below entry");
      const notional = notionalOf(ps, leverage || 1);
      const autoFee = feeOn(notional);
      const fee = isAdmin && +adminFee > 0 ? +adminFee : autoFee;
      return create({
        data: {
          userId: targetUserId,
          symbol,
          direction,
          entry_time: new Date().toISOString(),
          entry_price: ep,
          position_size: ps,
          leverage: leverage || 1,
          stop_loss: sl,
          take_profit: tp,
          fees: fee,
          swaps: 0,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("trade.toast_opened"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      setStopLoss("");
      setTakeProfit("");
    },
    onError: (e: any) => toast.error(e?.message || t("trade.toast_failed")),
  });

  const isBuy = direction === "long";
  const accent = isBuy ? "primary" : "destructive";
  const baseSymbol = symbol.replace(/USDT$|USD$/, "");
  const pretty = `${baseSymbol}/USD`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isGuest) {
          toast.info("Sign up to open trades — demo workspace only.");
          navigate({ to: "/signup" });
          return;
        }
        mutation.mutate();
      }}
      className="grid gap-4 text-sm"
    >

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Trade</span>
          <span className="text-xs text-muted-foreground">{pretty}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {mutation.isPending ? "Submitting…" : `Leverage ${leverage}x`}
        </span>
      </div>

      {/* Balance / Leverage card (Notional removed) */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card/40 px-3 py-2.5">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Virtual</div>
          <div className="font-mono text-sm font-semibold text-primary">
            {balance != null ? usd(balance) : "—"}
          </div>
          {available != null && (
            <div className="font-mono text-[10px] text-muted-foreground">
              Avail: {usd(available)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Est. Fee</div>
          <div className="font-mono text-sm font-semibold">
            {usd(feeOn(notionalOf(ps, leverage || 1)) * 2)}
          </div>
          {book && (
            <div className="font-mono text-[10px] text-muted-foreground">
              {direction === "long" ? `Ask ${book.ask}` : `Bid ${book.bid}`}
            </div>
          )}
        </div>
      </div>

      {/* Step 1 — Direction */}
      <StepHeader n={1} label="Order Direction" />
      <div className="grid grid-cols-2 gap-2">
        <DirectionButton
          active={isBuy}
          tone="buy"
          onClick={() => setDirection("long")}
        >
          <TrendingUp className="h-4 w-4" /> Buy
        </DirectionButton>
        <DirectionButton
          active={!isBuy}
          tone="sell"
          onClick={() => setDirection("short")}
        >
          <TrendingDown className="h-4 w-4" /> Sell
        </DirectionButton>
      </div>

      {/* Step 2 — Order Type & Amount */}
      <StepHeader n={2} label="Order Type & Amount" />
      <div className="grid grid-cols-2 gap-2">
        <TypeButton active={orderType === "market"} onClick={() => setOrderType("market")} accent={accent}>
          Market
        </TypeButton>
        <TypeButton active={orderType === "limit"} onClick={() => setOrderType("limit")} accent={accent}>
          Limit
        </TypeButton>
      </div>

      {orderType === "limit" && (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            USD
          </span>
          <Input
            type="number"
            step="any"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="h-11 pl-12 pr-16 font-mono text-base"
            placeholder="Limit price"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase text-muted-foreground">
            Price
          </span>
        </div>
      )}

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Amount</div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">$</span>
          <Input
            type="number"
            step="any"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className="h-11 pl-7 pr-14 font-mono text-base"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase text-muted-foreground">
            USD
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Stop Loss */}
      <SLTPField
        label="Stop Loss"
        tone="destructive"
        value={stopLoss}
        onChange={setStopLoss}
        pct={slPct}
        usd={slLossUsd}
        invalid={!!slInvalid}
        invalidText={direction === "long" ? "Must be < entry" : "Must be > entry"}
        picking={pickMode === "sl"}
        onPick={
          onRequestPick
            ? () => onRequestPick(pickMode === "sl" ? null : "sl")
            : undefined
        }
      />

      {/* Take Profit */}
      <SLTPField
        label="Take Profit"
        tone="primary"
        value={takeProfit}
        onChange={setTakeProfit}
        pct={tpPct}
        usd={tpGainUsd}
        invalid={!!tpInvalid}
        invalidText={direction === "long" ? "Must be > entry" : "Must be < entry"}
        picking={pickMode === "tp"}
        onPick={
          onRequestPick
            ? () => onRequestPick(pickMode === "tp" ? null : "tp")
            : undefined
        }
      />

      {isAdmin && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Admin Fee Override (USD)</div>
          <Input
            type="number"
            step="any"
            value={adminFee}
            onChange={(e) => setAdminFee(e.target.value)}
            className="h-9 font-mono"
          />
        </div>
      )}

      {/* Order Summary */}
      <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Order Summary</div>
        <SummaryRow label="Direction" value={isBuy ? "Buy" : "Sell"} valueClass={isBuy ? "text-primary" : "text-destructive"} />
        <SummaryRow label="Type" value={orderType === "market" ? "Market" : "Limit"} />
        <SummaryRow label="Amount" value={usd(ps)} mono />
        <SummaryRow
          label="Stop Loss"
          value={sl ? usd(sl) : "—"}
          valueClass={sl ? "text-destructive" : "text-muted-foreground"}
          mono
        />
        <SummaryRow
          label="Take Profit"
          value={tp ? usd(tp) : "—"}
          valueClass={tp ? "text-primary" : "text-muted-foreground"}
          mono
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={mutation.isPending}
        className={cn(
          "h-12 w-full text-sm font-semibold",
          isBuy
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        )}
      >
        {mutation.isPending ? "Placing…" : "Submit Trade"}
      </Button>
    </form>
  );
}

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground">
        {n}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function DirectionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "buy" | "sell";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const isBuy = tone === "buy";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-semibold transition-colors",
        active
          ? isBuy
            ? "border-primary bg-primary text-primary-foreground"
            : "border-destructive bg-destructive text-destructive-foreground"
          : isBuy
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      {children}
    </button>
  );
}

function TypeButton({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: "primary" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-md border text-sm font-medium transition-colors",
        active
          ? accent === "primary"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-destructive bg-destructive text-destructive-foreground"
          : accent === "primary"
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      {children}
    </button>
  );
}

function SLTPField({
  label,
  tone,
  value,
  onChange,
  pct,
  usd: usdDelta,
  invalid,
  invalidText,
  picking,
  onPick,
}: {
  label: string;
  tone: "primary" | "destructive";
  value: string;
  onChange: (v: string) => void;
  pct: number | null;
  usd: number | null;
  invalid: boolean;
  invalidText: string;
  picking?: boolean;
  onPick?: () => void;
}) {
  const toneText = tone === "primary" ? "text-primary" : "text-destructive";
  const toneBorder = tone === "primary" ? "border-primary/30" : "border-destructive/30";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={cn("flex items-center gap-1 text-[10px] uppercase tracking-wide", toneText)}>
          <Crosshair className="h-3 w-3" /> {label}
        </span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Optional</span>
      </div>
      <div className="flex items-center gap-2">
        {onPick && (
          <button
            type="button"
            onClick={onPick}
            title="Click on chart to set price"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
              picking
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
            )}
          >
            <Crosshair className="h-4 w-4" />
          </button>
        )}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase text-muted-foreground">
            USD
          </span>
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            className={cn(
              "h-10 pl-12 font-mono",
              invalid && "border-destructive",
            )}
          />
        </div>
        <div
          className={cn(
            "min-w-[72px] rounded-md border px-2 py-1 text-center font-mono text-[11px] leading-tight",
            toneBorder,
            toneText,
          )}
        >
          <div>{pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}</div>
          {usdDelta != null && (
            <div className="text-[9px] opacity-80">
              {usdDelta >= 0 ? "+" : "-"}${Math.abs(usdDelta).toFixed(2)}
            </div>
          )}
        </div>
      </div>
      {picking && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Click anywhere on the chart to set the {label.toLowerCase()} price.
        </div>
      )}
      {invalid && (
        <div className="mt-1 text-[10px] text-destructive">{invalidText}</div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
  mono,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", mono && "font-mono", valueClass)}>{value}</span>
    </div>
  );
}
