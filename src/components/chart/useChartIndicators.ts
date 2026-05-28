import { useEffect, useState } from "react";

// Indicator configuration model + persistence. Each entry is one indicator
// instance; users can toggle, add, remove. Stored per-browser (not per-user).

export type IndicatorKind = "sma" | "ema" | "bb" | "rsi" | "macd";

export interface IndicatorConfig {
  id: string;
  kind: IndicatorKind;
  enabled: boolean;
  period: number;     // SMA/EMA/BB/RSI period; for MACD use `fast`
  fast?: number;      // MACD only
  slow?: number;      // MACD only
  signal?: number;    // MACD only
  mult?: number;      // BB only
  color: string;
}

const STORAGE_KEY = "trade:indicators:v1";

export const PANE_INDICATORS: IndicatorKind[] = ["rsi", "macd"];

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: "sma-9",  kind: "sma", enabled: true,  period: 9,  color: "#f0c674" },
  { id: "sma-20", kind: "sma", enabled: true,  period: 20, color: "#5aa9ff" },
  { id: "sma-50", kind: "sma", enabled: false, period: 50, color: "#c084fc" },
  { id: "sma-200",kind: "sma", enabled: false, period: 200,color: "#f97316" },
  { id: "ema-9",  kind: "ema", enabled: false, period: 9,  color: "#facc15" },
  { id: "ema-20", kind: "ema", enabled: false, period: 20, color: "#38bdf8" },
  { id: "ema-50", kind: "ema", enabled: false, period: 50, color: "#a78bfa" },
  { id: "ema-200",kind: "ema", enabled: false, period: 200,color: "#fb923c" },
  { id: "bb",     kind: "bb",  enabled: false, period: 20, mult: 2, color: "#94a3b8" },
  { id: "rsi",    kind: "rsi", enabled: false, period: 14, color: "#e879f9" },
  { id: "macd",   kind: "macd",enabled: false, period: 12, fast: 12, slow: 26, signal: 9, color: "#22d3ee" },
];

export function useChartIndicators() {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: IndicatorConfig[] = JSON.parse(raw);
      // merge with defaults so newly added kinds appear
      const map = new Map(parsed.map((p) => [p.id, p]));
      setIndicators(DEFAULT_INDICATORS.map((d) => ({ ...d, ...(map.get(d.id) || {}) })));
    } catch {}
  }, []);

  const persist = (next: IndicatorConfig[]) => {
    setIndicators(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const toggle = (id: string) =>
    persist(indicators.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));

  const update = (id: string, patch: Partial<IndicatorConfig>) =>
    persist(indicators.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return { indicators, toggle, update };
}
