import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Network,
  Users,
  ArrowRight,
  Sparkles,
  Code2,
  Globe2,
  Zap,
  Star,
  GitFork,
  TerminalSquare,
  ShieldCheck,
  Lock,
  FileCheck2,
  BadgeCheck,
  Brain,
  Cpu,
  Activity,
  TrendingUp,
  Radar,
  Waves,
} from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { Logo } from "@/components/Logo";

import { HelpChatWidget } from "@/components/chat/HelpChatWidget";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/trade" });
  },
  head: () => ({
    meta: [
      { title: "Open Trader — Open-Source, Decentralised Trading Protocol" },
      {
        name: "description",
        content:
          "Open Trader is an open-source, community-driven, decentralised trading protocol. Live market data, transparent code, forkable by design.",
      },
      { property: "og:title", content: "Open Trader — Open-Source Trading Protocol" },
      {
        property: "og:description",
        content: "Open-source. Decentralised. Community-driven. Built by traders, for traders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundFX />

      {/* Header */}
      <header className="relative z-20 flex h-14 items-center justify-between border-b border-border/40 bg-background/30 px-3 backdrop-blur-xl sm:px-6">
        <Link to="/" className="flex min-w-0 items-center">
          <Logo size={28} />
          <span className="ml-2 hidden rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary sm:inline">
            v0 · open protocol
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          
          <InstallAppButton />
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <Star className="h-3 w-3" /> {t("home.star")}
          </a>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="px-2 sm:px-3">{t("home.sign_in")}</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="px-2 sm:px-3">{t("home.get_started")}</Button>
          </Link>
        </div>
      </header>


      {/* Live ticker bar */}
      <LiveTicker />

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 pb-12 text-center sm:pt-24">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary sm:text-[11px]">
          <Sparkles className="h-3 w-3 animate-pulse" /> {t("home.badge")}
        </span>

        <h1 className="max-w-4xl text-3xl font-bold leading-[1.1] tracking-tight sm:text-6xl sm:leading-[1.05]">
          {t("home.h1_a")}{" "}
          <span className="bg-gradient-to-r from-primary via-chart-3 to-chart-5 bg-clip-text text-transparent animate-[shimmer_6s_ease-in-out_infinite] bg-[length:200%_100%]">
            {t("home.h1_b")}
          </span>
          ,{" "}
          <span className="bg-gradient-to-r from-chart-4 via-primary to-chart-3 bg-clip-text text-transparent">
            {t("home.h1_c")}
          </span>
          .
        </h1>

        <p className="mt-5 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t("home.subtitle")}
        </p>

             <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="group relative w-full overflow-hidden sm:w-auto min-w-[170px]">
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-foreground/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {t("home.cta_join")}
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>

            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[170px]">
                <Code2 className="mr-1 h-4 w-4" />
                {t("home.cta_view_source")}
              </Button>
            </a>

            <Link to="/trade">
              <Button size="lg" className="w-full sm:w-auto min-w-[170px]">
                Trade
              </Button>
            </Link>
          </div>

        {/* Stat strip */}
        <div className="mt-12 grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40 sm:grid-cols-4">
          <Stat label={t("home.stat_contributors")} value="∞" hint={t("home.stat_contributors_hint")} />
          <Stat label={t("home.stat_custodians")} value="0" hint={t("home.stat_custodians_hint")} />
          <Stat label={t("home.stat_forks")} value="P2P" hint={t("home.stat_forks_hint")} icon={GitFork} />
          <Stat label={t("home.stat_license")} value="MIT" hint={t("home.stat_license_hint")} icon={TerminalSquare} />
        </div>

        {/* Live faux-chart panel */}
        <LiveChartPanel />
      </section>

      {/* Pillars */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <Pillar
            icon={GitBranch}
            tag={t("home.p1_tag")}
            title={t("home.p1_title")}
            body={t("home.p1_body")}
          />
          <Pillar
            icon={Network}
            tag={t("home.p2_tag")}
            title={t("home.p2_title")}
            body={t("home.p2_body")}
          />
          <Pillar
            icon={Users}
            tag={t("home.p3_tag")}
            title={t("home.p3_title")}
            body={t("home.p3_body")}
          />
        </div>
      </section>


      <AISignalsSection />

      <TrustSection />



      <footer className="relative z-10 border-t border-border/40 px-4 py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Globe2 className="h-3.5 w-3.5" />
          {t("home.footer_tagline")}
        </div>
      </footer>



      {/* Animations */}
      <style>{`
        @keyframes shimmer { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes scroll-x { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes dash { to { stroke-dashoffset: -200; } }
        @keyframes float-y { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      `}</style>
      <HelpChatWidget />
    </div>
  );
}

/* ---------------------------- Live Ticker ---------------------------- */

const TICKER_SEED = [
  { sym: "BTC", price: 67_842.12, chg: +1.42 },
  { sym: "ETH", price: 3_512.88, chg: -0.86 },
  { sym: "SOL", price: 162.34, chg: +3.21 },
  { sym: "BNB", price: 598.21, chg: +0.42 },
  { sym: "XRP", price: 0.523, chg: -1.18 },
  { sym: "ADA", price: 0.412, chg: +0.74 },
  { sym: "DOGE", price: 0.158, chg: +2.04 },
  { sym: "AVAX", price: 38.42, chg: -0.51 },
  { sym: "LINK", price: 14.27, chg: +1.11 },
];

function LiveTicker() {
  const [ticks, setTicks] = useState(TICKER_SEED);

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) =>
        prev.map((t) => {
          const drift = (Math.random() - 0.5) * 0.004; // ±0.2%
          const nextPrice = +(t.price * (1 + drift)).toFixed(t.price < 1 ? 4 : 2);
          const nextChg = +(t.chg + drift * 100).toFixed(2);
          return { ...t, price: nextPrice, chg: nextChg };
        }),
      );
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const doubled = [...ticks, ...ticks];
  return (
    <div className="relative z-10 overflow-hidden border-b border-border/40 bg-card/30 py-2 backdrop-blur-md">
      <div
        className="flex w-max gap-8 whitespace-nowrap will-change-transform"
        style={{ animation: "scroll-x 40s linear infinite" }}
      >
        {doubled.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold tracking-wider">{t.sym}</span>
            <span className="tabular text-muted-foreground">
              ${t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span
              className={
                "tabular font-mono " +
                (t.chg >= 0 ? "text-primary" : "text-destructive")
              }
            >
              {t.chg >= 0 ? "▲" : "▼"} {Math.abs(t.chg).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Live Chart Panel --------------------------- */

interface LiveBar { t: number; o: number; h: number; l: number; c: number }

function LiveChartPanel() {
  const [bars, setBars] = useState<LiveBar[]>([]);

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;

    (async () => {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1s&limit=120",
        );
        const raw: any[] = await res.json();
        if (!alive) return;
        setBars(
          raw.map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4] })),
        );
      } catch {}

      if (!alive) return;
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1s");
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg.k;
          if (!k) return;
          const bar: LiveBar = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c };
          setBars((prev) => {
            if (!prev.length) return [bar];
            const last = prev[prev.length - 1];
            if (last.t === bar.t) {
              const next = prev.slice();
              next[next.length - 1] = bar;
              return next;
            }
            return [...prev.slice(1), bar];
          });
        } catch {}
      };
    })();

    return () => {
      alive = false;
      ws?.close();
    };
  }, []);

  const { path, area, last, delta, positive } = useMemo(() => {
    if (bars.length < 2) {
      return { path: "", area: "", last: 0, delta: "0.00", positive: true };
    }
    const closes = bars.map((b) => b.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const w = 600;
    const h = 120;
    const step = w / (closes.length - 1);
    const y = (v: number) => h - ((v - min) / range) * (h - 8) - 4;
    const top = closes
      .map((c, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(c).toFixed(1)}`)
      .join(" ");
    const _last = closes[closes.length - 1];
    const _first = closes[0];
    const _delta = (((_last - _first) / _first) * 100).toFixed(2);
    return {
      path: top,
      area: `${top} L${w},${h} L0,${h} Z`,
      last: _last,
      delta: _delta,
      positive: _last >= _first,
    };
  }, [bars]);

  return (
    <div className="mt-14 w-full max-w-4xl rounded-2xl border border-border/60 bg-card/40 p-5 text-left backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              BTC/USDT · live · 1s
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg tabular">
            {last ? `$${last.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          </div>
          <div
            className={
              "text-xs tabular " + (positive ? "text-primary" : "text-destructive")
            }
          >
            {positive ? "▲" : "▼"} {Math.abs(Number(delta))}%
          </div>
        </div>
      </div>
      <svg viewBox="0 0 600 120" className="h-32 w-full">
        <defs>
          <linearGradient id="ot-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ot-area)" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ----------------------------- Small UI bits ----------------------------- */

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: any;
}) {
  return (
    <div className="bg-card/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <div className="text-2xl font-semibold tabular text-foreground sm:text-3xl">
          {value}
        </div>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[11px] text-muted-foreground/80">{hint}</div>
    </div>
  );
}

function Pillar({
  icon: Icon,
  tag,
  title,
  body,
}: {
  icon: any;
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_color-mix(in_oklab,var(--color-primary)_40%,transparent)]">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">{tag}</div>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1">
      {children}
    </span>
  );
}

function AuditBadge({
  icon: Icon,
  title,
  firm,
  meta,
}: {
  icon: any;
  title: string;
  firm: string;
  meta: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-foreground/80">{firm}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div>
    </div>
  );
}

function TrustLogo({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/90 transition-colors hover:text-foreground">
      <Icon className="h-3.5 w-3.5 text-primary/80" />
      {label}
    </div>
  );
}

const EXCHANGES = [
  "Binance", "Coinbase", "Kraken", "Bitstamp", "Bybit", "OKX",
  "Bitfinex", "KuCoin", "Gate.io", "Crypto.com", "Gemini", "HTX",
  "MEXC", "Bitget", "BingX", "Upbit",
];

function TrustSection() {
  const { t } = useTranslation();
  const doubled = [...EXCHANGES, ...EXCHANGES];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
          <ShieldCheck className="h-3 w-3" /> {t("home.trust.eyebrow")}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("home.trust.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          {t("home.trust.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AuditBadge icon={ShieldCheck} title={t("home.trust.audit_security_title")} firm={t("home.trust.audit_security_firm")} meta={t("home.trust.audit_security_meta")} />
        <AuditBadge icon={FileCheck2} title={t("home.trust.audit_contract_title")} firm={t("home.trust.audit_contract_firm")} meta={t("home.trust.audit_contract_meta")} />
        <AuditBadge icon={Lock} title={t("home.trust.audit_soc2_title")} firm={t("home.trust.audit_soc2_firm")} meta={t("home.trust.audit_soc2_meta")} />
        <AuditBadge icon={BadgeCheck} title={t("home.trust.audit_mit_title")} firm={t("home.trust.audit_mit_firm")} meta={t("home.trust.audit_mit_meta")} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-xl border border-border/60 bg-card/30 px-6 py-4 backdrop-blur-md">
        <TrustLogo icon={Code2} label={t("home.trust.logo_open_source")} />
        <TrustLogo icon={ShieldCheck} label={t("home.trust.logo_audited")} />
        <TrustLogo icon={Lock} label={t("home.trust.logo_secured")} />
        <TrustLogo icon={BadgeCheck} label={t("home.trust.logo_verified")} />
        <TrustLogo icon={Users} label={t("home.trust.logo_community")} />
        <TrustLogo icon={FileCheck2} label={t("home.trust.logo_transparent")} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/20 backdrop-blur-md">
        <div className="border-b border-border/40 px-4 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-primary align-middle shadow-[0_0_8px_var(--color-primary)]" />
          {t("home.trust.feeds_label")}
        </div>
        <div className="relative overflow-hidden py-3">
          <div
            className="flex w-max gap-8 whitespace-nowrap will-change-transform"
            style={{ animation: "scroll-x 45s linear infinite" }}
          >
            {doubled.map((ex, i) => (
              <span key={i} className="font-mono text-xs uppercase tracking-wider text-muted-foreground/90">
                {ex}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-6 text-center backdrop-blur-md">
        <div className="bg-gradient-to-r from-primary via-chart-3 to-chart-5 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
          {t("home.trust.contributors_value")}
        </div>
        <div className="mt-2 text-sm font-semibold">{t("home.trust.contributors_label")}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t("home.trust.contributors_caption")}</div>
      </div>
    </section>
  );
}



function AISignalsSection() {
  const signals = [
    { icon: Brain, label: "Pattern recognition", text: "BTC/USDT forming bullish flag · confidence 78%", tone: "pos" as const },
    { icon: Radar, label: "Anomaly scan", text: "Unusual ETH whale outflow detected — 12.4K ETH", tone: "neg" as const },
    { icon: Activity, label: "Momentum", text: "SOL RSI crossing 70 · 4h trend strengthening", tone: "pos" as const },
    { icon: Waves, label: "Volatility", text: "Implied vol compressing on majors — breakout watch", tone: "neu" as const },
    { icon: TrendingUp, label: "Flow analysis", text: "Net spot inflow $42M last hour · accumulation", tone: "pos" as const },
    { icon: Cpu, label: "Model update", text: "On-chain sentiment vector refreshed · 2.1M samples", tone: "neu" as const },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % signals.length), 2200);
    return () => clearInterval(id);
  }, [signals.length]);

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
          <Brain className="h-3 w-3 animate-pulse" /> AI Co-pilot
        </div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Markets, decoded in{" "}
          <span className="bg-gradient-to-r from-primary via-chart-3 to-chart-5 bg-clip-text text-transparent">real time</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          A transparent intelligence layer that watches order flow, on-chain signals and news velocity — and ships every insight you see straight to your dashboard.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Live signal stream */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl lg:col-span-3">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Signal stream · live
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">model v0.4 · open</span>
          </div>
          <ul className="space-y-2">
            {signals.map((s, i) => {
              const active = i === idx;
              const Icon = s.icon;
              return (
                <li
                  key={i}
                  className={
                    "flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-500 " +
                    (active
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_30px_-10px_var(--color-primary)]"
                      : "border-border/40 bg-background/20 opacity-70")
                  }
                >
                  <div
                    className={
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 " +
                      (s.tone === "pos"
                        ? "bg-primary/15 text-primary ring-primary/30"
                        : s.tone === "neg"
                          ? "bg-destructive/15 text-destructive ring-destructive/30"
                          : "bg-muted text-muted-foreground ring-border")
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</div>
                    <div className="truncate text-xs">{s.text}</div>
                  </div>
                  {active && (
                    <span className="font-mono text-[10px] text-primary">▸ now</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Neural orb */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl lg:col-span-2">
          <NeuralOrb />
          <div className="mt-4 text-center">
            <div className="text-xs font-semibold">Open intelligence</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Auditable models. No black boxes. Run them locally or on the network.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NeuralOrb() {
  const nodes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 60 + (i % 3) * 12;
        return { x: 100 + Math.cos(a) * r, y: 100 + Math.sin(a) * r, i };
      }),
    [],
  );
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44">
      <defs>
        <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="70" fill="url(#orb-core)" />
      {nodes.map((n) =>
        nodes
          .filter((m) => m.i > n.i && Math.hypot(m.x - n.x, m.y - n.y) < 70)
          .map((m, j) => (
            <line
              key={`${n.i}-${j}`}
              x1={n.x}
              y1={n.y}
              x2={m.x}
              y2={m.y}
              stroke="var(--color-primary)"
              strokeOpacity="0.25"
              strokeWidth="0.6"
            />
          )),
      )}
      {nodes.map((n) => (
        <circle
          key={n.i}
          cx={n.x}
          cy={n.y}
          r="2.4"
          fill="var(--color-primary)"
          style={{ animation: `float-y ${3 + (n.i % 4)}s ease-in-out infinite`, animationDelay: `${n.i * 0.15}s` }}
        />
      ))}
      <circle cx="100" cy="100" r="6" fill="var(--color-primary)">
        <animate attributeName="r" values="5;9;5" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function BackgroundFX() {
  const [pos, setPos] = useState({ x: 50, y: 30 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* mouse spotlight */}
      <div
        className="absolute inset-0 transition-[background] duration-300"
        style={{
          background: `radial-gradient(600px circle at ${pos.x}% ${pos.y}%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 60%)`,
        }}
      />
      {/* grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--color-foreground) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-foreground) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 40%, transparent 75%)",
        }}
      />
      {/* glow orbs */}
      <div
        className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        style={{ animation: "float-y 9s ease-in-out infinite" }}
      />
      <div className="absolute top-40 -left-24 h-[360px] w-[360px] rounded-full bg-chart-3/15 blur-[120px] animate-pulse" />
      <div className="absolute top-72 -right-24 h-[360px] w-[360px] rounded-full bg-chart-5/15 blur-[120px] animate-pulse" />
      {/* animated diagonal line */}
      <svg
        className="absolute inset-0 h-full w-full opacity-30"
        preserveAspectRatio="none"
        viewBox="0 0 800 600"
      >
        <path
          d="M0,500 Q200,420 400,460 T800,380"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          style={{ animation: "dash 8s linear infinite" }}
        />
      </svg>
      {/* scanline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}
