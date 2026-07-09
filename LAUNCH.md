# Garden Financial launch guide

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with a Supabase Auth user. There is no local demo account or separate backend server.

## Supabase

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the deployment environment.
2. Run `supabase/migrations.sql` in the Supabase SQL Editor.
3. Deploy the optional advisor function:

```bash
supabase functions deploy chat
supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

## Vercel

Import the repository, add the two Vite environment variables, and deploy. `vercel.json` provides the SPA rewrite needed for routes such as `/plan` and `/advisor`.

## Verification

```bash
npm run test
npm run lint
npm run build
```
