-- ============================================================
-- Run these in Supabase SQL Editor (in order)
-- ============================================================

-- 1. Add monthly_contribution to goals
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS monthly_contribution numeric(12,2) DEFAULT 0;

-- 2. Budget category limits
CREATE TABLE IF NOT EXISTS budget_limits (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category     text NOT NULL,
  monthly_limit numeric(12,2) NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, category)
);
ALTER TABLE budget_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own budget limits" ON budget_limits;
CREATE POLICY "Users manage own budget limits" ON budget_limits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Net worth snapshots (one row per user per day)
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assets      numeric(12,2) NOT NULL DEFAULT 0,
  liabilities numeric(12,2) NOT NULL DEFAULT 0,
  net_worth   numeric(12,2) NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own snapshots" ON net_worth_snapshots;
CREATE POLICY "Users manage own snapshots" ON net_worth_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Goal type — 'savings' or 'investment' (garden zone routing)
--    'savings'    → round green soil plot in the front zone
--    'investment' → hexagonal marble platform in the back (investment) zone
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'savings'
  CHECK (goal_type IN ('savings', 'investment'));

-- 5. Advisor memories — durable facts the advisor remembers across sessions
CREATE TABLE IF NOT EXISTS advisor_memories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fact        text NOT NULL,
  category    text NOT NULL DEFAULT 'other',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE advisor_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own advisor memories" ON advisor_memories;
CREATE POLICY "Users manage own advisor memories" ON advisor_memories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_advisor_memories_user_id ON advisor_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_memories_created_at ON advisor_memories(created_at DESC);
