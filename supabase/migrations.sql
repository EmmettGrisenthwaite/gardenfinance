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

-- Money Clarity: additive manual cash-flow, account, and debt detail
-- Safe to run against an existing Garden Financial project.

CREATE TABLE IF NOT EXISTS public.cash_flow_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('income', 'expense', 'allocation')),
  group_key      text NOT NULL,
  category_key   text NOT NULL,
  name           text NOT NULL,
  amount         numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  frequency      text NOT NULL DEFAULT 'monthly'
                 CHECK (frequency IN ('weekly', 'biweekly', 'twice_monthly', 'monthly', 'quarterly', 'annual')),
  monthly_amount numeric(12,2) GENERATED ALWAYS AS (
    round(amount * CASE frequency
      WHEN 'weekly' THEN 52.0 / 12.0
      WHEN 'biweekly' THEN 26.0 / 12.0
      WHEN 'twice_monthly' THEN 2.0
      WHEN 'quarterly' THEN 1.0 / 3.0
      WHEN 'annual' THEN 1.0 / 12.0
      ELSE 1.0
    END, 2)
  ) STORED,
  source         text NOT NULL DEFAULT 'user',
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS subtype text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_liquid boolean;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS monthly_contribution numeric(12,2) DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS contribution_percent numeric(7,4);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS employer_match_percent numeric(7,4);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS employer_match_limit_percent numeric(7,4);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS ytd_contribution numeric(12,2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS contribution_year integer;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS include_in_net_worth boolean NOT NULL DEFAULT true;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_verified_at date;

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS type text DEFAULT 'other';
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS lender text;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS minimum_payment numeric(12,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS planned_payment numeric(12,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS due_day integer;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS original_balance numeric(14,2);
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS term_end_date date;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS include_in_net_worth boolean NOT NULL DEFAULT true;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS last_verified_at date;

CREATE INDEX IF NOT EXISTS idx_cash_flow_items_user_id ON public.cash_flow_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_items_user_sort ON public.cash_flow_items(user_id, sort_order, created_at);

ALTER TABLE public.cash_flow_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cash flow items" ON public.cash_flow_items;
CREATE POLICY "Users manage own cash flow items" ON public.cash_flow_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_flow_items TO authenticated;

-- Preserve every existing user's current totals as two editable legacy rows.
INSERT INTO public.cash_flow_items (
  user_id, kind, group_key, category_key, name, amount, frequency, source, sort_order
)
SELECT id, 'income', 'income', 'other_income', 'Take-home income',
       monthly_income, 'monthly', 'legacy', 0
FROM public.profiles profile
WHERE profile.monthly_income > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_flow_items item WHERE item.user_id = profile.id
  );

INSERT INTO public.cash_flow_items (
  user_id, kind, group_key, category_key, name, amount, frequency, source, sort_order
)
SELECT id, 'expense', 'wants', 'other_spending', 'Current monthly spending',
       monthly_expenses, 'monthly', 'legacy', 1
FROM public.profiles profile
WHERE profile.monthly_expenses > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_flow_items item WHERE item.user_id = profile.id AND item.kind = 'expense'
  );

CREATE OR REPLACE FUNCTION public.sync_profile_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user := OLD.user_id;
  ELSE
    target_user := NEW.user_id;
  END IF;

  UPDATE public.profiles
  SET monthly_income = COALESCE((
        SELECT SUM(monthly_amount) FROM public.cash_flow_items
        WHERE user_id = target_user AND kind = 'income'
      ), 0),
      monthly_expenses = COALESCE((
        SELECT SUM(monthly_amount) FROM public.cash_flow_items
        WHERE user_id = target_user AND kind = 'expense'
      ), 0),
      updated_at = now()
  WHERE id = target_user;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_cash_flow_after_change ON public.cash_flow_items;
CREATE TRIGGER sync_profile_cash_flow_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.cash_flow_items
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_cash_flow();

CREATE OR REPLACE FUNCTION public.save_monthly_plan(
  p_items jsonb DEFAULT '[]'::jsonb,
  p_limits jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_typeof(p_limits) <> 'array' THEN
    RAISE EXCEPTION 'Items and limits must be arrays';
  END IF;

  DELETE FROM public.cash_flow_items WHERE user_id = v_user_id;
  DELETE FROM public.budget_limits WHERE user_id = v_user_id;

  INSERT INTO public.cash_flow_items (
    user_id, kind, group_key, category_key, name, amount, frequency, source, sort_order
  )
  SELECT
    v_user_id,
    item->>'kind',
    COALESCE(NULLIF(item->>'group_key', ''), 'wants'),
    COALESCE(NULLIF(item->>'category_key', ''), 'custom'),
    COALESCE(NULLIF(item->>'name', ''), 'Custom category'),
    GREATEST(0, COALESCE((item->>'amount')::numeric, 0)),
    COALESCE(NULLIF(item->>'frequency', ''), 'monthly'),
    COALESCE(NULLIF(item->>'source', ''), 'user'),
    COALESCE((item->>'sort_order')::integer, row_number_value - 1)
  FROM (
    SELECT value AS item, row_number() OVER () AS row_number_value
    FROM jsonb_array_elements(p_items)
  ) rows;

  INSERT INTO public.budget_limits (user_id, category, monthly_limit)
  SELECT
    v_user_id,
    limit_row->>'category',
    GREATEST(0, COALESCE((limit_row->>'monthly_limit')::numeric, 0))
  FROM jsonb_array_elements(p_limits) AS limit_rows(limit_row)
  WHERE NULLIF(limit_row->>'category', '') IS NOT NULL
    AND COALESCE((limit_row->>'monthly_limit')::numeric, 0) > 0;

  UPDATE public.profiles
  SET monthly_income = COALESCE((
        SELECT SUM(monthly_amount) FROM public.cash_flow_items
        WHERE user_id = v_user_id AND kind = 'income'
      ), 0),
      monthly_expenses = COALESCE((
        SELECT SUM(monthly_amount) FROM public.cash_flow_items
        WHERE user_id = v_user_id AND kind = 'expense'
      ), 0),
      updated_at = now()
  WHERE id = v_user_id;

  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item.sort_order, item.created_at)
      FROM public.cash_flow_items item WHERE item.user_id = v_user_id
    ), '[]'::jsonb),
    'limits', COALESCE((
      SELECT jsonb_agg(to_jsonb(budget) ORDER BY budget.category)
      FROM public.budget_limits budget WHERE budget.user_id = v_user_id
    ), '[]'::jsonb),
    'profile', (
      SELECT to_jsonb(profile) FROM public.profiles profile WHERE profile.id = v_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_monthly_plan(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_monthly_plan(jsonb, jsonb) TO authenticated;

-- Garden Sanctuary: permanent, idempotent progress milestones.
CREATE TABLE IF NOT EXISTS public.garden_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('plan_step', 'goal')),
  source_key text NOT NULL,
  label text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, source_key)
);
CREATE INDEX IF NOT EXISTS idx_garden_milestones_user_earned ON public.garden_milestones(user_id, earned_at DESC);
ALTER TABLE public.garden_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own garden milestones" ON public.garden_milestones;
CREATE POLICY "Users read own garden milestones" ON public.garden_milestones FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON TABLE public.garden_milestones TO authenticated;

INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
SELECT plan.user_id, 'plan_step',
  CASE WHEN NULLIF(step.value->>'id', '') IS NOT NULL THEN 'step:' || (step.value->>'id') ELSE 'step:' || plan.id::text || ':' || (step.ordinality - 1)::text END,
  COALESCE(NULLIF(step.value->>'text', ''), 'Completed a plan step'), jsonb_build_object('planId', plan.id),
  CASE WHEN COALESCE(step.value->>'completedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' THEN (step.value->>'completedAt')::timestamptz ELSE COALESCE(plan.updated_at, now()) END
FROM public.advisor_plans plan
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(plan.steps, '[]'::jsonb)) WITH ORDINALITY AS step(value, ordinality)
WHERE plan.user_id IS NOT NULL
  AND lower(COALESCE(step.value->>'done', 'false')) IN ('true', 't', '1', 'yes')
ON CONFLICT (user_id, kind, source_key) DO NOTHING;

INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
SELECT goal.user_id, 'goal', 'goal:' || goal.id::text, COALESCE(NULLIF(goal.name, ''), 'Reached a goal'),
  jsonb_build_object('goalId', goal.id, 'goalType', COALESCE(goal.goal_type, 'savings')), COALESCE(goal.updated_at, now())
FROM public.goals goal
WHERE goal.user_id IS NOT NULL AND goal.target_amount > 0 AND goal.current_amount >= goal.target_amount
ON CONFLICT (user_id, kind, source_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_garden_milestone(
  p_kind text, p_source_key text, p_label text, p_metadata jsonb DEFAULT '{}'::jsonb, p_earned_at timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_id uuid; v_previous integer; v_total integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_kind NOT IN ('plan_step', 'goal') THEN RAISE EXCEPTION 'Invalid milestone kind'; END IF;
  IF NULLIF(trim(p_source_key), '') IS NULL THEN RAISE EXCEPTION 'Source key is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT count(*) INTO v_previous FROM public.garden_milestones WHERE user_id = v_user_id;
  INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
  VALUES (v_user_id, p_kind, p_source_key, COALESCE(NULLIF(trim(p_label), ''), 'Earned a garden milestone'), COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_earned_at, now()))
  ON CONFLICT (user_id, kind, source_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    UPDATE public.garden_milestones SET label = COALESCE(NULLIF(trim(p_label), ''), label), metadata = COALESCE(p_metadata, metadata)
    WHERE user_id = v_user_id AND kind = p_kind AND source_key = p_source_key;
  END IF;
  SELECT count(*) INTO v_total FROM public.garden_milestones WHERE user_id = v_user_id;
  RETURN jsonb_build_object('inserted', v_id IS NOT NULL, 'previousTotal', v_previous, 'total', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.reconcile_garden_milestones(p_events jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_previous integer; v_total integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_events) <> 'array' THEN RAISE EXCEPTION 'Events must be an array'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT count(*) INTO v_previous FROM public.garden_milestones WHERE user_id = v_user_id;
  INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
  SELECT v_user_id, event->>'kind', event->>'source_key', COALESCE(NULLIF(event->>'label', ''), 'Earned a garden milestone'),
    COALESCE(event->'metadata', '{}'::jsonb), CASE WHEN COALESCE(event->>'earned_at', '') ~ '^\d{4}-\d{2}-\d{2}T' THEN (event->>'earned_at')::timestamptz ELSE now() END
  FROM jsonb_array_elements(p_events) AS rows(event)
  WHERE event->>'kind' IN ('plan_step', 'goal') AND NULLIF(trim(event->>'source_key'), '') IS NOT NULL
  ON CONFLICT (user_id, kind, source_key) DO UPDATE SET label = EXCLUDED.label, metadata = EXCLUDED.metadata;
  SELECT count(*) INTO v_total FROM public.garden_milestones WHERE user_id = v_user_id;
  RETURN jsonb_build_object('inserted', v_total > v_previous, 'previousTotal', v_previous, 'total', v_total);
END; $$;

REVOKE ALL ON FUNCTION public.record_garden_milestone(text, text, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_garden_milestones(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_garden_milestone(text, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_garden_milestones(jsonb) TO authenticated;
