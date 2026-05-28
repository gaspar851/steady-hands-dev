# Wallet sign-in + on-chain USDT deposits

Adds "Connect Wallet" to the login/signup page (MetaMask, Trust, Rainbow, Coinbase, WalletConnect, Phantom, Solflare, Backpack) alongside existing email + Google, AND wires a real USDT deposit flow that credits the in-app balance.

## 1. What infrastructure is needed (overview)

```text
                ┌──────────────────────────────┐
   Browser  ──▶ │  Wallet UI (Reown AppKit)    │  EVM + Solana adapters
                └──────────────┬───────────────┘
                               │ signed SIWE / SIWS message
                               ▼
              ┌────────────────────────────────────┐
              │  TanStack server fns (/api side)   │
              │  - issue nonce                     │
              │  - verify signature                │
              │  - find/create Supabase user       │
              │  - mint Supabase session           │
              └─────────────┬──────────────────────┘
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
       Supabase Auth (admin)     Postgres (profiles,
       creates/looks up user      wallet_identities,
       returns access+refresh     deposit_addresses,
       tokens to browser          deposits, nonces)
                                          ▲
                                          │ credits on confirmed transfer
                ┌─────────────────────────┴─────────┐
                │  Deposit watcher (server route)   │
                │  /api/public/webhooks/deposits    │
                │  Alchemy (EVM) + Helius (Solana)  │
                │  webhooks → verify sig → insert    │
                │  deposit + balance_event          │
                └───────────────────────────────────┘
```

### Pieces to add

**Frontend**
- Reown AppKit (formerly WalletConnect Web3Modal) — one modal that handles MetaMask, Trust, Rainbow, Coinbase, plus mobile via WalletConnect, plus Phantom/Solflare/Backpack on Solana. Avoids gluing wagmi + @solana/wallet-adapter together by hand.
- A `<ConnectWallet />` button on `/login` and `/signup`.
- A `/wallet` page (deposit address + QR + history) on the authenticated side.
- A "Linked wallets" section in profile so a logged-in user can attach a wallet to an existing email account.

**Backend (TanStack server fns + one public webhook route)**
- `getNonce` — issues a one-time nonce keyed by `address + chain`.
- `verifyWalletSignature` — verifies SIWE (EVM, `viem.verifyMessage`) or SIWS (Solana, `tweetnacl.sign.detached.verify`), finds-or-creates the Supabase user via the admin client, returns access + refresh tokens that the browser hands to `supabase.auth.setSession`.
- `linkWalletToCurrentUser` — same verify path, but attaches the wallet to the signed-in user instead of creating a new one.
- `getOrCreateDepositAddress` — per-user, per-chain HD-derived deposit address (one EVM address, one Solana address).
- `/api/public/webhooks/deposits/evm` and `/api/public/webhooks/deposits/solana` — signed webhooks from Alchemy / Helius that record confirmed USDT transfers and credit `balance_events`.

**Database (new tables + columns)**
- `wallet_identities` — `(user_id, chain, address, verified_at)`, unique on `(chain, lower(address))`. Multiple wallets per user, one user per wallet.
- `wallet_nonces` — `(address, chain, nonce, expires_at)`. TTL 5 min.
- `deposit_addresses` — `(user_id, chain, address, derivation_index)`, unique on `(chain, address)`.
- `deposits` — `(id, user_id, chain, tx_hash, from_address, to_address, token, amount, confirmations, status, credited_balance_event_id)`, unique on `(chain, tx_hash, log_index)`.
- `profiles` — already exists; no schema change required for login (we key wallet identity by `wallet_identities.user_id`).

**Secrets (request via `add_secret`)**
- `REOWN_PROJECT_ID` — Reown/WalletConnect project id (public, but conventionally stored as a secret so it stays out of git history). Exposed to the browser via `VITE_REOWN_PROJECT_ID`.
- `ALCHEMY_API_KEY` + `ALCHEMY_WEBHOOK_SIGNING_KEY` — EVM USDT transfer notifications.
- `HELIUS_API_KEY` + `HELIUS_WEBHOOK_SECRET` — Solana USDT (SPL) transfer notifications.
- `WALLET_HD_SEED` — 24-word seed (encrypted at rest in Supabase secrets) used to derive per-user deposit addresses. Server-only, never read in the browser.
- `WALLET_NETWORK` — `mainnet` or `testnet` (Sepolia + Solana devnet for first ship).

**External services**
- Reown Cloud project (free) — wallet connection.
- Alchemy or Infura webhook for ERC-20 Transfer events on the USDT contract → our address pool.
- Helius webhook for SPL Token transfers on the USDT mint → our address pool.

## 2. Sign-in flow

```text
1. User clicks Connect Wallet → Reown modal → picks wallet → wallet connects.
2. Browser calls getNonce({ address, chain }) → server returns { nonce, message }
   where message is a SIWE (EVM) or SIWS (Solana) string including the nonce,
   domain, issued-at, and a 5-min expiry.
3. Wallet signs the message.
4. Browser calls verifyWalletSignature({ address, chain, signature, message }).
   Server:
     a. Verifies signature (viem / tweetnacl) and that nonce matches + isn't expired.
     b. Looks up wallet_identities. If found → that user_id. If not:
        - Creates a Supabase auth user via supabaseAdmin.auth.admin.createUser
          with a synthetic email "<chain>:<address>@wallet.opentrader.local"
          (never used for login, only as a Supabase Auth primary key).
        - Inserts profile row (handle_new_user trigger already does this).
        - Inserts wallet_identities row.
     c. Generates a session for that user via
        supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })
        and exchanges the token to get { access_token, refresh_token }.
     d. Marks nonce as used.
5. Browser calls supabase.auth.setSession({ access_token, refresh_token }).
   Existing onAuthStateChange listener fires, router invalidates, user lands
   on /trade exactly like an email or Google sign-in.
```

## 3. Deposit flow

```text
1. User opens /wallet. Page calls getOrCreateDepositAddress for each chain.
   - Server derives a new address from WALLET_HD_SEED at index = next free
     derivation_index, stores it in deposit_addresses, returns address + QR.
   - Same user always gets the same two addresses on repeat visits.
2. User sends USDT (ERC-20 on Ethereum, SPL on Solana) from their wallet.
3. Alchemy/Helius detects the Transfer event whose `to` is in our address pool
   and POSTs a signed webhook to /api/public/webhooks/deposits/{chain}.
4. Webhook handler:
     a. Verifies HMAC signature against the provider's signing secret.
     b. Resolves to_address → user_id via deposit_addresses.
     c. Upserts deposits row (idempotent on (chain, tx_hash, log_index)).
     d. Once status = confirmed (≥ N confirmations), inserts a
        balance_events row { type: 'deposit', amount, note: '<chain> tx ...' }
        and updates profiles.balance via the existing admin-only RPC pattern.
5. /wallet page subscribes to the deposits table via Supabase realtime so
   "Pending → Confirmed → Credited" updates without refresh.
```

Withdrawals are explicitly out of scope for this milestone — they require a hot wallet, key custody, gas/SOL float, and a separate compliance review. Add an "Coming soon" placeholder on /wallet for now.

## 4. Files to add / change

**New**
- `src/integrations/wallet/appkit.ts` — Reown AppKit init (EVM + Solana adapters, project id).
- `src/components/auth/ConnectWalletButton.tsx` — modal trigger + sign-in flow.
- `src/components/wallet/DepositPanel.tsx` — addresses, QR, history.
- `src/lib/wallet.functions.ts` — `getNonce`, `verifyWalletSignature`, `linkWalletToCurrentUser`, `getOrCreateDepositAddress`.
- `src/lib/wallet.server.ts` — server-only helpers: SIWE/SIWS verification, HD derivation, Supabase admin user creation, session minting.
- `src/routes/_authenticated.wallet.tsx` — Wallet page.
- `src/routes/api/public/webhooks/deposits.evm.ts` — Alchemy webhook handler.
- `src/routes/api/public/webhooks/deposits.solana.ts` — Helius webhook handler.

**Changed**
- `src/routes/login.tsx`, `src/routes/signup.tsx` — add ConnectWalletButton.
- `src/routes/_authenticated.tsx` — add nav entry for Wallet.
- Knowledge base — replace the current "Funding your account" entry with one that mentions wallet sign-in and USDT deposits (EVM + Solana) so the chatbot reflects reality.

**Database migration**
- Create `wallet_identities`, `wallet_nonces`, `deposit_addresses`, `deposits` with full GRANTs + RLS:
  - `wallet_identities`: user can SELECT own rows; INSERT/DELETE only via server fn (no anon/auth grants beyond SELECT own).
  - `deposit_addresses`: user can SELECT own rows; admin/service_role only writes.
  - `deposits`: user can SELECT own rows; service_role only writes (webhook).
  - `wallet_nonces`: service_role only.

## 5. Packages to install

- `@reown/appkit`, `@reown/appkit-adapter-wagmi`, `@reown/appkit-adapter-solana`
- `wagmi`, `viem`
- `@solana/web3.js`, `@solana/spl-token`
- `tweetnacl`, `bs58` (Solana signature verification)
- `siwe` (EVM message construction + nonce helpers)
- `ethers` is NOT needed — viem covers verification.

All are Worker-compatible (pure JS / WASM, no native bindings).

## 6. Open decisions before build (will ask inline)

1. Mainnet or testnet for first ship? Recommend Sepolia (EVM) + Solana devnet so we can end-to-end test deposits without real funds, then flip `WALLET_NETWORK` later.
2. Minimum confirmations before credit? Default: 12 on EVM, 32 slots on Solana.
3. Should existing email accounts be auto-linked if a wallet sign-in happens to match a known address in `profiles`? Default: no — require explicit linking from settings.
4. Custodial deposit pool address vs HD-derived per-user addresses? Plan defaults to per-user HD derivation (cleaner attribution, no need to parse memos). Custodial single-address + memo is simpler but Solana memos and EVM `data` fields complicate wallet UX.

## 7. What this is NOT (explicit scope guards)

- No on-chain trading. Trades stay off-chain against the existing balance.
- No withdrawals in this milestone.
- No token other than USDT (USDC can be added later by extending the contract/mint allowlist).
- No removal of email or Google sign-in.
- No change to the `trades` table or the trade execution path.
