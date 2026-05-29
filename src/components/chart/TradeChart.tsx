import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,

  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  LineStyle,
} from "lightweight-charts";
import { getKlines, type Interval } from "@/lib/binance";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X, Crosshair } from "lucide-react";
import { useChartIndicators, type IndicatorConfig } from "./useChartIndicators";
import { IndicatorsMenu } from "./IndicatorsMenu";
import { DrawingToolbar, type DrawTool } from "./DrawingToolbar";
import { ChartDrawingLayer, type Drawing } from "./ChartDrawingLayer";
import { sma, ema, bollinger, rsi, macd, type Bar } from "@/lib/indicators";
import { cn } from "@/lib/utils";

export interface ChartOverlay {
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exitPrice?: number | null;
  direction?: "long" | "short";
  slUsd?: number | null;
  tpUsd?: number | null;
}

interface Props {
  symbol: string;
  overlay?: ChartOverlay;
  height?: number;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  pickMode?: "sl" | "tp" | null;
  onPickPrice?: (price: number) => void;
}

const intervals: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

interface ManagedSeries {
  id: string;
  series: ISeriesApi<any>[];
}

export function TradeChart({ symbol, overlay, height = 420, maximized, onToggleMaximize, pickMode, onPickPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const indSeriesRef = useRef<Map<string, ManagedSeries>>(new Map());
  const barsRef = useRef<Bar[]>([]);

  const [interval, setInterval] = useState<Interval>("1h");
  const [chartType, setChartType] = useState<"line" | "candle">(() => {
    try { return (localStorage.getItem("trade:chartType") as any) || "line"; } catch { return "line"; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<DrawTool>("cursor");
  const [drawingsBySymbol, setDrawingsBySymbol] = useState<Record<string, Drawing[]>>({});
  const [undoStack, setUndoStack] = useState<Record<string, Drawing[][]>>({});
  const [redoStack, setRedoStack] = useState<Record<string, Drawing[][]>>({});
  const drawings = drawingsBySymbol[symbol] ?? [];
  const setDrawings = (d: Drawing[]) => {
    setUndoStack((s) => ({ ...s, [symbol]: [...(s[symbol] ?? []), drawings] }));
    setRedoStack((s) => ({ ...s, [symbol]: [] }));
    setDrawingsBySymbol((s) => ({ ...s, [symbol]: d }));
  };
  const canUndo = (undoStack[symbol]?.length ?? 0) > 0;
  const canRedo = (redoStack[symbol]?.length ?? 0) > 0;
  const undo = () => {
    const stack = undoStack[symbol] ?? [];
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    setUndoStack((s) => ({ ...s, [symbol]: stack.slice(0, -1) }));
    setRedoStack((s) => ({ ...s, [symbol]: [...(s[symbol] ?? []), drawings] }));
    setDrawingsBySymbol((s) => ({ ...s, [symbol]: prev }));
  };
  const redo = () => {
    const stack = redoStack[symbol] ?? [];
    if (!stack.length) return;
    const next = stack[stack.length - 1];
    setRedoStack((s) => ({ ...s, [symbol]: stack.slice(0, -1) }));
    setUndoStack((s) => ({ ...s, [symbol]: [...(s[symbol] ?? []), drawings] }));
    setDrawingsBySymbol((s) => ({ ...s, [symbol]: next }));
  };

  const { indicators, toggle, update } = useChartIndicators();
  const active = useMemo(() => indicators.filter((i) => i.enabled), [indicators]);

  // create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#7a8294",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        panes: {
          enableResize: true,
          separatorColor: "rgba(148,163,184,0.18)",
          separatorHoverColor: "rgba(56,189,248,0.45)",
        },
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.05)" },
        horzLines: { color: "rgba(148,163,184,0.05)" },
      },
      timeScale: { borderColor: "rgba(148,163,184,0.12)", timeVisible: true },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.12)" },
      crosshair: { mode: 0 },
    });
    const priceSeries = chartType === "candle"
      ? chart.addSeries(CandlestickSeries, {
          upColor: "#22c98a",
          downColor: "#e85d6f",
          borderVisible: false,
          wickUpColor: "#22c98a",
          wickDownColor: "#e85d6f",
        })
      : chart.addSeries(LineSeries, {
          color: "#5aa9ff",
          lineWidth: 2,
          priceLineVisible: false,
        });
    chartRef.current = chart;
    candleRef.current = priceSeries as ISeriesApi<"Candlestick">;
    setReady(true);
    return () => {
      setReady(false);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      indSeriesRef.current.clear();
      linesRef.current = [];
    };
  }, [chartType]);

  // load klines
  useEffect(() => {
    let cancelled = false;
    if (!symbol) return;
    setLoading(true); setError(null);
    getKlines(symbol, interval, 500)
      .then((data) => {
        if (cancelled || !candleRef.current) return;
        barsRef.current = data as Bar[];
        const seriesData = chartType === "candle"
          ? (data as any)
          : (data as Bar[]).map((b) => ({ time: b.time, value: b.close }));
        candleRef.current.setData(seriesData);
        renderAll();
        chartRef.current?.timeScale().fitContent();
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load chart"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, chartType]);

  // re-render indicators when config changes
  useEffect(() => { renderAll(); /* eslint-disable-next-line */ }, [indicators]);

  function destroySeries(id: string) {
    const ms = indSeriesRef.current.get(id);
    if (!ms || !chartRef.current) return;
    for (const s of ms.series) {
      try { chartRef.current.removeSeries(s); } catch {}
    }
    indSeriesRef.current.delete(id);
  }

  function ensurePane(targetIdx: number) {
    const chart = chartRef.current!;
    while (chart.panes().length <= targetIdx) chart.addPane(true);
  }

  function renderAll() {
    const chart = chartRef.current;
    const bars = barsRef.current;
    if (!chart || !bars.length) return;

    // determine pane assignments: pane 0 = price; rsi/macd each their own pane
    const paneIdx = new Map<string, number>();
    let nextPane = 1;
    for (const ind of active) {
      if (ind.kind === "rsi") { paneIdx.set(ind.id, nextPane++); }
      else if (ind.kind === "macd") { paneIdx.set(ind.id, nextPane++); }
    }

    // remove stale
    const wanted = new Set(active.map((i) => i.id));
    for (const id of Array.from(indSeriesRef.current.keys())) {
      if (!wanted.has(id)) destroySeries(id);
    }

    for (const ind of active) {
      const existing = indSeriesRef.current.get(ind.id);
      const data = computeIndicatorData(ind, bars);
      if (!data) continue;

      if (ind.kind === "sma" || ind.kind === "ema") {
        const seriesArr = existing?.series ?? [chart.addSeries(LineSeries, {
          color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        }, 0)];
        seriesArr[0].applyOptions({ color: ind.color });
        seriesArr[0].setData(data.line as any);
        indSeriesRef.current.set(ind.id, { id: ind.id, series: seriesArr });
      } else if (ind.kind === "bb") {
        let seriesArr = existing?.series;
        if (!seriesArr) {
          const upper = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
          const middle = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false }, 0);
          const lower = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
          seriesArr = [upper, middle, lower];
        }
        seriesArr[0].setData(data.upper as any);
        seriesArr[1].setData(data.middle as any);
        seriesArr[2].setData(data.lower as any);
        indSeriesRef.current.set(ind.id, { id: ind.id, series: seriesArr });
      } else if (ind.kind === "rsi") {
        const idx = paneIdx.get(ind.id)!;
        ensurePane(idx);
        let seriesArr = existing?.series;
        if (!seriesArr) {
          const line = chart.addSeries(LineSeries, {
            color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          }, idx);
          line.createPriceLine({ price: 70, color: "rgba(232,93,111,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
          line.createPriceLine({ price: 30, color: "rgba(34,201,138,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
          seriesArr = [line];
        }
        seriesArr[0].setData(data.line as any);
        indSeriesRef.current.set(ind.id, { id: ind.id, series: seriesArr });
      } else if (ind.kind === "macd") {
        const idx = paneIdx.get(ind.id)!;
        ensurePane(idx);
        let seriesArr = existing?.series;
        if (!seriesArr) {
          const hist = chart.addSeries(HistogramSeries, { color: ind.color, priceLineVisible: false, lastValueVisible: false }, idx);
          const macdLine = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, idx);
          const sig = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, idx);
          seriesArr = [hist, macdLine, sig];
        }
        const histColored = (data.hist as any[]).map((p) => ({
          ...p, color: p.value >= 0 ? "rgba(34,201,138,0.7)" : "rgba(232,93,111,0.7)",
        }));
        seriesArr[0].setData(histColored as any);
        seriesArr[1].setData(data.macd as any);
        seriesArr[2].setData(data.signal as any);
        indSeriesRef.current.set(ind.id, { id: ind.id, series: seriesArr });
      }
    }
  }

  // overlay price lines for entry/SL/TP/exit
  useEffect(() => {
    if (!candleRef.current) return;
    linesRef.current.forEach((l) => candleRef.current!.removePriceLine(l));
    linesRef.current = [];
    if (!overlay) return;
    const add = (price: number | null | undefined, color: string, title: string, style: LineStyle = LineStyle.Solid) => {
      if (price == null) return;
      const line = candleRef.current!.createPriceLine({
        price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title,
      });
      linesRef.current.push(line);
    };
    add(overlay.entryPrice, "#9aa3b2", "ENTRY");
    add(overlay.stopLoss, "#e85d6f", "SL", LineStyle.Dashed);
    add(overlay.takeProfit, "#22c98a", "TP", LineStyle.Dashed);
    add(overlay.exitPrice, "#f0c674", "EXIT", LineStyle.Dotted);
  }, [overlay?.entryPrice, overlay?.stopLoss, overlay?.takeProfit, overlay?.exitPrice]);

  // Chart click → pick price for SL/TP
  useEffect(() => {
    const chart = chartRef.current;
    const series = candleRef.current;
    if (!chart || !series || !pickMode || !onPickPrice) return;
    const handler = (param: any) => {
      const y = param?.point?.y;
      if (y == null) return;
      const price = series.coordinateToPrice(y);
      if (price == null) return;
      onPickPrice(typeof price === "number" ? price : Number(price));
    };
    chart.subscribeClick(handler);
    return () => { chart.unsubscribeClick(handler); };
  }, [pickMode, onPickPrice, ready]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{symbol}</span>
          {loading && <span>· loading…</span>}
          {error && <span className="text-destructive">· {error}</span>}
        </div>
        <div className="flex items-center gap-1">
          {intervals.map((tf) => (
            <Button
              key={tf} size="sm"
              variant={tf === interval ? "default" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setInterval(tf)}
            >{tf}</Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              const next = chartType === "line" ? "candle" : "line";
              setChartType(next);
              try { localStorage.setItem("trade:chartType", next); } catch {}
            }}
            title="Toggle chart type"
          >
            {chartType === "line" ? "Line" : "Candles"}
          </Button>
          <IndicatorsMenu indicators={indicators} onToggle={toggle} onUpdate={update} />

          {onToggleMaximize && (
            <Button
              size="sm" variant="ghost" className="ml-1 h-6 w-6 p-0"
              onClick={onToggleMaximize}
              aria-label={maximized ? "Restore chart" : "Maximize chart"}
              title={maximized ? "Restore chart" : "Maximize chart"}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
      {/* legend chips */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {active.map((ind) => (
            <span
              key={ind.id}
              className="group inline-flex items-center gap-1 rounded border border-border/70 bg-card/60 pl-1.5 pr-0.5 py-0.5"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
              <span className="uppercase tracking-wide text-muted-foreground">
                {ind.kind === "macd" ? `MACD ${ind.fast},${ind.slow},${ind.signal}` :
                 ind.kind === "bb" ? `BB ${ind.period}` :
                 `${ind.kind.toUpperCase()} ${ind.period}`}
              </span>
              <button
                type="button"
                onClick={() => toggle(ind.id)}
                aria-label={`Remove ${ind.kind}`}
                title="Remove indicator"
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">drag pane edges to resize</span>
        </div>
      )}
      <div className="flex w-full flex-1 min-h-0 gap-2">
        <DrawingToolbar
          tool={tool}
          onTool={setTool}
          onClear={() => setDrawings([])}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <div className={cn("group relative flex-1 min-h-0", pickMode && "cursor-crosshair")}>
          <div ref={containerRef} style={maximized ? undefined : { height }} className={cn("h-full w-full rounded-md border bg-card/40", pickMode ? "border-foreground/60 ring-1 ring-foreground/30" : "border-border")} />
          {pickMode && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-full border border-foreground/40 bg-background/80 px-3 py-1 text-[10px] uppercase tracking-wider text-foreground backdrop-blur-sm">
              Click chart to set {pickMode === "sl" ? "Stop Loss" : "Take Profit"}
            </div>
          )}
          <ChartDrawingLayer
            chart={ready ? chartRef.current : null}
            series={ready ? candleRef.current : null}
            tool={tool}
            drawings={drawings}
            onChange={setDrawings}
            onApplied={() => setTool("cursor")}
          />
          <button
            type="button"
            onClick={() => {
              const ts = chartRef.current?.timeScale();
              if (!ts) return;
              const total = barsRef.current.length;
              if (total > 0) {
                const visible = Math.min(80, total);
                ts.setVisibleLogicalRange({ from: total - visible, to: total + 5 });
              } else {
                ts.fitContent();
              }
              ts.scrollToRealTime();
            }}
            aria-label="Reset view"
            title="Reset view"
            className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/40 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm opacity-0 transition-opacity hover:bg-background/70 hover:text-foreground group-hover:opacity-100 pointer-events-auto"
          >
            <Crosshair className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>


    </div>
  );
}

function computeIndicatorData(ind: IndicatorConfig, bars: Bar[]): any {
  switch (ind.kind) {
    case "sma": return { line: sma(bars, ind.period) };
    case "ema": return { line: ema(bars, ind.period) };
    case "bb":  return bollinger(bars, ind.period, ind.mult ?? 2);
    case "rsi": return { line: rsi(bars, ind.period) };
    case "macd": return macd(bars, ind.fast ?? 12, ind.slow ?? 26, ind.signal ?? 9);
  }
}
