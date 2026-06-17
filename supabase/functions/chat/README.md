# `chat` Edge Function — secure Claude proxy

The Anthropic API key used to live in the browser (`VITE_ANTHROPIC_API_KEY`), which
meant it shipped in the public JS bundle and could be stolen. This function moves the
key server-side. The browser now calls **this** function with the signed-in user's
Supabase JWT; the function verifies the user, then calls Anthropic with the key that
only exists here.

## One-time deploy (run from the repo root)

You need the Supabase CLI and to be linked to your project:

```bash
# 1. Install + link (skip if already done)
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# 2. Set the Anthropic key as a server secret (NEVER commit this)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# 3. Deploy the function
supabase functions deploy chat
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the platform —
you only set `ANTHROPIC_API_KEY`.

## After deploying
- Remove `VITE_ANTHROPIC_API_KEY` from `.env` — the client no longer uses it.
- The client calls `${VITE_SUPABASE_URL}/functions/v1/chat` (see `src/lib/claude.js`).
- Verify in the app: open the Advisor and send a message; it should reply.

## What it does
- Rejects anyone without a valid Supabase user JWT (`401`).
- Clamps `max_tokens` to a safe ceiling.
- Forwards `{ messages, system, maxTokens, model }` to Anthropic and returns `{ text }`.
- CORS-enabled for browser calls.

## Local testing (optional)
```bash
supabase functions serve chat --env-file ./supabase/.env.local
# then point the client at http://localhost:54321/functions/v1/chat
```
