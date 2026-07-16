-- Progress Memory Loop
-- Structured, idempotent records connecting completed Plan work to Money,
-- Home, and Advisor context. All changes are additive.

CREATE TABLE IF NOT EXISTS public.financial_activities (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                uuid REFERENCES public.advisor_plans(id) ON DELETE SET NULL,
  step_id                text,
  source_key             text NOT NULL,
  label                  text NOT NULL,
  intent_key             text,
  completion_policy      text NOT NULL DEFAULT 'once'
                         CHECK (completion_policy IN ('once', 'repeatable')),
  kind                   text NOT NULL DEFAULT 'information'
                         CHECK (kind IN ('transfer', 'contribution', 'debt_payment', 'recurring_setup', 'account_opening', 'information')),
  status                 text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'applied', 'recorded', 'dismissed')),
  amount                 numeric(14,2),
  recurrence             text,
  source_account_id      uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  destination_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  debt_id                uuid REFERENCES public.debts(id) ON DELETE SET NULL,
  goal_id                uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  before_state           jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state            jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_seen_at         timestamptz,
  applied_at             timestamptz,
  dismissed_at           timestamptz,
  exclude_from_advisor   boolean NOT NULL DEFAULT false,
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_financial_activities_user_recent
  ON public.financial_activities(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_activities_user_intent
  ON public.financial_activities(user_id, intent_key);

ALTER TABLE public.financial_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own financial activities" ON public.financial_activities;
CREATE POLICY "Users manage own financial activities" ON public.financial_activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_activities TO authenticated;

-- Existing completed steps become quiet history, never surprise prompts.
INSERT INTO public.financial_activities (
  user_id, plan_id, step_id, source_key, label, intent_key,
  completion_policy, kind, status, prompt_seen_at, occurred_at, metadata
)
SELECT
  plan.user_id,
  plan.id,
  NULLIF(step.value->>'id', ''),
  'plan:' || plan.id::text || ':step:' || COALESCE(NULLIF(step.value->>'id', ''), md5(step.value->>'text')),
  COALESCE(NULLIF(step.value->>'text', ''), 'Completed plan step'),
  NULLIF(step.value->>'intentKey', ''),
  CASE WHEN step.value->>'completionPolicy' = 'repeatable' THEN 'repeatable' ELSE 'once' END,
  'information',
  'recorded',
  now(),
  COALESCE(plan.updated_at, now()),
  jsonb_build_object('legacy', true)
FROM public.advisor_plans plan
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(plan.steps, '[]'::jsonb)) step(value)
WHERE COALESCE((step.value->>'done')::boolean, false)
ON CONFLICT (user_id, source_key) DO NOTHING;

-- Durable conversation memories gain stable identity and provenance while
-- preserving the existing fact/category interface.
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS memory_key text;
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS subject_key text NOT NULL DEFAULT '';
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'conversation';
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS confidence numeric(4,3) NOT NULL DEFAULT 0.8;
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz;
ALTER TABLE public.advisor_memories ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.advisor_memories
SET memory_key = 'legacy:' || id::text,
    last_confirmed_at = COALESCE(last_confirmed_at, updated_at, created_at)
WHERE memory_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisor_memories_stable_key
  ON public.advisor_memories(user_id, memory_key, subject_key);

CREATE OR REPLACE FUNCTION public.record_financial_activity(p_activity jsonb)
RETURNS public.financial_activities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.financial_activities;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  INSERT INTO public.financial_activities (
    user_id, plan_id, step_id, source_key, label, intent_key,
    completion_policy, kind, status, amount, recurrence,
    source_account_id, destination_account_id, debt_id, goal_id,
    metadata, occurred_at
  ) VALUES (
    v_user,
    NULLIF(p_activity->>'plan_id', '')::uuid,
    NULLIF(p_activity->>'step_id', ''),
    p_activity->>'source_key',
    COALESCE(NULLIF(p_activity->>'label', ''), 'Completed plan step'),
    NULLIF(p_activity->>'intent_key', ''),
    CASE WHEN p_activity->>'completion_policy' = 'repeatable' THEN 'repeatable' ELSE 'once' END,
    CASE WHEN p_activity->>'kind' IN ('transfer', 'contribution', 'debt_payment', 'recurring_setup', 'account_opening')
      THEN p_activity->>'kind' ELSE 'information' END,
    CASE WHEN p_activity->>'kind' = 'information' THEN 'recorded' ELSE 'pending' END,
    NULLIF(p_activity->>'amount', '')::numeric,
    NULLIF(p_activity->>'recurrence', ''),
    NULLIF(p_activity->>'source_account_id', '')::uuid,
    NULLIF(p_activity->>'destination_account_id', '')::uuid,
    NULLIF(p_activity->>'debt_id', '')::uuid,
    NULLIF(p_activity->>'goal_id', '')::uuid,
    COALESCE(p_activity->'metadata', '{}'::jsonb),
    COALESCE(NULLIF(p_activity->>'occurred_at', '')::timestamptz, now())
  )
  ON CONFLICT (user_id, source_key) DO UPDATE SET
    label = EXCLUDED.label,
    intent_key = COALESCE(public.financial_activities.intent_key, EXCLUDED.intent_key),
    metadata = public.financial_activities.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_financial_activity(
  p_activity_id uuid,
  p_disposition text DEFAULT 'seen'
)
RETURNS public.financial_activities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_row public.financial_activities;
BEGIN
  UPDATE public.financial_activities
  SET prompt_seen_at = COALESCE(prompt_seen_at, now()),
      status = CASE
        WHEN p_disposition = 'dismissed' THEN 'dismissed'
        WHEN p_disposition = 'recorded' AND status = 'pending' THEN 'recorded'
        ELSE status END,
      dismissed_at = CASE WHEN p_disposition = 'dismissed' THEN now() ELSE dismissed_at END,
      exclude_from_advisor = CASE WHEN p_disposition = 'exclude' THEN true ELSE exclude_from_advisor END,
      updated_at = now()
  WHERE id = p_activity_id AND user_id = auth.uid()
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Activity not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_financial_activity(
  p_activity_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_activity public.financial_activities;
  v_update jsonb;
  v_entity text;
  v_id uuid;
  v_before numeric;
  v_after numeric;
  v_current numeric;
BEGIN
  SELECT * INTO v_activity FROM public.financial_activities
  WHERE id = p_activity_id AND user_id = auth.uid() FOR UPDATE;
  IF v_activity.id IS NULL THEN RAISE EXCEPTION 'Activity not found'; END IF;

  IF v_activity.status = 'applied' THEN
    RETURN jsonb_build_object('activity', to_jsonb(v_activity), 'idempotent', true);
  END IF;

  IF jsonb_typeof(COALESCE(p_payload->'updates', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid financial updates';
  END IF;
  IF jsonb_array_length(COALESCE(p_payload->'updates', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one financial record update is required';
  END IF;

  FOR v_update IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'updates', '[]'::jsonb))
  LOOP
    v_entity := v_update->>'entity';
    v_id := NULLIF(v_update->>'id', '')::uuid;
    v_before := (v_update->>'before')::numeric;
    v_after := (v_update->>'after')::numeric;
    IF v_after < 0 THEN RAISE EXCEPTION 'A resulting balance cannot be negative'; END IF;

    IF v_entity = 'account' THEN
      SELECT balance INTO v_current FROM public.accounts
      WHERE id = v_id AND user_id = auth.uid() FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
      IF abs(v_current - v_before) > 0.005 THEN
        RAISE EXCEPTION 'STALE_FINANCIAL_STATE' USING DETAIL = 'An account balance changed before this update was applied.';
      END IF;
      UPDATE public.accounts SET balance = v_after, last_verified_at = CURRENT_DATE, updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_entity = 'debt' THEN
      SELECT balance INTO v_current FROM public.debts
      WHERE id = v_id AND user_id = auth.uid() FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Debt not found'; END IF;
      IF abs(v_current - v_before) > 0.005 THEN
        RAISE EXCEPTION 'STALE_FINANCIAL_STATE' USING DETAIL = 'A debt balance changed before this update was applied.';
      END IF;
      UPDATE public.debts SET balance = v_after, last_verified_at = CURRENT_DATE, updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_entity = 'goal' THEN
      SELECT current_amount INTO v_current FROM public.goals
      WHERE id = v_id AND user_id = auth.uid() FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
      IF abs(v_current - v_before) > 0.005 THEN
        RAISE EXCEPTION 'STALE_FINANCIAL_STATE' USING DETAIL = 'Goal progress changed before this update was applied.';
      END IF;
      UPDATE public.goals SET current_amount = v_after, updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSE
      RAISE EXCEPTION 'Unsupported financial entity';
    END IF;
  END LOOP;

  UPDATE public.financial_activities SET
    status = 'applied',
    amount = COALESCE(NULLIF(p_payload->>'amount', '')::numeric, amount),
    source_account_id = COALESCE(NULLIF(p_payload->>'source_account_id', '')::uuid, source_account_id),
    destination_account_id = COALESCE(NULLIF(p_payload->>'destination_account_id', '')::uuid, destination_account_id),
    debt_id = COALESCE(NULLIF(p_payload->>'debt_id', '')::uuid, debt_id),
    goal_id = COALESCE(NULLIF(p_payload->>'goal_id', '')::uuid, goal_id),
    before_state = COALESCE(p_payload->'before_state', '{}'::jsonb),
    after_state = COALESCE(p_payload->'after_state', '{}'::jsonb),
    prompt_seen_at = COALESCE(prompt_seen_at, now()),
    applied_at = now(),
    updated_at = now()
  WHERE id = p_activity_id AND user_id = auth.uid()
  RETURNING * INTO v_activity;

  RETURN jsonb_build_object(
    'activity', to_jsonb(v_activity),
    'accounts', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.accounts a WHERE a.user_id = auth.uid()), '[]'::jsonb),
    'debts', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.debts d WHERE d.user_id = auth.uid()), '[]'::jsonb),
    'goals', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM public.goals g WHERE g.user_id = auth.uid()), '[]'::jsonb),
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_advisor_memory(
  p_fact text,
  p_category text,
  p_memory_key text,
  p_subject_key text DEFAULT '',
  p_source text DEFAULT 'conversation',
  p_confidence numeric DEFAULT 0.8,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.advisor_memories
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_row public.advisor_memories;
BEGIN
  INSERT INTO public.advisor_memories (
    user_id, fact, category, memory_key, subject_key, source,
    status, confidence, last_confirmed_at, metadata
  ) VALUES (
    auth.uid(), trim(p_fact), p_category, p_memory_key, COALESCE(p_subject_key, ''),
    p_source, 'active', LEAST(1, GREATEST(0, p_confidence)), now(), COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, memory_key, subject_key) DO UPDATE SET
    fact = EXCLUDED.fact,
    category = EXCLUDED.category,
    source = EXCLUDED.source,
    status = 'active',
    confidence = EXCLUDED.confidence,
    last_confirmed_at = now(),
    metadata = public.advisor_memories.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_financial_activity(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_financial_activity(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_financial_activity(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_advisor_memory(text, text, text, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_financial_activity(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_financial_activity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_financial_activity(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_advisor_memory(text, text, text, text, text, numeric, jsonb) TO authenticated;
