# 🌱 Garden Financial

**Live demo:** [garden-financial.vercel.app](https://garden-financial.vercel.app)

Personal finance, visualized as a living garden. Track budgets, goals, debt and net
worth — and watch a real-time 3D garden flourish as your finances improve. An AI advisor,
grounded in your actual numbers, turns guidance into editable, step-by-step plans.

> Calm, game-like, and genuinely useful — your money as something you grow.

## Highlights

- **Living 3D garden** — a React Three Fiber island that grows through 6 stages (barren →
  thriving) from your real financial health, with four quadrants for Savings, Investments,
  Emergency fund and Debt.
- **Unified Plan** — goals, a retirement planner, and editable action steps in one place,
  with a "living headline" that projects when you'll hit your nearest goal.
- **AI advisor** — streaming chat powered by Claude (Anthropic), aware of your income,
  goals, debt and garden state. It can add goals and build action plans via tool use.
- **Budget, Debt & Accounts** — recurring cash-flow tracking, avalanche/snowball payoff
  modeling, and a daily net-worth chart.
- **Mobile-first PWA** — installable, dark-glass UI, designed for a 375px phone first.

## Tech stack

- **React 18 + Vite** (SPA)
- **Tailwind CSS** + Radix UI primitives — dark-glass design system (Fraunces display serif + Inter body)
- **React Three Fiber** + drei + postprocessing for the 3D garden
- **Recharts** (charts) · **Framer Motion** (motion) · **lucide-react** (icons)
- **Supabase** — Postgres, Auth, and Edge Functions (Deno)
- **Anthropic Claude** — via a Supabase Edge Function that keeps the API key server-side

There is **no separate backend server** — Supabase is the entire backend.

## Quick start

### Prerequisites
- Node.js 18+
- A Supabase project ([supabase.com](https://supabase.com))

### 1. Install & configure
```bash
npm install
cp .env.example .env        # then fill in your Supabase URL + anon key
```

`.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 2. Run
```bash
npm run dev                 # http://localhost:5173
```

### Scripts
- `npm run dev` — start the dev server (port 5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Supabase setup

1. **Database** — the app reads/writes tables for profiles, accounts, budgets, goals,
   debts and net-worth snapshots (with row-level security per user). Apply your schema /
   migrations in the Supabase SQL editor.
2. **Auth** — email/password is enabled by default. For quick testing you can disable
   "Confirm email" under Authentication → Providers.
3. **AI Edge Function** — the advisor calls a `chat` Edge Function so the Anthropic key is
   never exposed in the browser:
   ```bash
   supabase functions deploy chat
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

## Deploy (Vercel)

The repo ships a `vercel.json` (Vite preset + SPA rewrite), so deploying is:

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in
   **Project → Settings → Environment Variables**.
3. Deploy. The SPA rewrite makes deep links (e.g. `/plan`) work on refresh.

The Edge Function is deployed separately via the Supabase CLI (see above).

## Project structure

```
src/
  pages/        Dashboard (garden), Plan, Budget, Debt, Accounts, AIAdvisor, Login
  components/   Layout, Onboarding, RetirementPlanner, PlanCard, garden/Garden3D, ...
  context/      AuthContext, GardenContext
  lib/          supabase, claude, retirement, advisorPlans, gardenUtils
supabase/
  functions/chat/   Deno Edge Function — Anthropic proxy (SSE streaming + tool use)
```

## Security notes

- The Anthropic key lives **only** as a Supabase Edge Function secret — never in client code.
- `VITE_SUPABASE_ANON_KEY` is the public anon key; protect data with row-level security.
- `.env` is gitignored. Never commit real keys.

## License

MIT
