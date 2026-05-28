import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { DrawTool } from "./DrawingToolbar";

export interface DrawPoint {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  tool: Exclude<DrawTool, "cursor" | "eraser">;
  points: DrawPoint[];
  color: string;
  text?: string;
}

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<any> | null;
  tool: DrawTool;
  drawings: Drawing[];
  onChange: (d: Drawing[]) => void;
  onApplied?: () => void;
}

const COLOR = "#38bdf8";

function pointsNeeded(t: DrawTool): number {
  if (t === "hline" || t === "vline" || t === "text") return 1;
  if (t === "triangle") return 3;
  return 2;
}

export function ChartDrawingLayer({ chart, series, tool, drawings, onChange, onApplied }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; dp: DrawPoint; value: string } | null>(null);
  const brushingRef = useRef(false);

  // Resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      setTick((t) => t + 1);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // Re-render on pan/zoom
  useEffect(() => {
    if (!chart) return;
    const ts = chart.timeScale();
    const h = () => setTick((t) => t + 1);
    ts.subscribeVisibleLogicalRangeChange(h);
    return () => ts.unsubscribeVisibleLogicalRangeChange(h);
  }, [chart]);

  // Cancel draft on tool change or Esc
  useEffect(() => setDraft(null), [tool]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toPx(p: DrawPoint): { x: number; y: number } | null {
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(p.time as Time);
    const y = series.priceToCoordinate(p.price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  function toData(px: { x: number; y: number }): DrawPoint | null {
    if (!chart || !series) return null;
    const t = chart.timeScale().coordinateToTime(px.x);
    const price = series.coordinateToPrice(px.y);
    if (t == null || price == null) return null;
    return { time: Number(t), price: Number(price) };
  }

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitTest(p: { x: number; y: number }): string | null {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const pts = d.points.map(toPx).filter(Boolean) as { x: number; y: number }[];
      if (pts.length === 0) continue;
      if (d.tool === "hline") {
        if (Math.abs(p.y - pts[0].y) < 6) return d.id;
      } else if (d.tool === "vline") {
        if (Math.abs(p.x - pts[0].x) < 6) return d.id;
      } else if (d.tool === "text") {
        if (Math.abs(p.x - pts[0].x) < 60 && Math.abs(p.y - pts[0].y) < 14) return d.id;
      } else if (pts.length >= 2) {
        const x1 = Math.min(pts[0].x, pts[1].x);
        const x2 = Math.max(pts[0].x, pts[1].x);
        const y1 = Math.min(pts[0].y, pts[1].y);
        const y2 = Math.max(pts[0].y, pts[1].y);
        if (p.x >= x1 - 6 && p.x <= x2 + 6 && p.y >= y1 - 6 && p.y <= y2 + 6) return d.id;
      }
    }
    return null;
  }

  function commit(d: Drawing) {
    onChange([...drawings, d]);
    setDraft(null);
    onApplied?.();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "cursor") return;
    e.preventDefault();
    const p = pos(e);

    if (tool === "eraser") {
      const hit = hitTest(p);
      if (hit) onChange(drawings.filter((d) => d.id !== hit));
      onApplied?.();
      return;
    }

    const dp = toData(p);
    if (!dp) return;

    if (tool === "text") {
      setTextInput({ x: p.x, y: p.y, dp, value: "" });
      return;
    }

    if (tool === "brush") {
      brushingRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDraft({ id: crypto.randomUUID(), tool: "brush", points: [dp], color: COLOR });
      return;
    }

    const need = pointsNeeded(tool);
    if (!draft) {
      setDraft({
        id: crypto.randomUUID(),
        tool: tool as Drawing["tool"],
        points: [dp],
        color: COLOR,
      });
    } else {
      const next = { ...draft, points: [...draft.points, dp] };
      if (next.points.length >= need) {
        commit(next);
      } else {
        setDraft(next);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (tool === "cursor") return;
    const p = pos(e);
    setCursor(p);
    if (tool === "brush" && brushingRef.current && draft) {
      const dp = toData(p);
      if (!dp) return;
      const last = draft.points[draft.points.length - 1];
      if (last) {
        const dx = Math.abs((toPx(last)?.x ?? 0) - p.x);
        const dy = Math.abs((toPx(last)?.y ?? 0) - p.y);
        if (dx < 2 && dy < 2) return; // skip noise
      }
      setDraft({ ...draft, points: [...draft.points, dp] });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (tool === "brush" && brushingRef.current && draft) {
      brushingRef.current = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      if (draft.points.length > 1) commit(draft);
      else setDraft(null);
    }
  }

  // Build preview while drafting (skip for brush — draft is live)
  let preview: Drawing | null = null;
  if (draft && cursor && draft.tool !== "brush") {
    const dp = toData(cursor);
    if (dp) preview = { ...draft, points: [...draft.points, dp] };
  }

  const allShapes = [...drawings, ...(draft?.tool === "brush" ? [draft] : []), ...(preview ? [preview] : [])];
  const interactive = tool !== "cursor";

  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => {
        if (draft) {
          e.preventDefault();
          setDraft(null);
        }
      }}
      className="absolute inset-0"
      style={{
        pointerEvents: interactive ? "auto" : "none",
        cursor: tool === "eraser" ? "crosshair" : interactive ? "crosshair" : "default",
        zIndex: 10,
      }}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0 overflow-visible">
        {allShapes.map((d) => renderShape(d, size, toPx))}
      </svg>
      {textInput && (
        <input
          autoFocus
          type="text"
          value={textInput.value}
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              const v = textInput.value.trim();
              if (v) commit({ id: crypto.randomUUID(), tool: "text", points: [textInput.dp], color: COLOR, text: v });
              setTextInput(null);
            } else if (e.key === "Escape") {
              setTextInput(null);
            }
          }}
          onBlur={() => {
            const v = textInput.value.trim();
            if (v) commit({ id: crypto.randomUUID(), tool: "text", points: [textInput.dp], color: COLOR, text: v });
            setTextInput(null);
          }}
          placeholder="Text…"
          className="absolute rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          style={{ left: textInput.x, top: textInput.y - 24, zIndex: 20 }}
        />
      )}
    </div>
  );
}

function renderShape(
  d: Drawing,
  size: { w: number; h: number },
  toPx: (p: DrawPoint) => { x: number; y: number } | null,
) {
  const ptsRaw = d.points.map(toPx);
  if (ptsRaw.some((q) => !q)) return null;
  const p = ptsRaw as { x: number; y: number }[];
  const stroke = d.color;
  const fill = `${stroke}22`;
  const sw = 1.5;

  switch (d.tool) {
    case "hline":
      return (
        <line
          key={d.id}
          x1={0}
          x2={size.w}
          y1={p[0].y}
          y2={p[0].y}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "vline":
      return (
        <line
          key={d.id}
          x1={p[0].x}
          x2={p[0].x}
          y1={0}
          y2={size.h}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "trendline":
      return (
        <line
          key={d.id}
          x1={p[0].x}
          x2={p[1].x}
          y1={p[0].y}
          y2={p[1].y}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "ray": {
      const dx = p[1].x - p[0].x;
      const dy = p[1].y - p[0].y;
      const tx = dx === 0 ? Infinity : (size.w - p[0].x) / dx;
      const ty =
        dy === 0 ? Infinity : ((dy > 0 ? size.h : 0) - p[0].y) / dy;
      const tEnd = Math.max(1, Math.min(Math.abs(tx), Math.abs(ty)) || 1);
      const ex = p[0].x + dx * tEnd;
      const ey = p[0].y + dy * tEnd;
      return (
        <line
          key={d.id}
          x1={p[0].x}
          x2={ex}
          y1={p[0].y}
          y2={ey}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "arrow": {
      const angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      const headLen = 10;
      const a1x = p[1].x - headLen * Math.cos(angle - Math.PI / 6);
      const a1y = p[1].y - headLen * Math.sin(angle - Math.PI / 6);
      const a2x = p[1].x - headLen * Math.cos(angle + Math.PI / 6);
      const a2y = p[1].y - headLen * Math.sin(angle + Math.PI / 6);
      return (
        <g key={d.id}>
          <line
            x1={p[0].x}
            x2={p[1].x}
            y1={p[0].y}
            y2={p[1].y}
            stroke={stroke}
            strokeWidth={sw}
          />
          <line x1={p[1].x} x2={a1x} y1={p[1].y} y2={a1y} stroke={stroke} strokeWidth={sw} />
          <line x1={p[1].x} x2={a2x} y1={p[1].y} y2={a2y} stroke={stroke} strokeWidth={sw} />
        </g>
      );
    }
    case "rect": {
      const x = Math.min(p[0].x, p[1].x);
      const y = Math.min(p[0].y, p[1].y);
      const w = Math.abs(p[1].x - p[0].x);
      const h = Math.abs(p[1].y - p[0].y);
      return (
        <rect
          key={d.id}
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={stroke}
          strokeWidth={sw}
          fill={fill}
        />
      );
    }
    case "ellipse": {
      const cx = (p[0].x + p[1].x) / 2;
      const cy = (p[0].y + p[1].y) / 2;
      const rx = Math.abs(p[1].x - p[0].x) / 2;
      const ry = Math.abs(p[1].y - p[0].y) / 2;
      return (
        <ellipse
          key={d.id}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={stroke}
          strokeWidth={sw}
          fill={fill}
        />
      );
    }
    case "triangle": {
      if (p.length < 3) {
        return (
          <polyline
            key={d.id}
            points={p.map((q) => `${q.x},${q.y}`).join(" ")}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        );
      }
      return (
        <polygon
          key={d.id}
          points={p.map((q) => `${q.x},${q.y}`).join(" ")}
          stroke={stroke}
          strokeWidth={sw}
          fill={fill}
        />
      );
    }
    case "text":
      return (
        <text
          key={d.id}
          x={p[0].x + 4}
          y={p[0].y - 4}
          fill={stroke}
          fontSize={12}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {d.text}
        </text>
      );
    case "brush":
      return (
        <polyline
          key={d.id}
          points={p.map((q) => `${q.x},${q.y}`).join(" ")}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
  }
  return null;
}
