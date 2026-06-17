# Garden Financial — Setup Guide

## AI Advisor (Supabase Edge Function)

The AI Advisor uses a Supabase Edge Function to talk to Claude. Follow these steps to activate it.

### 1. Install the Supabase CLI

```bash
npm install -g supabase
```

### 2. Log in and link to your project

```bash
supabase login
supabase link --project-ref chvdpbnmpeuifymloqqb
```

### 3. Add your Anthropic API key as a secret

Go to: https://console.anthropic.com/settings/keys → Create a new key.

Then run:
```bash
supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

Or add it in the Supabase dashboard:
**Project Settings → Edge Functions → Secrets → Add secret**
- Name: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com

### 4. Deploy the function

From the project root:
```bash
supabase functions deploy ai-advisor
```

### 5. Done!

Refresh the app and go to **AI Advisor**. You'll be able to chat with your financial advisor.

---

## Supabase Database

Run this in the **Supabase SQL Editor** if you haven't already:

```sql
-- Add recurring column to budgets (for one-time vs recurring tracking)
alter table public.budgets add column if not exists recurring boolean default true;
```
