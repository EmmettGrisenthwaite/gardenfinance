-- Garden Financial: additive schema bootstrap and RLS hardening
--
-- This script is intentionally idempotent. It can be run in the Supabase SQL
-- Editor against an existing project without deleting user data. For new
-- projects it creates the complete schema expected by the application.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name         text,
  age                integer,
  employment_type    text,
  employer_401k      text,
  investment_types   text[] NOT NULL DEFAULT '{}',
  health_insurance   text,
  primary_goal       text,
  monthly_income     numeric(12,2) NOT NULL DEFAULT 0,
  monthly_expenses   numeric(12,2) NOT NULL DEFAULT 0,
  net_worth          numeric(14,2) NOT NULL DEFAULT 0,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL DEFAULT 'Account',
  type           text NOT NULL,
  balance        numeric(14,2) NOT NULL DEFAULT 0,
  interest_rate  numeric(7,4),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL DEFAULT 'Debt',
  balance        numeric(14,2) NOT NULL DEFAULT 0,
  interest_rate  numeric(7,4),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  goal_type             text NOT NULL DEFAULT 'savings',
  target_amount         numeric(14,2) NOT NULL DEFAULT 0,
  current_amount        numeric(14,2) NOT NULL DEFAULT 0,
  monthly_contribution  numeric(14,2) NOT NULL DEFAULT 0,
  deadline              date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advisor_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Your plan',
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Add columns required by current clients when an older table already exists.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employer_401k text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS investment_types text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_insurance text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_goal text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_income numeric(12,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_expenses numeric(12,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS net_worth numeric(14,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS name text DEFAULT 'Account';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS balance numeric(14,2) DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS interest_rate numeric(7,4);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS name text DEFAULT 'Debt';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS balance numeric(14,2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS interest_rate numeric(7,4);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'savings';
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS target_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS current_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS monthly_contribution numeric(14,2) DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.advisor_plans ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.advisor_plans ADD COLUMN IF NOT EXISTS title text DEFAULT 'Your plan';
ALTER TABLE public.advisor_plans ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.advisor_plans ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.advisor_plans ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS messages jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── Supporting tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budget_limits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      text NOT NULL,
  monthly_limit numeric(12,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assets        numeric(14,2) NOT NULL DEFAULT 0,
  liabilities   numeric(14,2) NOT NULL DEFAULT 0,
  net_worth     numeric(14,2) NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE public.budget_limits ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS assets numeric(14,2) DEFAULT 0;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS liabilities numeric(14,2) DEFAULT 0;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS net_worth numeric(14,2) DEFAULT 0;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS snapshot_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.net_worth_snapshots ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.advisor_memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact        text NOT NULL,
  category    text NOT NULL DEFAULT 'other',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS user_id uuid;

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_plans_user_id ON public.advisor_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_limits_user_id ON public.budget_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_id ON public.net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_memories_user_id ON public.advisor_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_memories_created_at ON public.advisor_memories(created_at DESC);

-- ── Row-level security ──────────────────────────────────────────────────────
-- Every user-owned table is private by default and can only be accessed by the
-- authenticated owner. The policies also protect ID-only client mutations.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own debts" ON public.debts;
CREATE POLICY "Users manage own debts" ON public.debts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own goals" ON public.goals;
CREATE POLICY "Users manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own advisor plans" ON public.advisor_plans;
CREATE POLICY "Users manage own advisor plans" ON public.advisor_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own conversations" ON public.conversations;
CREATE POLICY "Users manage own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own budget limits" ON public.budget_limits;
CREATE POLICY "Users manage own budget limits" ON public.budget_limits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users manage own snapshots" ON public.net_worth_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own advisor memories" ON public.advisor_memories;
CREATE POLICY "Users manage own advisor memories" ON public.advisor_memories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles, public.accounts, public.debts, public.goals,
  public.advisor_plans, public.conversations, public.budget_limits,
  public.net_worth_snapshots, public.advisor_memories
  TO authenticated;
