import type { TradeDTO } from "./types";

export function pnl(trade: TradeDTO, markPrice?: number): number {
  const exit = trade.status === "closed" ? trade.exit_price ?? undefined : markPrice;
  if (exit == null || !trade.entry_price || !trade.position_size) return 0;
  const lev = trade.leverage > 0 ? trade.leverage : 1;
  const qty = (trade.position_size * lev) / trade.entry_price;
  const gross = trade.direction === "long"
    ? (exit - trade.entry_price) * qty
    : (trade.entry_price - exit) * qty;
  return gross - (trade.fees || 0) - (trade.swaps || 0);
}

export function marginUsed(trade: TradeDTO): number {
  return trade.position_size || 0;
}

export function pnlPct(trade: TradeDTO, markPrice?: number): number {
  const m = marginUsed(trade);
  if (!m) return 0;
  return (pnl(trade, markPrice) / m) * 100;
}

export function riskReward(trade: TradeDTO): number | null {
  if (!trade.stop_loss || !trade.take_profit || !trade.entry_price) return null;
  const risk = Math.abs(trade.entry_price - trade.stop_loss);
  const reward = Math.abs(trade.take_profit - trade.entry_price);
  if (!risk) return null;
  return reward / risk;
}
