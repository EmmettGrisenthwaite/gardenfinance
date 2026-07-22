-- Allow Purchase goals.
--
-- The Goals & Routines feature added a third goal type ('purchase') in the app,
-- but production still carried the original CHECK constraint that only allowed
-- 'savings' and 'investment'. Saving a Purchase goal therefore failed with a
-- 23514 check-constraint violation. This widens the constraint to include
-- 'purchase' without rejecting any currently-valid rows.
--
-- Idempotent and additive: safe to run against the existing project in the
-- Supabase SQL Editor. No data is deleted.

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_goal_type_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_goal_type_check
  CHECK (goal_type IN ('savings', 'investment', 'purchase'));
