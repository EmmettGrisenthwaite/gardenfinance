// Supabase Edge Function: `plaid-sync`
// Refreshes balances (and liability detail) for one linked institution, or
// all of the caller's institutions when `item_id` is omitted. `item_id` here
// is our own plaid_items.id (a uuid) — the same id list_plaid_connections()
// returns to the client — never Plaid's own item_id, which the client never
// sees.
//
// One failed institution (e.g. the user changed their bank password) does
// not fail the whole sync — it's recorded on that item and the rest proceed.

import {
  corsHeaders, json, plaidFetch, plaidNotConfigured, requireUser, serviceClient,
  PLAID_CLIENT_ID, PLAID_SECRET,
} from '../_shared/plaidClient.ts'
import { mapPlaidAccounts } from '../_shared/plaidMapping.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return plaidNotConfigured()

  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const { user } = auth

  let payload: { item_id?: string } = {}
  try {
    payload = await req.json()
  } catch {
    // A body isn't required to sync everything.
  }

  const db = serviceClient()
  let itemsQuery = db.from('plaid_items').select('*').eq('user_id', user.id)
  if (payload.item_id) itemsQuery = itemsQuery.eq('id', payload.item_id)
  const { data: items, error: itemsError } = await itemsQuery
  if (itemsError) return json({ error: itemsError.message }, 500)
  if (!items?.length) return json({ error: 'No linked bank connections found.' }, 404)

  let synced = 0
  const errors: Array<{ institution_name: string | null; code: string | null }> = []

  for (const item of items) {
    try {
      const accountsData = await plaidFetch('/accounts/get', { access_token: item.access_token })
      let liabilities: Record<string, unknown> = {}
      try {
        const liabilitiesData = await plaidFetch('/liabilities/get', { access_token: item.access_token })
        liabilities = liabilitiesData.liabilities || {}
      } catch {
        // Product not supported by this institution — balances still sync.
      }

      const { accounts, debts } = mapPlaidAccounts(accountsData.accounts || [], {
        institutionName: item.institution_name, liabilities,
      })
      const stamp = (row: Record<string, unknown>) => ({ ...row, user_id: user.id, plaid_item_id: item.id })

      if (accounts.length) {
        const { error } = await db.from('accounts').upsert(accounts.map(stamp), { onConflict: 'user_id,plaid_account_id' })
        if (error) throw error
      }
      if (debts.length) {
        const { error } = await db.from('debts').upsert(debts.map(stamp), { onConflict: 'user_id,plaid_account_id' })
        if (error) throw error
      }

      await db.from('plaid_items').update({
        status: 'active', error_code: null, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      synced += 1
    } catch (caught) {
      const code = caught?.code || 'SYNC_FAILED'
      await db.from('plaid_items').update({
        status: 'error', error_code: code, updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      errors.push({ institution_name: item.institution_name, code })
    }
  }

  return json({ synced, errors })
})
