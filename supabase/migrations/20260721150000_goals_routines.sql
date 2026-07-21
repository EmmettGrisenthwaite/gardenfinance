-- Goals & Routines
-- In-app weekly and quarterly check-ins with deterministic suggestions,
-- anchored recurrence, append-only history, and owner-only access.

CREATE TABLE IF NOT EXISTS public.reminders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                  text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  detail                 text,
  cadence                text NOT NULL CHECK (cadence IN ('weekly', 'quarterly')),
  anchor_date            date NOT NULL,
  next_due_on            date NOT NULL,
  snoozed_until          date,
  source                 text NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('manual', 'automatic')),
  status                 text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'paused', 'dismissed', 'archived')),
  candidate_key          text,
  source_fingerprint     text,
  linked_record_type     text
                         CHECK (linked_record_type IS NULL OR linked_record_type IN (
                           'goal', 'account', 'debt', 'monthly_plan', 'money_records', 'profile'
                         )),
  linked_record_id       uuid,
  user_edited            boolean NOT NULL DEFAULT false,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  archived_at            timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_user_candidate
  ON public.reminders(user_id, candidate_key)
  WHERE candidate_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_user_due
  ON public.reminders(user_id, status, next_due_on);

CREATE TABLE IF NOT EXISTS public.reminder_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id            uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for          date NOT NULL,
  action                 text NOT NULL CHECK (action IN ('done', 'skipped', 'snoozed')),
  snoozed_until          date,
  source_key             text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_reminder_events_user_recent
  ON public.reminder_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_events_reminder
  ON public.reminder_events(reminder_id, scheduled_for DESC);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reminders" ON public.reminders;
CREATE POLICY "Users manage own reminders" ON public.reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own reminder events" ON public.reminder_events;
CREATE POLICY "Users manage own reminder events" ON public.reminder_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reminders reminder
      WHERE reminder.id = reminder_id AND reminder.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_events TO authenticated;

CREATE OR REPLACE FUNCTION public.reminder_next_occurrence(
  p_anchor date,
  p_cadence text,
  p_after date
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_elapsed integer;
  v_iteration integer := 0;
  v_month_start date;
  v_month_end date;
  v_candidate date;
BEGIN
  IF p_anchor IS NULL OR p_after IS NULL OR p_cadence NOT IN ('weekly', 'quarterly') THEN
    RETURN NULL;
  END IF;
  IF p_anchor > p_after THEN RETURN p_anchor; END IF;

  IF p_cadence = 'weekly' THEN
    v_elapsed := p_after - p_anchor;
    RETURN p_anchor + ((v_elapsed / 7) + 1) * 7;
  END IF;

  LOOP
    v_iteration := v_iteration + 1;
    v_month_start := (date_trunc('month', p_anchor)::date + make_interval(months => v_iteration * 3))::date;
    v_month_end := (v_month_start + interval '1 month - 1 day')::date;
    v_candidate := make_date(
      extract(year FROM v_month_start)::integer,
      extract(month FROM v_month_start)::integer,
      LEAST(extract(day FROM p_anchor)::integer, extract(day FROM v_month_end)::integer)
    );
    EXIT WHEN v_candidate > p_after;
  END LOOP;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_reminder_candidate(p_candidate jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.reminders;
  v_existing public.reminders;
  v_key text := NULLIF(trim(p_candidate->>'candidate_key'), '');
  v_title text := NULLIF(trim(p_candidate->>'title'), '');
  v_cadence text := p_candidate->>'cadence';
  v_anchor date := NULLIF(p_candidate->>'anchor_date', '')::date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_key IS NULL OR v_title IS NULL THEN RAISE EXCEPTION 'Candidate key and title are required'; END IF;
  IF v_cadence NOT IN ('weekly', 'quarterly') THEN RAISE EXCEPTION 'Invalid reminder cadence'; END IF;
  IF v_anchor IS NULL THEN RAISE EXCEPTION 'First reminder date is required'; END IF;

  SELECT * INTO v_existing
  FROM public.reminders
  WHERE user_id = v_user AND candidate_key = v_key
  FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.status IN ('active', 'paused', 'archived') THEN
    RETURN jsonb_build_object('reminder', to_jsonb(v_existing), 'idempotent', true);
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.reminders SET
      title = v_title,
      detail = NULLIF(trim(p_candidate->>'detail'), ''),
      cadence = v_cadence,
      anchor_date = v_anchor,
      next_due_on = v_anchor,
      snoozed_until = NULL,
      source = 'automatic',
      status = 'active',
      source_fingerprint = NULLIF(p_candidate->>'source_fingerprint', ''),
      linked_record_type = NULLIF(p_candidate->>'linked_record_type', ''),
      linked_record_id = NULLIF(p_candidate->>'linked_record_id', '')::uuid,
      user_edited = COALESCE((p_candidate->>'user_edited')::boolean, false),
      metadata = COALESCE(p_candidate->'metadata', '{}'::jsonb),
      archived_at = NULL,
      updated_at = now()
    WHERE id = v_existing.id AND user_id = v_user
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.reminders (
      user_id, title, detail, cadence, anchor_date, next_due_on,
      source, status, candidate_key, source_fingerprint,
      linked_record_type, linked_record_id, user_edited, metadata
    ) VALUES (
      v_user, v_title, NULLIF(trim(p_candidate->>'detail'), ''), v_cadence, v_anchor, v_anchor,
      'automatic', 'active', v_key, NULLIF(p_candidate->>'source_fingerprint', ''),
      NULLIF(p_candidate->>'linked_record_type', ''), NULLIF(p_candidate->>'linked_record_id', '')::uuid,
      COALESCE((p_candidate->>'user_edited')::boolean, false),
      COALESCE(p_candidate->'metadata', '{}'::jsonb)
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('reminder', to_jsonb(v_row), 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_reminder_candidate(p_candidate jsonb)
RETURNS public.reminders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.reminders;
  v_key text := NULLIF(trim(p_candidate->>'candidate_key'), '');
  v_title text := COALESCE(NULLIF(trim(p_candidate->>'title'), ''), 'Suggested reminder');
  v_cadence text := p_candidate->>'cadence';
  v_anchor date := COALESCE(NULLIF(p_candidate->>'anchor_date', '')::date, CURRENT_DATE);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_key IS NULL OR v_cadence NOT IN ('weekly', 'quarterly') THEN
    RAISE EXCEPTION 'Valid candidate key and cadence are required';
  END IF;

  INSERT INTO public.reminders (
    user_id, title, detail, cadence, anchor_date, next_due_on,
    source, status, candidate_key, source_fingerprint,
    linked_record_type, linked_record_id, metadata
  ) VALUES (
    v_user, v_title, NULLIF(trim(p_candidate->>'detail'), ''), v_cadence, v_anchor, v_anchor,
    'automatic', 'dismissed', v_key, NULLIF(p_candidate->>'source_fingerprint', ''),
    NULLIF(p_candidate->>'linked_record_type', ''), NULLIF(p_candidate->>'linked_record_id', '')::uuid,
    COALESCE(p_candidate->'metadata', '{}'::jsonb)
  )
  ON CONFLICT (user_id, candidate_key) WHERE candidate_key IS NOT NULL DO UPDATE SET
    title = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.title ELSE public.reminders.title END,
    detail = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.detail ELSE public.reminders.detail END,
    source_fingerprint = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.source_fingerprint ELSE public.reminders.source_fingerprint END,
    linked_record_type = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.linked_record_type ELSE public.reminders.linked_record_type END,
    linked_record_id = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.linked_record_id ELSE public.reminders.linked_record_id END,
    metadata = CASE WHEN public.reminders.status = 'dismissed' THEN EXCLUDED.metadata ELSE public.reminders.metadata END,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_reminder(p_reminder jsonb)
RETURNS public.reminders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid := NULLIF(p_reminder->>'id', '')::uuid;
  v_title text := NULLIF(trim(p_reminder->>'title'), '');
  v_cadence text := p_reminder->>'cadence';
  v_anchor date := NULLIF(p_reminder->>'anchor_date', '')::date;
  v_row public.reminders;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_title IS NULL THEN RAISE EXCEPTION 'Reminder title is required'; END IF;
  IF v_cadence NOT IN ('weekly', 'quarterly') THEN RAISE EXCEPTION 'Invalid reminder cadence'; END IF;
  IF v_anchor IS NULL THEN RAISE EXCEPTION 'First reminder date is required'; END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.reminders (
      user_id, title, detail, cadence, anchor_date, next_due_on,
      source, status, linked_record_type, linked_record_id, user_edited, metadata
    ) VALUES (
      v_user, v_title, NULLIF(trim(p_reminder->>'detail'), ''), v_cadence, v_anchor, v_anchor,
      'manual', 'active', NULLIF(p_reminder->>'linked_record_type', ''),
      NULLIF(p_reminder->>'linked_record_id', '')::uuid, true,
      COALESCE(p_reminder->'metadata', '{}'::jsonb)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.reminders SET
      title = v_title,
      detail = NULLIF(trim(p_reminder->>'detail'), ''),
      cadence = v_cadence,
      anchor_date = v_anchor,
      next_due_on = CASE
        WHEN cadence <> v_cadence OR anchor_date <> v_anchor THEN
          CASE WHEN v_anchor >= CURRENT_DATE THEN v_anchor
               ELSE public.reminder_next_occurrence(v_anchor, v_cadence, CURRENT_DATE) END
        ELSE next_due_on END,
      snoozed_until = CASE WHEN cadence <> v_cadence OR anchor_date <> v_anchor THEN NULL ELSE snoozed_until END,
      linked_record_type = NULLIF(p_reminder->>'linked_record_type', ''),
      linked_record_id = NULLIF(p_reminder->>'linked_record_id', '')::uuid,
      user_edited = true,
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_reminder->'metadata', '{}'::jsonb),
      updated_at = now()
    WHERE id = v_id AND user_id = v_user AND status <> 'archived'
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Reminder not found or archived'; END IF;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_reminder_status(
  p_reminder_id uuid,
  p_status text,
  p_metadata_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS public.reminders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_row public.reminders;
BEGIN
  IF p_status NOT IN ('active', 'paused', 'archived') THEN
    RAISE EXCEPTION 'Invalid reminder status';
  END IF;
  UPDATE public.reminders SET
    status = p_status,
    snoozed_until = CASE WHEN p_status = 'active' THEN snoozed_until ELSE NULL END,
    archived_at = CASE WHEN p_status = 'archived' THEN now() ELSE archived_at END,
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata_patch, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_reminder_id AND user_id = auth.uid()
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Reminder not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.act_on_reminder(
  p_reminder_id uuid,
  p_expected_due_on date,
  p_action text,
  p_snoozed_until date DEFAULT NULL,
  p_source_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reminder public.reminders;
  v_event public.reminder_events;
  v_source_key text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_action NOT IN ('done', 'skipped', 'snoozed') THEN RAISE EXCEPTION 'Invalid reminder action'; END IF;
  IF p_expected_due_on IS NULL THEN RAISE EXCEPTION 'Expected due date is required'; END IF;
  IF p_action = 'snoozed' AND (p_snoozed_until IS NULL OR p_snoozed_until <= CURRENT_DATE) THEN
    RAISE EXCEPTION 'Snooze date must be after today';
  END IF;

  v_source_key := COALESCE(NULLIF(p_source_key, ''),
    p_reminder_id::text || ':' || p_expected_due_on::text || ':' || p_action || ':' || COALESCE(p_snoozed_until::text, ''));

  SELECT * INTO v_event
  FROM public.reminder_events
  WHERE user_id = v_user AND source_key = v_source_key;
  IF v_event.id IS NOT NULL THEN
    SELECT * INTO v_reminder FROM public.reminders
    WHERE id = p_reminder_id AND user_id = v_user;
    RETURN jsonb_build_object('reminder', to_jsonb(v_reminder), 'event', to_jsonb(v_event), 'idempotent', true);
  END IF;

  SELECT * INTO v_reminder
  FROM public.reminders
  WHERE id = p_reminder_id AND user_id = v_user
  FOR UPDATE;
  IF v_reminder.id IS NULL THEN RAISE EXCEPTION 'Reminder not found'; END IF;
  IF v_reminder.status <> 'active' THEN RAISE EXCEPTION 'Reminder is not active'; END IF;
  IF v_reminder.next_due_on <> p_expected_due_on THEN
    RAISE EXCEPTION 'STALE_REMINDER_STATE' USING DETAIL = 'The reminder schedule changed before this action was saved.';
  END IF;

  INSERT INTO public.reminder_events (
    reminder_id, user_id, scheduled_for, action, snoozed_until, source_key
  ) VALUES (
    v_reminder.id, v_user, v_reminder.next_due_on, p_action,
    CASE WHEN p_action = 'snoozed' THEN p_snoozed_until ELSE NULL END,
    v_source_key
  )
  RETURNING * INTO v_event;

  IF p_action = 'snoozed' THEN
    UPDATE public.reminders SET snoozed_until = p_snoozed_until, updated_at = now()
    WHERE id = v_reminder.id AND user_id = v_user
    RETURNING * INTO v_reminder;
  ELSE
    UPDATE public.reminders SET
      next_due_on = public.reminder_next_occurrence(anchor_date, cadence, CURRENT_DATE),
      snoozed_until = NULL,
      updated_at = now()
    WHERE id = v_reminder.id AND user_id = v_user
    RETURNING * INTO v_reminder;
  END IF;

  RETURN jsonb_build_object('reminder', to_jsonb(v_reminder), 'event', to_jsonb(v_event), 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.reminder_next_occurrence(date, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_reminder_candidate(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_reminder_candidate(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_reminder(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_reminder_status(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.act_on_reminder(uuid, date, text, date, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reminder_next_occurrence(date, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_reminder_candidate(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_reminder_candidate(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_reminder(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reminder_status(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_reminder(uuid, date, text, date, text) TO authenticated;
