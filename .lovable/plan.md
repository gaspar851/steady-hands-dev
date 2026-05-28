# Plan: AI Help Chatbox on Home Page

A floating chat bubble (bottom-right) on `/` that answers visitor questions about Open Trader. Backed by Lovable AI Gateway. Knowledge lives in a `knowledge_entries` DB table you can edit from a new admin page — no code redeploy needed to update what the AI knows. Conversation persists in the visitor's browser (localStorage).

## What gets built

### 1. Knowledge base (database)
New table `public.knowledge_entries`:
- `title` (text) — short label, e.g. "What is Open Trader?"
- `content` (text) — full answer/context the AI uses
- `category` (text, optional) — e.g. "features", "fees", "getting-started"
- `is_active` (boolean) — toggle entries on/off without deleting
- standard id/timestamps + `updated_by`

RLS:
- Anyone (anon + authenticated) can SELECT active entries (the chat needs to read them; no PII here)
- Only admins can INSERT/UPDATE/DELETE

### 2. Admin UI to manage knowledge
New page at `/admin/knowledge` (inside the existing `_authenticated.admin` gate):
- Table of all entries with title, category, active toggle
- Create / Edit / Delete dialogs
- Linked from the existing admin nav alongside Users

### 3. AI chat endpoint
New TanStack server route `src/routes/api/chat.ts`:
- POST receives `UIMessage[]` from the client
- Loads all active knowledge entries from DB and injects them into the system prompt
- Streams a response via Lovable AI Gateway (`google/gemini-3-flash-preview`) using AI SDK `streamText` → `toUIMessageStreamResponse`
- Handles 429 (rate limit) and 402 (credits) with clear errors

### 4. Floating chat widget on home page
New component `HelpChatWidget`:
- Bottom-right floating bubble button (chat icon)
- Click expands a panel (~380×520px) with header, scrollable transcript, prompt input
- Built on AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`)
- Uses `useChat` with `DefaultChatTransport({ api: "/api/chat" })`
- Conversation persisted in `localStorage` under a single key; "Clear chat" button resets it
- Custom small logo/avatar for the assistant (not the generic Sparkles)
- Mounted only on `src/routes/index.tsx`

### 5. Initial knowledge seed
Seed ~6–10 starter entries covering: what Open Trader is, demo balance, supported markets, leverage/fees, how to start, that it's a sandbox (not real money), open-source nature.

## Technical details

- AI SDK packages: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible` (install if missing)
- AI Elements installed via `bunx ai-elements@latest add conversation message prompt-input shimmer`
- Gateway helper at `src/lib/ai-gateway.server.ts` reading `LOVABLE_API_KEY` from `process.env` inside the handler only
- `LOVABLE_API_KEY` is already provisioned (verified in secrets list)
- System prompt template:
  ```
  You are the Open Trader assistant. Answer questions about the platform using ONLY the knowledge below. If unsure, say so and suggest signing up to explore.

  KNOWLEDGE BASE:
  {{entries formatted as: ## title\n content}}
  ```
- Client never sees the system prompt or API key
- Chat widget hidden on mobile narrower than 360px (avoid covering CTAs)
- No auth required to use the chat (it's on the public landing page)

## Files

New:
- `supabase` migration: `knowledge_entries` table + GRANTs + RLS
- `src/lib/ai-gateway.server.ts` — Lovable AI provider helper
- `src/lib/knowledge.functions.ts` — server fns: list/create/update/delete entries
- `src/routes/api/chat.ts` — streaming chat endpoint
- `src/routes/_authenticated.admin.knowledge.tsx` — admin knowledge manager
- `src/components/chat/HelpChatWidget.tsx` — floating widget
- `src/components/ai-elements/*` — installed AI Elements primitives

Modified:
- `src/routes/index.tsx` — mount `<HelpChatWidget />`
- `src/routes/_authenticated.admin.users.tsx` (or admin index) — add nav link to Knowledge

## Out of scope (can add later)
- Per-user chat history in DB
- File/URL ingestion or embeddings/RAG (current setup stuffs all active entries into the system prompt — fine for dozens of entries; if it grows past ~50 we'd switch to embeddings)
- Voice / attachments
- Streaming markdown citations linking back to specific knowledge entries
