import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260721150000_goals_routines.sql', import.meta.url)

test('reminder migration is additive, owner protected, and RPC driven', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.reminders/i)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.reminder_events/i)
  assert.match(sql, /ALTER TABLE public\.reminders ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /ALTER TABLE public\.reminder_events ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /reminder\.user_id = auth\.uid\(\)/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.approve_reminder_candidate/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_reminder/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.act_on_reminder/i)
  assert.match(sql, /STALE_REMINDER_STATE/i)
  assert.match(sql, /UNIQUE \(user_id, source_key\)/i)
  assert.match(sql, /SECURITY INVOKER/i)
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|cron\.|pg_cron/i)
})
test('database recurrence preserves anchored weekly and quarterly schedules', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reminder_next_occurrence/i)
  assert.match(sql, /p_anchor \+ \(\(v_elapsed \/ 7\) \+ 1\) \* 7/i)
  assert.match(sql, /make_interval\(months => v_iteration \* 3\)/i)
  assert.match(sql, /LEAST\(extract\(day FROM p_anchor\).*extract\(day FROM v_month_end\)/is)
})
