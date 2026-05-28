import { useEffect, useMemo, useState } from "react";
import { getSymbols, type SymbolInfo } from "@/lib/binance";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SymbolPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getSymbols().then(setSymbols).catch(() => {});
  }, []);

  const popular = useMemo(
    () => ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"],
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const base = symbols.length ? symbols : popular.map((s) => ({ symbol: s, baseAsset: s.replace("USDT", ""), quoteAsset: "USDT" }));
    if (!q) {
      const usdt = base.filter((s) => s.quoteAsset === "USDT");
      return usdt.slice(0, 100);
    }
    return base.filter((s) => s.symbol.includes(q)).slice(0, 200);
  }, [symbols, search, popular]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-mono">
          {value || "Select symbol"}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search (e.g. BTC, SOL)..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No symbol found.</CommandEmpty>
            {filtered.map((s) => (
              <CommandItem
                key={s.symbol}
                value={s.symbol}
                onSelect={() => { onChange(s.symbol); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === s.symbol ? "opacity-100" : "opacity-0")} />
                <span className="font-mono">{s.symbol}</span>
                <span className="ml-auto text-xs text-muted-foreground">{s.baseAsset}/{s.quoteAsset}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
