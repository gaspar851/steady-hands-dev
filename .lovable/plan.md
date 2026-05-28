## Take over OpenTrader development

The uploaded `OpenTrader-main.zip` is a complete TanStack Start app (Open Trader — a self-hosted paper-trading workspace with admin dashboard, trade log, balance events, AI help chat, etc.) built on the same template as this workspace. The current project is still the blank Lovable starter. To "take over development" I'll import the uploaded codebase on top of the current scaffold so we can continue building from where it left off.

### Steps

1. **Extract & sanity-check the archive**
   - Unzip `user-uploads://OpenTrader-main.zip` to a temp dir.
   - Verify no `.git` directory is present (never copy git metadata into the project).

2. **Replace project source with OpenTrader**
   - Sync the extracted tree into `/dev-server/` using `rsync -a --exclude='.git' --exclude='.git/**' --exclude='node_modules' --exclude='bun.lock'`.
   - Overwrites: `src/`, `public/`, `supabase/`, `package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`, `wrangler.jsonc`, `.lovable/plan.md`, `README.md`, etc.
   - Keeps the current `.git` and Lovable infra intact.

3. **Install dependencies**
   - Run `bun install` so the new `package.json` (TanStack Start, AI SDK, Radix, etc.) is fully resolved.

4. **Enable Lovable Cloud + apply database schema**
   - The app requires Postgres (profiles, user_roles, trades, balance_events, knowledge_entries, RLS policies, `handle_new_user` trigger, etc.).
   - Enable Lovable Cloud, then apply the SQL under `supabase/` as migrations (tables, GRANTs, RLS, trigger that promotes the first signup to admin).

5. **Verify**
   - Confirm build succeeds, dev server boots, and `/` renders the OpenTrader landing page (not the blank placeholder).
   - Confirm `LOVABLE_API_KEY` secret is present for the AI help chat endpoint (add if missing).

### What I will NOT do in this step
- No new features. The pending plan in `.lovable/plan.md` (AI Help Chatbox) appears already implemented in the uploaded source — I'll just import it as-is and we can iterate after.
- No edits to logic/UI beyond what's needed to make the imported project build and run.

### After import
Once the app is running, tell me what you want to work on next (bugs, new features, polish) and I'll continue from there.