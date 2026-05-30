// CORS Proxy Fixed - May 30 2026
// Binance public REST — with CORS Proxy
const CORS_PROXY = "https://corsproxy.io/?";

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface Kline {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

let symbolsCache: SymbolInfo[] | null = null;

export async function getSymbols(): Promise<SymbolInfo[]> {
  if (symbolsCache) return symbolsCache;

  try {
    const cached = localStorage.getItem("binance:symbols:v1");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.ts && Date.now() - parsed.ts < 86400_000) {
        symbolsCache = parsed.data;
        return symbolsCache!;
      }
    }
  } catch {}

  const url = "https://api.binance.com/api/v3/exchangeInfo";
  const res = await fetch(CORS_PROXY + encodeURIComponent(url));
  
  const json = await res.json();
  const list: SymbolInfo[] = (json.symbols || [])
    .filter((s: any) => s.status === "TRADING" && s.isSpotTradingAllowed)
    .map((s: any) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
    }));

  symbolsCache = list;
  try {
    localStorage.setItem(
      "binance:symbols:v1",
      JSON.stringify({ ts: Date.now(), data: list })
    );
  } catch {}
  return list;
}

export async function getKlines(
  symbol: string,
  interval: Interval = "1h",
  limit = 500
): Promise<Kline[]> {
  const baseUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(CORS_PROXY + encodeURIComponent(baseUrl));
  
  if (!res.ok) throw new Error(`klines ${symbol} ${res.status}`);
  
  const raw: any[] = await res.json();
  return raw.map((r) => ({
    time: Math.floor(r[0] / 1000),
    open: +r[1],
    high: +r[2],
    low: +r[3],
    close: +r[4],
    volume: +r[5],
  }));
}

export async function getPrice(symbol: string): Promise<number> {
  const baseUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  const res = await fetch(CORS_PROXY + encodeURIComponent(baseUrl));
  const json = await res.json();
  return +json.price;
}

export interface BookTicker {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPct: number;
}

export async function getBookTicker(symbol: string): Promise<BookTicker> {
  const baseUrl = `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`;
  const res = await fetch(CORS_PROXY + encodeURIComponent(baseUrl));
  
  if (!res.ok) throw new Error(`bookTicker ${symbol} ${res.status}`);
  
  const json = await res.json();
  const bid = +json.bidPrice;
  const ask = +json.askPrice;
  const mid = bid && ask ? (bid + ask) / 2 : bid || ask;
  const spread = ask && bid ? ask - bid : 0;
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;
  return { bid, ask, mid, spread, spreadPct };
}
