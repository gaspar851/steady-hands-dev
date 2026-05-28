import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  TrendingUp,
  MoveUpRight,
  Minus,
  GripVertical,
  Square,
  Circle,
  Triangle,
  ArrowUpRight,
  Type,
  Brush,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
} from "lucide-react";

export type DrawTool =
  | "cursor"
  | "trendline"
  | "ray"
  | "hline"
  | "vline"
  | "rect"
  | "ellipse"
  | "triangle"
  | "arrow"
  | "text"
  | "brush"
  | "eraser";

interface ToolDef {
  id: DrawTool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  group: string;
}

const tools: ToolDef[] = [
  { id: "cursor", icon: MousePointer2, label: "Cursor", group: "nav" },
  { id: "trendline", icon: TrendingUp, label: "Trend line", group: "trend" },
  { id: "ray", icon: MoveUpRight, label: "Ray", group: "trend" },
  { id: "hline", icon: Minus, label: "Horizontal line", group: "trend" },
  { id: "vline", icon: GripVertical, label: "Vertical line", group: "trend" },
  { id: "rect", icon: Square, label: "Rectangle", group: "shape" },
  { id: "ellipse", icon: Circle, label: "Ellipse", group: "shape" },
  { id: "triangle", icon: Triangle, label: "Triangle", group: "shape" },
  { id: "arrow", icon: ArrowUpRight, label: "Arrow", group: "anno" },
  { id: "text", icon: Type, label: "Text", group: "anno" },
  { id: "brush", icon: Brush, label: "Brush (freehand)", group: "anno" },
  { id: "eraser", icon: Eraser, label: "Eraser", group: "edit" },
];

interface Props {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function DrawingToolbar({ tool, onTool, onClear, onUndo, onRedo, canUndo, canRedo }: Props) {
  return (
    <div className="flex flex-col items-center gap-0.5 self-start rounded-md border border-border bg-card/40 p-1 backdrop-blur-sm">
      {tools.map((t, i) => {
        const prev = tools[i - 1];
        const showSep = prev && prev.group !== t.group;
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <div key={t.id} className="contents">
            {showSep && <span className="my-0.5 h-px w-5 bg-border/60" />}
            <Button
              type="button"
              size="sm"
              variant={active ? "default" : "ghost"}
              className="h-7 w-7 p-0"
              title={t.label}
              aria-label={t.label}
              onClick={() => onTool(t.id)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
      <span className="my-0.5 h-px w-5 bg-border/60" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        title="Clear all drawings"
        aria-label="Clear all drawings"
        onClick={onClear}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
