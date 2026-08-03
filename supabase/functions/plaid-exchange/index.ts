// Supabase Edge Function: `plaid-exchange`
// Finishes a Plaid Link session: exchanges the short-lived public_token for a
// permanent access_token, stores it (service-role only — see
// supabase/functions/_shared/plaidClient.ts), then pulls the institution's
// accounts and liabilities and writes them into accounts/debts so the rest of
// the app (Money, Plan, Advisor, reminders) sees them immediately as normal
// records.

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

  let payload: { public_token?: string; institution_id?: string; institution_name?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const publicToken = payload.public_token
  if (!publicToken || typeof publicToken !== 'string') {
    return json({ error: 'public_token is required' }, 400)
  }

  const db = serviceClient()

  try {
    const exchanged = await plaidFetch('/item/public_token/exchange', { public_token: publicToken })
    const accessToken: string = exchanged.access_token
    const itemId: string = exchanged.item_id
    const institutionId = payload.institution_id || null
    const institutionName = payload.institution_name || null

    const { data: itemRow, error: itemError } = await db.from('plaid_items')
      .upsert({
        user_id: user.id, item_id: itemId, access_token: accessToken,
        institution_id: institutionId, institution_name: institutionName,
        status: 'active', error_code: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,item_id' })
      .select('id').single()
    if (itemError) throw itemError

    // Pull the initial balances now, so the user sees real numbers the
    // instant Link closes instead of an empty account list.
    const accountsData = await plaidFetch('/accounts/get', { access_token: accessToken })
    let liabilities: Record<string, unknown> = {}
    try {
      const liabilitiesData = await plaidFetch('/liabilities/get', { access_token: accessToken })
      liabilities = liabilitiesData.liabilities || {}
    } catch {
      // Not every institution supports the liabilities product — that's
      // expected, not an error. Balances alone are still useful.
    }

    const { accounts, debts } = mapPlaidAccounts(accountsData.accounts || [], { institutionName, liabilities })
    const stamp = (row: Record<string, unknown>) => ({ ...row, user_id: user.id, plaid_item_id: itemRow.id })

    let accountsAdded = 0
    let debtsAdded = 0
    if (accounts.length) {
      const { error, count } = await db.from('accounts')
        .upsert(accounts.map(stamp), { onConflict: 'user_id,plaid_account_id', count: 'exact' })
      if (error) throw error
      accountsAdded = count ?? accounts.length
    }
    if (debts.length) {
      const { error, count } = await db.from('debts')
        .upsert(debts.map(stamp), { onConflict: 'user_id,plaid_account_id', count: 'exact' })
      if (error) throw error
      debtsAdded = count ?? debts.length
    }

    await db.from('plaid_items').update({ last_synced_at: new Date().toISOString() }).eq('id', itemRow.id)

    return json({ success: true, institution_name: institutionName, accountsAdded, debtsAdded })
  } catch (caught) {
    const status = caught?.status && caught.status >= 400 && caught.status < 600 ? caught.status : 502
    return json({ error: 'Could not finish connecting this bank.', detail: caught?.message, code: caught?.code }, status)
  }
})
