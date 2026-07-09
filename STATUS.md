# Garden Financial status

The current app is a React/Vite SPA backed by Supabase Auth, Postgres, and an optional `chat` Edge Function. It is not a local SQLite or Express application.

## Verified locally

- Production Vite build succeeds.
- Focused finance tests pass.
- ESLint reports zero errors; six existing Fast Refresh warnings remain.
- The main user-owned tables have an additive schema/RLS migration in `supabase/migrations.sql`.

## Current product areas

- Dashboard: live garden, account/debt totals, and net-worth progress.
- Money: accounts, debts, income, and recurring expense tracking.
- Plan: goals, action steps, and projections.
- Advisor: persisted chat, memory, plans, and safe artifact actions.
- Settings: export and deletion of app data.

## Remaining operational work

1. Apply the migration in the connected Supabase project.
2. Deploy `supabase/functions/chat` and set `ANTHROPIC_API_KEY` if advisor chat is needed.
3. Run a signed-in smoke test: create, edit, and delete one account, debt, goal, plan step, and advisor message.
