import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260814120000_dashboard_preferences.sql', import.meta.url)

test('dashboard preferences are additive, owner protected, revision aware, and capped', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.dashboard_preferences/i)
  assert.match(sql, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/i)
  assert.match(sql, /ALTER TABLE public\.dashboard_preferences ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /auth\.uid\(\) = user_id/i)
  assert.match(sql, /jsonb_array_length[\s\S]*<= 5/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_dashboard_layout/i)
  assert.match(sql, /DASHBOARD_LAYOUT_CONFLICT/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.set_dashboard_privacy/i)
  assert.match(sql, /SECURITY INVOKER/i)
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|cron\.|pg_cron/i)
})
