import { useEffect, useRef, useState } from "react";

// Lightweight Binance websocket hook. Opens one socket per (symbol, stream),
// auto-reconnects, resets when inputs change. Browser-only — safe inside
// useEffect (never imported during SSR module evaluation).

export function useBinanceStream<T = any>(
  symbol: string,
  stream: "depth20@100ms" | "trade" | "aggTrade",
): T | null {
  const [data, setData] = useState<T | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let alive = true;
    let retry = 0;
    let hostIdx = 0;
    let timer: number | null = null;
    // Multiple Binance WSS hosts. `data-stream.binance.vision` is the public
    // market-data mirror and is reachable from regions where the main
    // `stream.binance.com` host is geo-blocked (e.g. US).
    const hosts = [
      "stream.binance.com:9443",
      "data-stream.binance.vision",
      "stream.binance.com:443",
    ];

    const connect = () => {
      if (!alive) return;
      const host = hosts[hostIdx % hosts.length];
      const url = `wss://${host}/ws/${symbol.toLowerCase()}@${stream}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      let opened = false;
      ws.onmessage = (ev) => {
        try { setData(JSON.parse(ev.data)); } catch {}
      };
      ws.onopen = () => { opened = true; retry = 0; };
      ws.onclose = () => {
        if (!alive) return;
        // If we never opened, rotate to next host immediately.
        if (!opened) hostIdx++;
        retry = Math.min(retry + 1, 6);
        timer = window.setTimeout(connect, 500 * 2 ** Math.min(retry, 4));
      };
      ws.onerror = () => { ws.close(); };
    };
    setData(null);
    connect();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol, stream]);

  return data;
}

export interface DepthMessage {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface TradeMessage {
  e: "trade";
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean; // true: buyer is maker → sell aggressor
}
