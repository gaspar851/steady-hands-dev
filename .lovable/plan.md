## Post-import smoke checks for OpenTrader

I've already run a quick health pass and the app is in good shape — dev server is up, home page returns 200 with the correct `<title>Open Trader …</title>`, generated Supabase types include all imported tables (`profiles`, `trades`, `trade_comments`, `balance_events`, `knowledge_entries`, `user_roles`), `src/start.ts` has `attachSupabaseAuth` wired, `.env` is populated, and the AI help endpoint `POST /api/chat` streams a correct answer from the seeded knowledge base.

Two small follow-ups are worth doing in this pass:

### 1. Run the full security linter and resolve findings
The migration left one WARN — `has_role` is callable by `authenticated`. That's actually the documented pattern (it's the helper RLS policies call), so I'll review the linter output, document/dismiss it, and fix anything else that comes up.

### 2. Verify the auth-gated surfaces actually load end-to-end
- Open the preview in the browser, sign up a fresh account (this becomes admin via the `handle_new_user` trigger).
- Confirm the `/trade`, `/admin`, `/admin/users`, `/admin/knowledge` pages render without 401/500 (verifies the `requireSupabaseAuth` middleware + bearer-attacher chain end to end).
- Confirm the floating Help chat widget on `/` works in the UI (network smoke test already passes).
- Watch the server-function logs for any TS-types / RLS errors.

### 3. README mentions Google sign-in but the imported login/signup pages only use email+password
- No `lovable.auth.signInWithOAuth` calls anywhere in `src/`.
- I will NOT add Google sign-in unsolicited — flagging it so you can decide. If you want it, say the word and I'll add the broker call to `/login` + `/signup` and enable the Google provider.

### Out of scope for this pass
- Visual polish, new features, or refactors. This is strictly: import landed cleanly → it runs → no smoke-test surprises.

When you approve, I'll execute the three checks above and report findings (with fixes for anything broken). The Google sign-in item is a yes/no question for you, not something I'll touch unprompted.