# Open Trader

A self-hosted paper-trading workspace and strategy journal. Log trades, track open positions, comment on entries, and review per-strategy P&L. Built on TanStack Start with a managed Postgres backend.

## Features

- Trade log with long/short, leverage, SL/TP, fees, swaps
- Open positions table with live P&L
- Per-trade comments / notes
- Balance management with full event history (resets, adjustments, trade settlement)
- Admin master dashboard: all strategies at a glance, plus a global "open trades across every profile" view
- Email/password and Google sign-in

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, Vite 7, SSR on Cloudflare Workers)
- [Lovable Cloud](https://lovable.dev) / Supabase (Postgres, Auth, RLS)
- Tailwind CSS v4
- shadcn/ui + Radix
- TanStack Query + TanStack Router

## Quick start (fork)

1. Fork or clone this repo into a new [Lovable](https://lovable.dev) project.
2. Enable **Lovable Cloud** — schema migrations run automatically.
3. Sign up with any email. The **first user to sign up is automatically promoted to admin** (handled by the `handle_new_user` Postgres trigger).
4. From `/admin` you can manage other users, grant admin, archive profiles, and view all open trades globally.

## Local development

```bash
bun install
bun run dev
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are provisioned automatically when Lovable Cloud is enabled.

## Security model

- Row-Level Security is enabled on every user-data table.
- Regular users only see their own trades, balance events, and profile.
- Admins (`user_roles.role = 'admin'`) can see and manage all profiles.
- Balance fields are read-only for non-admins; all changes go through server functions that write `balance_events`.

## License

MIT — see [LICENSE](./LICENSE).
