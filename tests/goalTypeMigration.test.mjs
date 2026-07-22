import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260722120000_goal_type_purchase.sql', import.meta.url)
const bootstrapUrl = new URL('../supabase/migrations.sql', import.meta.url)

test('goal_type migration widens the check constraint to include purchase', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /DROP CONSTRAINT IF EXISTS goals_goal_type_check/i)
  assert.match(sql, /CHECK \(goal_type IN \('savings', 'investment', 'purchase'\)\)/i)
  // Additive only — never destructive to user data.
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i)
})

test('bootstrap schema keeps the three goal types in sync', async () => {
  const sql = await readFile(bootstrapUrl, 'utf8')
  assert.match(sql, /CHECK \(goal_type IN \('savings', 'investment', 'purchase'\)\)/i)
})
