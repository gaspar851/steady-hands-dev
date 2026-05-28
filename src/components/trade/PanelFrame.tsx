import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Minus, Square, X, Maximize2 } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  className?: string;
  bodyClassName?: string;
  /** edges that should expose a resize grip */
  resizable?: { left?: (dx: number) => void; right?: (dx: number) => void; top?: (dy: number) => void; bottom?: (dy: number) => void };
}

export function PanelFrame({
  title,
  children,
  onClose,
  minimized,
  onToggleMinimize,
  maximized,
  onToggleMaximize,
  className,
  bodyClassName,
  resizable,
}: Props) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden border border-border/60 bg-background/40 backdrop-blur-sm",
        maximized && "fixed inset-2 z-50 rounded-md shadow-2xl",
        className,
      )}
    >
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/40 px-2">
        <div className="select-none truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <div className="flex items-center gap-0.5">
          {onToggleMinimize && (
            <HeaderBtn title={minimized ? "Restore" : "Minimize"} onClick={onToggleMinimize}>
              <Minus className="h-3 w-3" />
            </HeaderBtn>
          )}
          {onToggleMaximize && (
            <HeaderBtn title={maximized ? "Restore" : "Maximize"} onClick={onToggleMaximize}>
              {maximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </HeaderBtn>
          )}
          {onClose && (
            <HeaderBtn title="Close" onClick={onClose} danger>
              <X className="h-3 w-3" />
            </HeaderBtn>
          )}
        </div>
      </div>
      {!minimized && (
        <div className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", bodyClassName)}>{children}</div>
      )}
      {resizable?.left && !maximized && !minimized && (
        <EdgeGrip orientation="vertical" side="left" onDrag={resizable.left} />
      )}
      {resizable?.right && !maximized && !minimized && (
        <EdgeGrip orientation="vertical" side="right" onDrag={resizable.right} />
      )}
      {resizable?.top && !maximized && !minimized && (
        <EdgeGrip orientation="horizontal" side="top" onDrag={resizable.top} />
      )}
      {resizable?.bottom && !maximized && !minimized && (
        <EdgeGrip orientation="horizontal" side="bottom" onDrag={resizable.bottom} />
      )}
    </div>
  );
}

function HeaderBtn({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent/40 hover:text-foreground",
        danger && "hover:bg-destructive/20 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function EdgeGrip({
  orientation,
  side,
  onDrag,
}: {
  orientation: "vertical" | "horizontal";
  side: "left" | "right" | "top" | "bottom";
  onDrag: (delta: number) => void;
}) {
  const last = useRef(0);
  
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    last.current = orientation === "vertical" ? e.clientX : e.clientY;
    const move = (ev: PointerEvent) => {
      const cur = orientation === "vertical" ? ev.clientX : ev.clientY;
      const delta = cur - last.current;
      last.current = cur;
      onDrag(delta);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };
  return (
    <div
      onPointerDown={handlePointerDown}
      className={cn(
        "absolute z-20 transition-colors hover:bg-primary/40",
        orientation === "vertical" && "top-0 bottom-0 w-1 cursor-col-resize",
        orientation === "horizontal" && "left-0 right-0 h-1 cursor-row-resize",
        side === "left" && "left-0",
        side === "right" && "right-0",
        side === "top" && "top-0",
        side === "bottom" && "bottom-0",
      )}
    />
  );
}
