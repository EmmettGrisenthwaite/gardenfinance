# Garden Financial

Personal finance visualized as a living garden. Track accounts, budgets, goals, debt, and net worth while an optional AI advisor turns your numbers into editable action plans.

## Stack

- React 18 + Vite + Tailwind CSS
- React Three Fiber for the garden
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- Anthropic Claude through the server-side `chat` Edge Function

There is no separate Express server or local SQLite database.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Set these values in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Supabase setup

Run [`supabase/migrations.sql`](supabase/migrations.sql) in the Supabase SQL Editor. It creates the app tables, indexes, and per-user Row Level Security policies.

To enable advisor chat, set the Anthropic secret and deploy the function:

```bash
supabase secrets set ANTHROPIC_API_KEY=your_key_here
supabase functions deploy chat
```

The Anthropic key is never exposed to the browser.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create the production build
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint
- `npm run test` - run finance regression tests

## Project structure

```text
src/pages/              Dashboard, Plan, Money, Advisor, Login
src/components/         UI, onboarding, plan, and garden components
src/lib/                Supabase client, finance, advisor, memory, and projections
supabase/migrations.sql Postgres schema and RLS policies
supabase/functions/chat Anthropic proxy with request validation and limits
```

## Deploy

For Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project environment and deploy. The included `vercel.json` provides the SPA rewrite for routes such as `/plan` and `/advisor`.
