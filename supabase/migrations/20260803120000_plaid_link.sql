-- Plaid bank-linking
--
-- Real bank accounts connect through Plaid. This migration is deliberately
-- paranoid about the one truly sensitive value it introduces: the Plaid
-- access_token, which is a bearer credential for the user's real bank data.
--
-- Design:
--   * plaid_items stores the access_token, but the `authenticated` Postgres
--     role is NEVER granted any privilege on this table — not SELECT, not
--     even via RLS. Only `service_role` (used exclusively by edge functions,
--     after they've verified the caller's JWT themselves) can touch it. RLS
--     is still enabled as defense-in-depth, but the missing GRANT is the real
--     wall: a client holding a valid user JWT still cannot query this table
--     directly through PostgREST.
--   * The client's only view into plaid_items is through
--     list_plaid_connections(), a SECURITY DEFINER function that returns
--     institution name and status but never the token, filtered to auth.uid().
--   * accounts/debts gain nullable link columns so a Plaid-synced record
--     looks and behaves exactly like a manual one everywhere else in the
--     app — Money, Plan, Advisor, reminders — none of which need to change.

CREATE TABLE IF NOT EXISTS public.plaid_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id               text NOT NULL,
  access_token          text NOT NULL,
  institution_id        text,
  institution_name      text,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'error', 'revoked')),
  error_code            text,
  transactions_cursor   text,
  last_synced_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
-- No CREATE POLICY here on purpose. With RLS enabled and zero policies, even
-- a role WITH a grant would see zero rows — but we also skip the grant below,
-- so `authenticated` has no path to this table at all.

-- Explicitly ensure PostgREST's default roles never got a grant on this table
-- (defensive — Supabase does not grant new tables to authenticated by
-- default, but this makes the intent unmissable to the next person editing
-- this file).
REVOKE ALL ON public.plaid_items FROM authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON public.plaid_items(user_id);

-- ── Link columns on accounts / debts ─────────────────────────────────────
-- A Plaid-synced record is a normal account/debt row with three extra facts:
-- which item it came from, Plaid's own id for it (for idempotent re-sync),
-- and when it was last refreshed. `source` lets the UI show a "Synced" badge
-- and, if useful later, soften the balance field to reflect it's automatic.

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS plaid_item_id uuid
  REFERENCES public.plaid_items(id) ON DELETE SET NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS plaid_account_id text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'plaid'));
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS plaid_item_id uuid
  REFERENCES public.plaid_items(id) ON DELETE SET NULL;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS plaid_account_id text;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'plaid'));
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- One Plaid account maps to at most one row per user — lets sync use a plain
-- upsert instead of a read-then-write race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_plaid_account
  ON public.accounts(user_id, plaid_account_id) WHERE plaid_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_debts_user_plaid_account
  ON public.debts(user_id, plaid_account_id) WHERE plaid_account_id IS NOT NULL;

-- ── Safe read surface for the client ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_plaid_connections()
RETURNS TABLE (
  id uuid, institution_name text, status text, error_code text,
  created_at timestamptz, last_synced_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, institution_name, status, error_code, created_at, last_synced_at
  FROM public.plaid_items
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_plaid_connections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_plaid_connections() TO authenticated;

-- ── Settings export/delete parity ────────────────────────────────────────
-- Every other user-owned table is included in the account-deletion sweep;
-- plaid_items must be too, or a deleted account leaves a live bank
-- connection (and a real Plaid billing line) behind. auth.users' ON DELETE
-- CASCADE already covers full account deletion; this index just keeps a
-- manual "remove my Plaid connections" cleanup query fast if Settings adds
-- one later.
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_status ON public.plaid_items(user_id, status);
