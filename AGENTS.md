# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
Garden Financial is a **Vite + React 18 single-page app**. **Supabase is the entire backend** (Postgres, Auth, Edge Functions) — there is **no separate backend server**. See `README.md` for the authoritative overview.

> Ignore `start.sh`, `STATUS.md`, and `LAUNCH.md`. They are stale leftovers describing an old Express + SQLite backend (`npm run full-dev`, `backend/`, `demo@example.com`) that no longer exists. The real scripts are only those in `package.json`.

### Commands (all from repo root)
- `npm run dev` — dev server on http://localhost:5173 (the dev command to use)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — ESLint. Note: lint currently reports **hundreds of pre-existing errors** (mostly `react/prop-types` and a few `no-undef` in config files). These are not caused by environment setup; do not treat a non-zero `lint` exit as a broken environment.

### Required: `.env` for the app to boot
`src/lib/supabase.js` calls `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)` at import time. With **no** `.env`, `createClient` throws and the SPA renders blank. Create a gitignored `.env` (it is in `.gitignore`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- With **placeholder** values (e.g. `https://placeholder.supabase.co` + any string) the app boots and renders the `/login` page, but any auth/data call fails with "Failed to fetch". This is enough to verify the frontend dev environment renders.
- For **real** end-to-end auth + data (sign up, onboarding, dashboard, goals, accounts), you need a real Supabase project's URL + anon key in `.env`. These are not committed and must be supplied as secrets.

### Backend schema is NOT in the repo
The base tables (`profiles`, `accounts`, `budgets`, `goals`, `debts`, `advisor_plans`, `conversations`, `net_worth_snapshots`, `budget_limits`) are **not** defined anywhere in the repo — `supabase/migrations.sql` and `SETUP.md` only contain incremental ALTERs. The canonical schema lives in the hosted Supabase project, so a fully working backend cannot be reconstructed locally from this repo alone.

### AI advisor (optional)
The advisor uses the Supabase Edge Function in `supabase/functions/chat` (Deno), which holds `ANTHROPIC_API_KEY` as a server-side Supabase secret. It is deployed separately via the Supabase CLI and is **not** needed to run the SPA locally.
