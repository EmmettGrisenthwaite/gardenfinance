# Garden Financial

Personal finance as a living garden. You enter your real accounts, debts, income, and
spending; a deterministic engine turns them into a ranked monthly plan, and an AI advisor
refines that plan rather than inventing it.

## Stack

- React 18 + Vite + Tailwind CSS
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- Anthropic Claude, called only through the server-side `chat` Edge Function
- Plaid Link for optional real bank-account connection

There is no Express server and no local SQLite database.

## Quick start

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

```bash
npm run dev
```

The app runs at `http://localhost:5173`. Sign in with a Supabase Auth user — there is no
demo account.

## Database

Run [`supabase/migrations.sql`](supabase/migrations.sql) in the Supabase SQL Editor. It is
an idempotent bootstrap that creates every table, index, and per-user RLS policy, and it is
safe to re-run against an existing project. Apply it before creating users or entering data.

`supabase/migrations/` holds the same schema as timestamped CLI migrations. Use whichever
matches your workflow; `migrations.sql` is the superset.

**Upgrading an existing database:** back it up first. Rows without a `user_id` stay hidden
from authenticated users until you assign ownership — that is RLS working correctly, not a
bug.

## Edge Functions (optional)

The advisor and bank linking each need a deployed function. Without them the rest of the app
works and those features show an unavailable state.

`npx` runs the CLI without installing anything. Log in once (this opens a browser), then
link the project:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref chvdpbnmpeuifymloqqb
```

Deploy the advisor:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

```bash
npx supabase functions deploy chat
```

Deploy Plaid bank linking:

```bash
npx supabase secrets set PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
```

```bash
npx supabase functions deploy plaid-link-token plaid-exchange plaid-sync plaid-remove
```

Neither the Anthropic key nor the Plaid secret is ever exposed to the browser.

**Edge Functions deploy separately from the site.** Pushing to `main` ships the frontend via
Vercel; anything under `supabase/functions/` only reaches production when you run the deploy
command above.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
- `npm test` — regression tests (finance engine, money route, plan, mappings)

## Project structure

```text
src/pages/          Home, Plan, StepDetail, AIAdvisor, Settings, Login
src/components/     Onboarding, plan, money-route, garden, and advisor UI
src/lib/            Supabase client, finance engine, money route, advisor context
src/context/        Auth and garden providers
supabase/functions/ chat (Anthropic proxy) and the four Plaid functions
tests/              Node test-runner suites over the pure logic in src/lib
```

The garden on Home is a hand-drawn SVG scene. A React Three Fiber version preceded it and
was removed once nothing shipped it; recover it from git history if you ever want it back.

## Deploy

On Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project environment
and deploy. `vercel.json` supplies the SPA rewrite that routes such as `/plan` and
`/advisor` need.
