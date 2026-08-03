import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/20260803120000_plaid_link.sql', import.meta.url)
const bootstrapUrl = new URL('../supabase/migrations.sql', import.meta.url)

test('plaid_items is additive and never grants the access_token to authenticated', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.plaid_items/i)
  assert.match(sql, /access_token\s+text NOT NULL/i)
  assert.match(sql, /ALTER TABLE public\.plaid_items ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /REVOKE ALL ON public\.plaid_items FROM authenticated, anon/i)
  // No CREATE POLICY on plaid_items — the missing grant is the wall, not RLS.
  // (Matches the real DDL shape used elsewhere, e.g. `CREATE POLICY "..." ON
  // public.accounts`, so a mention of "CREATE POLICY" in a comment above an
  // unrelated plaid_items statement can't produce a false positive.)
  assert.doesNotMatch(sql, /CREATE POLICY\s+"[^"]*"\s+ON public\.plaid_items/i)
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i)
})

test('the client can only read plaid connections through a token-free RPC', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.list_plaid_connections/i)
  assert.match(sql, /SECURITY DEFINER/i)
  assert.match(sql, /WHERE user_id = auth\.uid\(\)/i)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.list_plaid_connections\(\) TO authenticated/i)
  // The RPC's declared return columns must exclude access_token.
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.list_plaid_connections[\s\S]*?\$\$;/i)[0]
  assert.doesNotMatch(fn, /access_token/i)
})

test('accounts and debts gain nullable Plaid link columns with idempotent sync keys', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  for (const table of ['accounts', 'debts']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS plaid_item_id uuid`, 'i'))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS plaid_account_id text`, 'i'))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'`, 'i'))
    assert.match(sql, new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_user_plaid_account`, 'i'))
  }
})

test('the bootstrap SQL editor script stays in sync with the migration', async () => {
  const sql = await readFile(bootstrapUrl, 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.plaid_items/i)
  assert.match(sql, /REVOKE ALL ON public\.plaid_items FROM authenticated, anon/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.list_plaid_connections/i)
  assert.match(sql, /idx_accounts_user_plaid_account/i)
  assert.match(sql, /idx_debts_user_plaid_account/i)
})
