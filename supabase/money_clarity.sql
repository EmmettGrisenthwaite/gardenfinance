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
