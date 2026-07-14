-- Garden Sanctuary: permanent, idempotent progress milestones.

CREATE TABLE IF NOT EXISTS public.garden_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('plan_step', 'goal')),
  source_key  text NOT NULL,
  label       text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, source_key)
);

CREATE INDEX IF NOT EXISTS idx_garden_milestones_user_earned
  ON public.garden_milestones(user_id, earned_at DESC);

ALTER TABLE public.garden_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own garden milestones" ON public.garden_milestones;
CREATE POLICY "Users read own garden milestones" ON public.garden_milestones
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON TABLE public.garden_milestones TO authenticated;

-- Existing completed work becomes permanent before the new client reads it.
INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
SELECT
  plan.user_id,
  'plan_step',
  CASE
    WHEN NULLIF(step.value->>'id', '') IS NOT NULL THEN 'step:' || (step.value->>'id')
    ELSE 'step:' || plan.id::text || ':' || (step.ordinality - 1)::text
  END,
  COALESCE(NULLIF(step.value->>'text', ''), 'Completed a plan step'),
  jsonb_build_object('planId', plan.id),
  CASE
    WHEN COALESCE(step.value->>'completedAt', '') ~ '^\d{4}-\d{2}-\d{2}T'
      THEN (step.value->>'completedAt')::timestamptz
    ELSE COALESCE(plan.updated_at, now())
  END
FROM public.advisor_plans plan
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(plan.steps, '[]'::jsonb)) WITH ORDINALITY AS step(value, ordinality)
WHERE plan.user_id IS NOT NULL
  AND lower(COALESCE(step.value->>'done', 'false')) IN ('true', 't', '1', 'yes')
ON CONFLICT (user_id, kind, source_key) DO NOTHING;

INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
SELECT
  goal.user_id,
  'goal',
  'goal:' || goal.id::text,
  COALESCE(NULLIF(goal.name, ''), 'Reached a goal'),
  jsonb_build_object('goalId', goal.id, 'goalType', COALESCE(goal.goal_type, 'savings')),
  COALESCE(goal.updated_at, now())
FROM public.goals goal
WHERE goal.user_id IS NOT NULL
  AND goal.target_amount > 0
  AND goal.current_amount >= goal.target_amount
ON CONFLICT (user_id, kind, source_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_garden_milestone(
  p_kind text,
  p_source_key text,
  p_label text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_earned_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_previous integer;
  v_total integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_kind NOT IN ('plan_step', 'goal') THEN RAISE EXCEPTION 'Invalid milestone kind'; END IF;
  IF NULLIF(trim(p_source_key), '') IS NULL THEN RAISE EXCEPTION 'Source key is required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT count(*) INTO v_previous FROM public.garden_milestones WHERE user_id = v_user_id;

  INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
  VALUES (
    v_user_id, p_kind, p_source_key,
    COALESCE(NULLIF(trim(p_label), ''), 'Earned a garden milestone'),
    COALESCE(p_metadata, '{}'::jsonb), COALESCE(p_earned_at, now())
  )
  ON CONFLICT (user_id, kind, source_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    UPDATE public.garden_milestones
    SET label = COALESCE(NULLIF(trim(p_label), ''), label),
        metadata = COALESCE(p_metadata, metadata)
    WHERE user_id = v_user_id AND kind = p_kind AND source_key = p_source_key;
  END IF;

  SELECT count(*) INTO v_total FROM public.garden_milestones WHERE user_id = v_user_id;
  RETURN jsonb_build_object(
    'inserted', v_id IS NOT NULL,
    'previousTotal', v_previous,
    'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_garden_milestones(p_events jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous integer;
  v_total integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_events) <> 'array' THEN RAISE EXCEPTION 'Events must be an array'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT count(*) INTO v_previous FROM public.garden_milestones WHERE user_id = v_user_id;

  INSERT INTO public.garden_milestones (user_id, kind, source_key, label, metadata, earned_at)
  SELECT
    v_user_id,
    event->>'kind',
    event->>'source_key',
    COALESCE(NULLIF(event->>'label', ''), 'Earned a garden milestone'),
    COALESCE(event->'metadata', '{}'::jsonb),
    CASE
      WHEN COALESCE(event->>'earned_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
        THEN (event->>'earned_at')::timestamptz
      ELSE now()
    END
  FROM jsonb_array_elements(p_events) AS rows(event)
  WHERE event->>'kind' IN ('plan_step', 'goal')
    AND NULLIF(trim(event->>'source_key'), '') IS NOT NULL
  ON CONFLICT (user_id, kind, source_key) DO UPDATE
    SET label = EXCLUDED.label,
        metadata = EXCLUDED.metadata;

  SELECT count(*) INTO v_total FROM public.garden_milestones WHERE user_id = v_user_id;
  RETURN jsonb_build_object(
    'inserted', v_total > v_previous,
    'previousTotal', v_previous,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_garden_milestone(text, text, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_garden_milestones(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_garden_milestone(text, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_garden_milestones(jsonb) TO authenticated;
