import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TradeChart } from "@/components/chart/TradeChart";
import { OrderTicket } from "@/components/trade/OrderTicket";
import { PositionsTable } from "@/components/trade/PositionsTable";
import { EditTradeDialog } from "@/components/trade/EditTradeDialog";
import { MarketWatch } from "@/components/trade/MarketWatch";
import { OrderBook } from "@/components/trade/OrderBook";
import { TradeFeed } from "@/components/trade/TradeFeed";
import { SymbolBar } from "@/components/trade/SymbolBar";
import { PanelFrame } from "@/components/trade/PanelFrame";
import { BalanceControls } from "@/components/profile/BalanceControls";
import { TransactionsTable } from "@/components/profile/TransactionsTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listTrades } from "@/lib/trades.functions";
import type { TradeDTO, ProfileDTO } from "@/lib/types";
import { usd, pct } from "@/lib/format";
import { pnl } from "@/lib/calc";
import { getPrice } from "@/lib/binance";
import { cn } from "@/lib/utils";

interface Props {
  profile: ProfileDTO;
  isAdminView?: boolean;
}

type PanelKey = "watch" | "book" | "feed" | "ticket" | "chart" | "history";

interface PanelState {
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
}

type PanelLabels = Record<PanelKey, string>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function TradeWorkspace({ profile, isAdminView = false }: Props) {
  const { t } = useTranslation();
  const PANEL_LABELS: PanelLabels = {
    watch: t("trade.panel_watch"),
    book: t("trade.panel_book"),
    feed: t("trade.panel_feed"),
    ticket: t("trade.panel_ticket"),
    chart: t("trade.panel_chart"),
    history: t("trade.panel_history"),
  };
  const list = useServerFn(listTrades);
  const { data } = useQuery({
    queryKey: ["trades", profile.id],
    queryFn: () => list({ data: { userId: profile.id } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  });
  const trades = data?.trades ?? [];

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [editing, setEditing] = useState<TradeDTO | null>(null);
  const [priceHint, setPriceHint] = useState<number | null>(null);
  const [pickMode, setPickMode] = useState<"sl" | "tp" | null>(null);
  const [pickedPrice, setPickedPrice] = useState<{ mode: "sl" | "tp"; price: number; nonce: number } | null>(null);

  const initial: PanelState = { visible: true, minimized: false, maximized: false };
  const [panels, setPanels] = useState<Record<PanelKey, PanelState>>({
    watch: { ...initial },
    book: { ...initial },
    feed: { ...initial },
    ticket: { ...initial },
    chart: { ...initial },
    history: { ...initial },
  });

  // sizes
  const [watchW, setWatchW] = useState(220);
  const [bookW, setBookW] = useState(240);
  const [ticketW, setTicketW] = useState(300);
  const [feedH, setFeedH] = useState(220);
  const [historyH, setHistoryH] = useState(240);

  const update = (k: PanelKey, patch: Partial<PanelState>) =>
    setPanels((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  const toggleMin = (k: PanelKey) => update(k, { minimized: !panels[k].minimized, maximized: false });
  const toggleMax = (k: PanelKey) => update(k, { maximized: !panels[k].maximized, minimized: false });
  const close = (k: PanelKey) => update(k, { visible: false, maximized: false });
  const open = (k: PanelKey) => update(k, { visible: true, minimized: false, maximized: false });

  const openTrades = useMemo(() => trades.filter((t) => t.status === "open"), [trades]);
  const closedTrades = useMemo(() => trades.filter((t) => t.status === "closed"), [trades]);
  const realizedPnl = useMemo(() => closedTrades.reduce((a, t) => a + pnl(t), 0), [closedTrades]);
  const startingBalance = Number(profile.starting_balance);
  const balance = Number(profile.balance);
  const change = startingBalance > 0 ? ((balance - startingBalance) / startingBalance) * 100 : 0;

  const openSymbols = useMemo(
    () => Array.from(new Set(openTrades.map((t) => t.symbol))),
    [openTrades],
  );
  const [marks, setMarks] = useState<Record<string, number>>({});
  useEffect(() => {
    if (openSymbols.length === 0) return;
    let alive = true;
    const tick = async () => {
      const entries = await Promise.all(
        openSymbols.map(async (s) => {
          try { return [s, await getPrice(s)] as const; } catch { return [s, 0] as const; }
        }),
      );
      if (!alive) return;
      setMarks((prev) => {
        const next = { ...prev };
        for (const [s, p] of entries) if (p > 0) next[s] = p;
        return next;
      });
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [openSymbols.join(",")]);

  const unrealizedPnl = useMemo(
    () => openTrades.reduce((a, t) => a + pnl(t, marks[t.symbol]), 0),
    [openTrades, marks],
  );
  const equity = balance + unrealizedPnl;

  const activeSymbolTrade = openTrades.find((t) => t.symbol === symbol);
  const overlay = useMemo(() => {
    if (!activeSymbolTrade) return undefined;
    return {
      entryPrice: Number(activeSymbolTrade.entry_price),
      stopLoss: activeSymbolTrade.stop_loss != null ? Number(activeSymbolTrade.stop_loss) : null,
      takeProfit: activeSymbolTrade.take_profit != null ? Number(activeSymbolTrade.take_profit) : null,
      direction: activeSymbolTrade.direction,
    };
  }, [
    activeSymbolTrade?.entry_price,
    activeSymbolTrade?.stop_loss,
    activeSymbolTrade?.take_profit,
    activeSymbolTrade?.direction,
  ]);

  const watchEffW = panels.watch.visible ? (panels.watch.minimized ? 28 : watchW) : 0;
  const bookEffW = (panels.book.visible || panels.feed.visible) ? bookW : 0;
  const ticketEffW = panels.ticket.visible ? (panels.ticket.minimized ? 28 : ticketW) : 0;

  const cols = [
    panels.watch.visible ? `${watchEffW}px` : null,
    "1fr",
    bookEffW ? `${bookEffW}px` : null,
    panels.ticket.visible ? `${ticketEffW}px` : null,
  ].filter(Boolean).join(" ");

  const hiddenPanels = (Object.keys(panels) as PanelKey[]).filter((k) => !panels[k].visible);

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-0 flex-col bg-background">
      {/* Symbol bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/30 px-3 py-2">
        <div className="flex items-center gap-3">
          <SymbolBar symbol={symbol} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Trader name shown in top-right user menu; removed here to avoid duplication */}
          <Stat label={t("trade.balance")} value={usd(balance)} />
          <Stat label="Equity" value={usd(equity)} tone={unrealizedPnl >= 0 ? "pos" : "neg"} />
          <Stat label="Open Trades" value={usd(unrealizedPnl)} tone={unrealizedPnl >= 0 ? "pos" : "neg"} />
          <Stat label={t("trade.change")} value={pct(change)} tone={change >= 0 ? "pos" : "neg"} />
          <Stat label={t("trade.open")} value={openTrades.length.toString()} />
          
          {isAdminView && (
            <>
              <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">{t("trade.admin")}</span>
              <BalanceControls userId={profile.id} balance={balance} />
            </>
          )}
          {hiddenPanels.length > 0 && (
            <div className="flex items-center gap-1 border-l border-border pl-2">
              <span className="text-[10px] uppercase text-muted-foreground">{t("trade.show")}</span>
              {hiddenPanels.map((k) => (
                <Button key={k} size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => open(k)}>
                  + {PANEL_LABELS[k]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main workspace grid */}
      <div
        className="grid min-h-0 flex-1 gap-px bg-border"
        style={{ gridTemplateColumns: cols }}
      >
        {panels.watch.visible && (
          <PanelFrame
            title={PANEL_LABELS.watch}
            minimized={panels.watch.minimized}
            maximized={panels.watch.maximized}
            onToggleMinimize={() => toggleMin("watch")}
            onToggleMaximize={() => toggleMax("watch")}
            onClose={() => close("watch")}
            resizable={{ right: (dx) => setWatchW((w) => clamp(w + dx, 160, 480)) }}
            bodyClassName="p-2"
          >
            <MarketWatch active={symbol} onSelect={setSymbol} />
          </PanelFrame>
        )}

        {/* Center column: chart + history stacked */}
        <div className="flex min-h-0 min-w-0 flex-col gap-px bg-border">
          {panels.chart.visible && (
            <PanelFrame
              title={PANEL_LABELS.chart}
              minimized={panels.chart.minimized}
              maximized={panels.chart.maximized}
              onToggleMinimize={() => toggleMin("chart")}
              onToggleMaximize={() => toggleMax("chart")}
              onClose={() => close("chart")}
              resizable={{ bottom: (dy) => setHistoryH((h) => clamp(h - dy, 120, 600)) }}
              className="flex-1"
              bodyClassName="p-2"
            >
              <TradeChart
                symbol={symbol}
                overlay={overlay}
                height={undefined as any}
                maximized
                pickMode={pickMode}
                onPickPrice={(price) => {
                  if (!pickMode) return;
                  setPickedPrice({ mode: pickMode, price, nonce: Date.now() });
                  setPickMode(null);
                }}
              />

            </PanelFrame>
          )}
          {panels.history.visible && (
            <PanelFrame
              title={PANEL_LABELS.history}
              minimized={panels.history.minimized}
              maximized={panels.history.maximized}
              onToggleMinimize={() => toggleMin("history")}
              onToggleMaximize={() => toggleMax("history")}
              onClose={() => close("history")}
              resizable={{ top: (dy) => setHistoryH((h) => clamp(h - dy, 120, 600)) }}
              bodyClassName="overflow-auto p-2"
              className={panels.history.minimized ? "" : ""}
            >
              <div style={{ height: panels.history.maximized ? "100%" : historyH - 28 }}>
                <Tabs defaultValue="open">
                  <TabsList className="h-7">
                    <TabsTrigger value="open" className="h-6 px-2 text-[11px]">{t("trade.tab_open")} ({openTrades.length})</TabsTrigger>
                    <TabsTrigger value="closed" className="h-6 px-2 text-[11px]">{t("trade.tab_closed")} ({closedTrades.length})</TabsTrigger>
                    <TabsTrigger value="transactions" className="h-6 px-2 text-[11px]">Transactions</TabsTrigger>
                  </TabsList>
                  <TabsContent value="open" className="mt-2">
                    <PositionsTable trades={openTrades} onEdit={setEditing} />
                  </TabsContent>
                  <TabsContent value="closed" className="mt-2">
                    <PositionsTable trades={closedTrades} onEdit={setEditing} />
                  </TabsContent>
                  <TabsContent value="transactions" className="mt-2">
                    <TransactionsTable userId={profile.id} />
                  </TabsContent>
                </Tabs>
              </div>
            </PanelFrame>
          )}
        </div>

        {/* Book + Feed column */}
        {bookEffW > 0 && (
          <div className="relative flex min-h-0 min-w-0 flex-col gap-px bg-border">
            {panels.book.visible && (
              <PanelFrame
                title={PANEL_LABELS.book}
                minimized={panels.book.minimized}
                maximized={panels.book.maximized}
                onToggleMinimize={() => toggleMin("book")}
                onToggleMaximize={() => toggleMax("book")}
                onClose={() => close("book")}
                resizable={{ left: (dx) => setBookW((w) => clamp(w - dx, 180, 480)) }}
                className="flex-1"
              >
                <OrderBook symbol={symbol} onPriceClick={(p) => setPriceHint(p)} />
              </PanelFrame>
            )}
            {panels.feed.visible && (
              <PanelFrame
                title={PANEL_LABELS.feed}
                minimized={panels.feed.minimized}
                maximized={panels.feed.maximized}
                onToggleMinimize={() => toggleMin("feed")}
                onToggleMaximize={() => toggleMax("feed")}
                onClose={() => close("feed")}
                resizable={{ top: (dy) => setFeedH((h) => clamp(h - dy, 120, 500)) }}
              >
                <div style={{ height: panels.feed.maximized ? "100%" : feedH - 28 }}>
                  <TradeFeed symbol={symbol} />
                </div>
              </PanelFrame>
            )}
          </div>
        )}

        {panels.ticket.visible && (
          <PanelFrame
            title={PANEL_LABELS.ticket}
            minimized={panels.ticket.minimized}
            maximized={panels.ticket.maximized}
            onToggleMinimize={() => toggleMin("ticket")}
            onToggleMaximize={() => toggleMax("ticket")}
            onClose={() => close("ticket")}
            resizable={{ left: (dx) => setTicketW((w) => clamp(w - dx, 240, 520)) }}
            bodyClassName="overflow-y-auto p-2"
          >
            <OrderTicket
              targetUserId={isAdminView ? profile.id : undefined}
              symbol={symbol}
              onSymbolChange={setSymbol}
              isAdmin={isAdminView}
              priceHint={priceHint}
              balance={equity}
              available={balance}
            />
          </PanelFrame>
        )}
      </div>

      <EditTradeDialog
        trade={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        isAdmin={isAdminView}
      />
    </div>
  );
}

function Stat({ label, value, tone, mono = true }: { label: string; value: string; tone?: "pos" | "neg"; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "text-xs font-semibold",
        mono && "font-mono",
        tone === "pos" && "text-primary",
        tone === "neg" && "text-destructive",
      )}>{value}</div>
    </div>
  );
}
