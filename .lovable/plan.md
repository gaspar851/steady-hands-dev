Redesign `src/components/trade/OrderTicket.tsx` into a clean, stepped trade panel matching the UpsideOnly screenshots. Pure frontend change — server function `createTrade`, cost model, and types stay untouched.

## New layout (top → bottom)

**Header row**
- "Trade" title + small "Ready to submit" status text on the right.

**Balance card** (replaces the bid/ask/spread strip)
- Three columns inside a bordered card:
  - VIRTUAL → balance + "Available: …" sub-line (from profile)
  - POSITION → live unrealized P/L of open positions on this symbol (or "-$0.00" when none) — derived from existing trades query; if not trivially available, show notional of current ticket instead
  - ROOKIE → leverage badge (e.g. `10x`) tied to the leverage state

**Step 1 — Order Direction**
- Numbered "1" chip + label "ORDER DIRECTION".
- Two large buttons side-by-side: **Buy** (green fill when active, dim green outline when inactive) / **Sell** (red equivalent). Uses existing `direction` state.

**Step 2 — Order Type & Amount**
- Numbered "2" chip + label "ORDER TYPE & AMOUNT".
- Two pill buttons: **Market** / **Limit**.
  - Market = auto-fill `entryPrice` from book ticker on every tick, input read-only.
  - Limit = editable `entryPrice` input.
- Amount field below: large input, "$" prefix, "USD" suffix — binds to existing `positionSize`.
- Leverage: collapsed by default behind a small "Leverage: 10x ▾" link that expands a slider with chips 1× / 5× / 10× / 25× / 50× / 100× (keeps existing leverage state; default from `defaultLeverage`).

**Divider**

**Stop Loss** (optional)
- Label "STOP LOSS" + "OPTIONAL" on the right.
- Row: small target icon (placeholder, not wired to chart-click yet), USD input, and a side chip showing live `%` distance from entry (red).
- Validation message reused from current implementation.

**Take Profit** (optional)
- Same shape, green % chip.

**Order Summary card**
- Title "ORDER SUMMARY".
- Rows: Direction / Type / Amount / Stop Loss / Take Profit — right-aligned values, color-coded (buy=green, sell=red, SL=red, TP=green).

**Submit button**
- Full-width, large, green when Buy / red when Sell. Text: "Submit Trade" (loading → "Placing…").

## What stays the same

- Same `createTrade` server function call, same payload shape, same validation rules (SL/TP vs entry, required entry/size), same fee model (`feeOn(notionalOf(...))`), same admin fee override.
- Live `getBookTicker` polling every 3s — used to drive Market price and a hidden spread value (kept in state but not rendered in main UI; we can move into a small info tooltip if needed).
- SymbolPicker is **removed from inside the panel** (assumed to live in the parent SymbolBar already). If parent still relies on the in-panel picker, we keep it compact at the very top above the header. → flagged as open question below.

## Technical notes

- One file edit: `src/components/trade/OrderTicket.tsx`.
- New small subcomponents inside the file: `StepHeader`, `BalanceCard`, `SummaryCard` — no new files.
- Tailwind only, semantic tokens (`primary`, `destructive`, `muted-foreground`, `border`, `card`). No new colors in `styles.css` needed — existing primary/destructive already map to green/red.
- New local state: `orderType: "market" | "limit"`, `showLeverage: boolean`.
- i18n: reuse existing `trade.ot_*` keys; add a few new keys (`ot_step_direction`, `ot_step_type_amount`, `ot_order_summary`, `ot_optional`, `ot_ready`) to `en.json`.
- No backend / schema / route changes.

## Open question

Keep the SymbolPicker inside the new panel (compact, above the header) or remove it entirely and rely on the existing `SymbolBar` above the chart? Will confirm before building.
