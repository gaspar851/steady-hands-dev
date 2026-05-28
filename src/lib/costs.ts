// Binance-style trading cost model (spot defaults).
// Taker fee = 0.10% per fill. Round-trip ≈ 0.20% of notional.
export const TAKER_FEE_BPS = 1; // basis points = 0.01%
export const TAKER_FEE_RATE = TAKER_FEE_BPS / 10_000;

/** Notional = position_size (margin USDT) × leverage. */
export function notionalOf(positionSizeUsdt: number, leverage: number): number {
  const lev = leverage > 0 ? leverage : 1;
  return positionSizeUsdt * lev;
}

/** Fee charged per fill (entry or exit). */
export function feeOn(notional: number): number {
  return Math.max(0, notional) * TAKER_FEE_RATE;
}
