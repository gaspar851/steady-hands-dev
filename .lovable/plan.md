## Goal

Replace the HD-wallet + webhook plumbing with a simple, admin-curated deposit flow:

1. Admin pre-loads a small set of platform-owned addresses (one per coin/network).
2. User clicks **Generate my wallet**, picks coin + network, sees the address + QR + memo.
3. User sends funds, then submits a **deposit request** with the tx hash + optional screenshot.
4. A trusted assistant verifies on-chain, approves, and the balance is credited automatically via `balance_events`.

Wallet sign-in (Reown / MetaMask / Phantom) stays — only the **on-chain deposit pipeline** is being simplified. Email + Google + Wallet logins all funnel into the same deposit flow.

## Supported coins/networks (admin-editable)

| Coin | Network | Notes |
|---|---|---|
| BTC | Bitcoin | |
| ETH | Ethereum (ERC-20) | |
| USDT | Ethereum (ERC-20) | |
| USDT | Tron (TRC-20) | low fees, very common |
| USDT | Solana (SPL) | |
| SOL | Solana | |

Admin can add/disable rows later — UI is driven by the table, not hard-coded.

## Database changes

**Drop / abandon** (no longer needed): `wallet_nonces` keeps working (used for wallet login), but `deposit_addresses` and `deposits` from the previous plan are replaced.

**New tables:**

- `platform_wallets` — admin-managed list of receive addresses
  - `id`, `coin` (BTC/ETH/USDT/SOL), `network` (bitcoin/ethereum/tron/solana), `address`, `memo` (optional, for chains that need it), `qr_image_url` (optional, uploaded by admin), `is_active`, `notes`, `created_at`, `updated_at`
  - Unique on `(coin, network)` while `is_active = true`
  - RLS: anyone authenticated can SELECT active rows; only admins INSERT/UPDATE/DELETE

- `deposit_requests` — user-submitted proofs awaiting verification
  - `id`, `user_id`, `platform_wallet_id`, `coin`, `network`, `amount` (user-claimed), `tx_hash`, `from_address` (optional), `proof_image_url` (optional), `status` (`pending` / `approved` / `rejected`), `reviewer_id`, `reviewer_note`, `credited_balance_event_id`, `created_at`, `reviewed_at`
  - RLS: users SELECT/INSERT their own; admins SELECT/UPDATE all; nobody DELETE

- Storage bucket `deposit-proofs` — private, signed URLs, users upload only under `{user_id}/...`

**Trigger:** when a `deposit_requests` row flips to `status = 'approved'`, insert a `balance_events` row (`type = 'deposit'`, `amount = <claimed amount>`, `actor_id = reviewer_id`, `note = 'Deposit <coin>/<network> tx <hash>'`) and update `profiles.balance` via the existing admin-only path. Store the resulting `balance_events.id` on the request.

## UI changes

**`/wallet` page** (replace existing `DepositPanel`):

- Two-step picker: **Coin → Network**, both required.
- "Generate my wallet" button reveals the address card: address, copyable, QR (generated client-side from address), memo if present, minimum confirmations notice, and a clear warning ("Send only `{COIN}` on the `{NETWORK}` network. Other tokens will be lost.").
- Below: **Submit deposit proof** form — amount, tx hash (validated by chain-specific regex), optional from-address, optional screenshot upload (≤5 MB, image/* only).
- **My deposits** table: status pills, timestamps, reviewer note when rejected.

**`/admin/deposits` page** (new, gated by `has_role('admin')`):

- Tab 1 — **Requests**: pending queue with user email, claimed amount, tx hash (linkified to the right explorer), proof image preview, **Approve** / **Reject** with note. Approve writes the `balance_events` row.
- Tab 2 — **Wallets**: CRUD for `platform_wallets` — add/edit address, memo, upload QR, toggle active.

**`/admin` nav**: add "Deposits" link.

## Server functions (TanStack `createServerFn`)

- `listActivePlatformWallets()` — public to authenticated users.
- `createDepositRequest({ platform_wallet_id, amount, tx_hash, from_address?, proof_image_path? })` — Zod-validated, inserts row, returns it.
- `listMyDepositRequests()` — user's own history.
- `adminListDepositRequests({ status? })` — admin-only.
- `adminReviewDepositRequest({ id, action: 'approve' | 'reject', note? })` — admin-only; on approve, inserts `balance_events` + updates `profiles.balance`, links the event id back to the request.
- `adminUpsertPlatformWallet(...)` / `adminDeletePlatformWallet(...)` — admin-only.

All admin fns use `requireSupabaseAuth` + `has_role` check inside the handler.

## Code removed / shrunk

- Delete `src/routes/api/public/webhooks/deposits.evm.ts` and `deposits.solana.ts` (no chain watcher needed).
- Shrink `src/lib/wallet.server.ts`: keep SIWE/SIWS sign-in helpers, drop HD-derivation code (`@scure/bip32`, `ed25519-hd-key`).
- Drop env vars `WALLET_HD_SEED`, `WALLET_NETWORK`, `ALCHEMY_WEBHOOK_SECRET`, `HELIUS_WEBHOOK_SECRET` — not needed.
- Reown wallet sign-in button + provider stay as a third login option.

## Files to add / change

**Add**
- `supabase/migrations/<ts>_deposits_manual_flow.sql` — tables, RLS, GRANTs, storage bucket + policies, trigger.
- `src/lib/deposits.functions.ts` — server fns above.
- `src/components/wallet/WalletPicker.tsx`, `DepositAddressCard.tsx`, `DepositProofForm.tsx`, `MyDepositsTable.tsx`.
- `src/routes/_authenticated/admin.deposits.tsx` — admin queue + wallets CRUD.

**Change**
- `src/routes/_authenticated.wallet.tsx` — use new components, drop HD address fetch.
- `src/components/admin/AdminNav.tsx` — add Deposits link.
- Knowledge base entry for the new flow.

**Delete**
- `src/routes/api/public/webhooks/deposits.evm.ts`
- `src/routes/api/public/webhooks/deposits.solana.ts`
- HD-derivation code in `src/lib/wallet.server.ts`.

## Admin onboarding (you, after we ship)

1. Open `/admin/deposits → Wallets`.
2. For each row, paste the address from your real BTC / ETH / TRON / Solana wallet and (optionally) upload a custom QR image.
3. Toggle active. Users immediately see those addresses.

## Out of scope

- Withdrawals (separate flow, can plan next).
- Automatic on-chain verification (would re-introduce Alchemy/Helius — explicitly deferred).
- Multi-currency conversion: the user's claimed amount is what gets credited as USDT-equivalent **after** the reviewer confirms the on-chain value matches. Reviewer can edit the amount before approving.

Approve this and I'll switch to build mode and ship it.