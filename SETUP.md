# Garden Financial setup

## 1. Configure Supabase

Create a Supabase project and copy its URL and publishable anon key into `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Apply [`supabase/migrations.sql`](supabase/migrations.sql) in the Supabase SQL Editor. It creates the app tables, indexes, and per-user Row Level Security policies. Run it before creating test users or entering financial data.

## 2. Run the app

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run test
npm run lint
npm run build
```

## 3. Enable the AI advisor (optional)

Install the Supabase CLI, link the project, set the Anthropic secret, and deploy the `chat` function:

```bash
npm install -g supabase
supabase login
supabase link --project-ref chvdpbnmpeuifymloqqb
supabase secrets set ANTHROPIC_API_KEY=your_key_here
supabase functions deploy chat
```

The browser only calls the Edge Function; the Anthropic key is never placed in Vite environment variables or shipped to users. If the function is not deployed, the rest of the app remains usable and the advisor shows an unavailable state.

## Existing projects

The migration is additive and safe to re-run. Back up an existing database first. If older rows do not have a `user_id`, assign their ownership before enabling RLS; those rows will intentionally be hidden from authenticated users until ownership is set.
