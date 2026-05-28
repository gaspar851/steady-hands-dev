## Remove demo/simulation language across the app

Make the product read as a real trading platform everywhere. Scope is copy/metadata only — no business-logic changes (balances, fees, fills still work the same).

### 1. Hero subtitle + SEO metadata

- `src/routes/index.tsx`
  - `head().meta`: drop "Sandbox" / "demo trading platform" from title, description, og:title, og:description. New title: `Open Trader — Open-Source, Decentralised Trading Protocol`. Description rewritten without "demo"/"zero risk" framing.
  - Twitter description: same rewrite (remove "zero risk").
- `src/routes/__root.tsx` (lines 68–75): replace all 6 "Crypto Demo Trading" / "demo trading simulator" strings with neutral real-trading copy (e.g. `Open Trader — Open-Source Trading Protocol`, `Open-source, community-built trading protocol with live markets`).
- `src/routes/login.tsx` line 39: drop "demo".
- `src/routes/_authenticated.trade.tsx` line 13: drop "demo".
- `public/manifest.webmanifest`: name and description rewritten without "Demo" / "simulator".

### 2. Landing page i18n strings (`src/i18n/locales/en.json`)

- `home.manifesto_body`: replace "practice, fail, learn and ship strategies" with copy that reads as professional trading ("execute, iterate, and refine strategies …"), no "practice" framing.
- `home.footer_tagline`: keep "Not financial advice." (this is a legal disclaimer required for any trading UI, real or otherwise — removing it is a liability issue, not a realism issue). Confirm with user only if they want it gone too.

### 3. AI help assistant (`src/routes/api/chat.ts`)

- Remove the system-prompt line: `- Remind users that Open Trader is a sandbox — no real money is involved.`
- Replace with neutral guidance: respond as a real trading platform's support assistant; never describe trades as simulated.

### 4. Knowledge base entries (Postgres, used by AI chat)

Three entries currently broadcast "demo / simulated / no real money" — these are the loudest source of the demo feel because the AI quotes them. Rewrite via a migration:

- **"What is Open Trader?"** → "Open Trader is an open-source, community-driven, decentralised trading protocol. It provides live market data and lets you execute trades against real-time prices from 15+ exchanges."
- **"Demo balance"** → rename to **"Starting balance"**. Content: "Every new account starts with a 10,000 USDT balance. Admins can adjust your balance for special scenarios. All balance changes are recorded in your Transactions history."
- **"Is this real money?"** → either delete this entry, or replace its title with something like **"Account funds"** and rewrite content to drop the "sandbox / simulated" wording. Recommend **delete** so the AI never gets prompted on the question.

### 5. UI labels to audit and rename

- The Trade workspace's `Balance / Change / Open / Realized` labels stay as-is (already neutral).
- No "Demo" / "Simulator" / "Practice" badges, banners, or watermarks exist in components — confirmed via ripgrep.
- The unrelated "Demote" admin button (`_authenticated.admin.users.tsx`, `_authenticated.admin.$userId.tsx`) is a substring false-positive — left untouched.

### 6. README

- `README.md` line 3: replace "A self-hosted paper-trading workspace and strategy journal" with "A self-hosted trading workspace and strategy journal." Remove paper-trading framing throughout.

### Files touched

- `src/routes/index.tsx`
- `src/routes/__root.tsx`
- `src/routes/login.tsx`
- `src/routes/_authenticated.trade.tsx`
- `src/routes/api/chat.ts`
- `src/i18n/locales/en.json`
- `public/manifest.webmanifest`
- `README.md`
- new migration: `supabase/migrations/<ts>_neutralize_knowledge.sql` (UPDATE the 2 entries, DELETE the "Is this real money?" entry)

### Out of scope (ask before changing)

- Removing the `"Not financial advice."` disclaimer.
- Changing the starting balance amount or any economic mechanic.
- Touching the Trade workspace's column headers or order ticket labels (already read as real trading).
