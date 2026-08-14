-- Customizable Home dashboard preferences.
-- Financial values stay in their canonical tables; this stores presentation only.

CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  layout           jsonb NOT NULL DEFAULT '{"version":1,"widgets":[]}'::jsonb,
  layout_revision  integer NOT NULL DEFAULT 1 CHECK (layout_revision > 0),
  hide_amounts     boolean NOT NULL DEFAULT false,
  schema_version   integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(layout) = 'object'),
  CHECK (jsonb_typeof(COALESCE(layout->'widgets', '[]'::jsonb)) = 'array'),
  CHECK (jsonb_array_length(COALESCE(layout->'widgets', '[]'::jsonb)) <= 5)
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own dashboard preferences" ON public.dashboard_preferences;
CREATE POLICY "Users manage own dashboard preferences" ON public.dashboard_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_preferences TO authenticated;

CREATE OR REPLACE FUNCTION public.save_dashboard_layout(
  p_layout jsonb,
  p_expected_revision integer DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS public.dashboard_preferences
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.dashboard_preferences;
  v_saved public.dashboard_preferences;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'object' THEN
    RAISE EXCEPTION 'Dashboard layout must be an object';
  END IF;
  IF jsonb_typeof(COALESCE(p_layout->'widgets', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Dashboard widgets must be an array';
  END IF;
  IF jsonb_array_length(COALESCE(p_layout->'widgets', '[]'::jsonb)) > 5 THEN
    RAISE EXCEPTION 'Dashboard supports at most five widgets';
  END IF;

  SELECT * INTO v_existing
  FROM public.dashboard_preferences
  WHERE user_id = v_user
  FOR UPDATE;

  IF v_existing.user_id IS NULL THEN
    INSERT INTO public.dashboard_preferences (user_id, layout, layout_revision, schema_version)
    VALUES (v_user, p_layout, 1, COALESCE((p_layout->>'version')::integer, 1))
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_saved;

    IF v_saved.user_id IS NOT NULL THEN
      RETURN v_saved;
    END IF;

    SELECT * INTO v_existing
    FROM public.dashboard_preferences
    WHERE user_id = v_user
    FOR UPDATE;
  END IF;

  IF v_existing.user_id IS NOT NULL THEN
    IF NOT p_force AND p_expected_revision IS DISTINCT FROM v_existing.layout_revision THEN
      RAISE EXCEPTION 'DASHBOARD_LAYOUT_CONFLICT'
        USING ERRCODE = '40001', DETAIL = v_existing.layout_revision::text;
    END IF;
    UPDATE public.dashboard_preferences SET
      layout = p_layout,
      layout_revision = layout_revision + 1,
      schema_version = COALESCE((p_layout->>'version')::integer, schema_version),
      updated_at = now()
    WHERE user_id = v_user
    RETURNING * INTO v_saved;
  END IF;

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_dashboard_privacy(p_hide_amounts boolean)
RETURNS public.dashboard_preferences
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_saved public.dashboard_preferences;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.dashboard_preferences (user_id, hide_amounts)
  VALUES (v_user, COALESCE(p_hide_amounts, false))
  ON CONFLICT (user_id) DO UPDATE SET
    hide_amounts = EXCLUDED.hide_amounts,
    updated_at = now()
  RETURNING * INTO v_saved;
  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_dashboard_layout(jsonb, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_dashboard_privacy(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_dashboard_layout(jsonb, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_dashboard_privacy(boolean) TO authenticated;
