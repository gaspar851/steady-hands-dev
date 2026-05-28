## Home page updates

Two scoped changes to `src/routes/index.tsx` and the i18n locale files.

### 1. Headline word swap

In the hero H1, replace "sandbox" → "protocol".

- Update `home.h1_c` value in all 8 locale files (`en`, `es`, `fr`, `de`, `it`, `pt`, `ar`, `zh`) so the translated word for "sandbox" becomes the equivalent of "protocol".
- No JSX change needed — the H1 already renders `t("home.h1_c")`.

### 2. New "Trust & Transparency" section above the footer

Insert a new section between the Manifesto block and the `<footer>` in `src/routes/index.tsx`. Purpose: reinforce reliability with audit/security/openness signals.

Contents (all i18n-keyed under `home.trust.*`):

**Section heading**
- Eyebrow: "Trust & Transparency"
- Title: "Verified by the community, not a single company"
- Subtitle: short line about open verification

**Audit / certification badges** (grid of 4 cards, reuses existing `AuditBadge` component already defined in the file but currently unused)
- Security Audit — "Trail of Bits style review" — `ShieldCheck`
- Smart Contract Verified — "On-chain bytecode match" — `FileCheck2`
- SOC 2 Aligned — "Controls & monitoring" — `Lock`
- MIT Licensed — "Free forever" — `BadgeCheck`

**Trust logos row** (small uppercase items, reuses existing `TrustLogo` component already defined)
- Open-Source
- Audited
- Secured
- Verified
- Community-Built
- Transparent Pricing

**Price-feed transparency strip**
- Line: "Prices aggregated from 15+ exchanges in real time"
- Horizontal scrolling row of exchange name chips: Binance, Coinbase, Kraken, Bitstamp, Bybit, OKX, Bitfinex, KuCoin, Gate.io, Crypto.com, Gemini, HTX, MEXC, Bitget, BingX, Upbit. Uses the same `scroll-x` keyframe already in the file.

**Contributor counter**
- Large stat: "Built by thousands of contributors" with a small caption "Anyone can fork, audit, or improve the protocol."

### Styling

Reuses existing tokens and components — no new colors, no new keyframes. Cards use the same `border-border/60 bg-card/40 backdrop-blur-md` treatment as the Pillars section to stay consistent. All copy goes through `t(...)` and is added to every locale file.

### Files touched

- `src/routes/index.tsx` — swap nothing in JSX for the H1 change; add the new `<TrustSection />` (inline) before `<footer>`. The unused `AuditBadge` / `TrustLogo` / `ShieldCheck` / `Lock` / `FileCheck2` / `BadgeCheck` imports already in the file get used here.
- `src/i18n/locales/{en,es,fr,de,it,pt,ar,zh}.json` — update `home.h1_c`; add `home.trust.*` keys.
