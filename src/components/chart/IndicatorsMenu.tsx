import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Activity } from "lucide-react";
import type { IndicatorConfig } from "./useChartIndicators";

interface Props {
  indicators: IndicatorConfig[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<IndicatorConfig>) => void;
}

const KIND_LABEL: Record<IndicatorConfig["kind"], string> = {
  sma: "SMA", ema: "EMA", bb: "Bollinger", rsi: "RSI", macd: "MACD",
};

export function IndicatorsMenu({ indicators, onToggle, onUpdate }: Props) {
  const activeCount = indicators.filter((i) => i.enabled).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]">
          <Activity className="h-3 w-3" />
          Indicators
          {activeCount > 0 && (
            <span className="rounded bg-primary/15 px-1 text-[10px] text-primary">{activeCount}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">Indicators</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {indicators.map((ind) => (
            <div key={ind.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent/40">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ind.color }} />
              <span className="min-w-[88px] font-medium">
                {KIND_LABEL[ind.kind]}{ind.kind === "sma" || ind.kind === "ema" ? ` ${ind.period}` : ""}
              </span>
              {ind.kind === "bb" && (
                <Input
                  type="number" value={ind.period} min={2}
                  onChange={(e) => onUpdate(ind.id, { period: +e.target.value || 20 })}
                  className="h-6 w-12 px-1 text-[11px]"
                />
              )}
              {ind.kind === "rsi" && (
                <Input
                  type="number" value={ind.period} min={2}
                  onChange={(e) => onUpdate(ind.id, { period: +e.target.value || 14 })}
                  className="h-6 w-12 px-1 text-[11px]"
                />
              )}
              {ind.kind === "macd" && (
                <span className="flex gap-1 text-[10px] text-muted-foreground">
                  <Input type="number" value={ind.fast} onChange={(e) => onUpdate(ind.id, { fast: +e.target.value || 12 })} className="h-6 w-10 px-1 text-[11px]" />
                  <Input type="number" value={ind.slow} onChange={(e) => onUpdate(ind.id, { slow: +e.target.value || 26 })} className="h-6 w-10 px-1 text-[11px]" />
                  <Input type="number" value={ind.signal} onChange={(e) => onUpdate(ind.id, { signal: +e.target.value || 9 })} className="h-6 w-10 px-1 text-[11px]" />
                </span>
              )}
              <Switch checked={ind.enabled} onCheckedChange={() => onToggle(ind.id)} className="ml-auto" />
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
