// Supabase Edge Function: `plaid-remove`
// Disconnects a bank: revokes the item at Plaid and deletes the plaid_items
// row. The accounts/debts it created are kept as ordinary manual records
// (their last-known balances) rather than deleted — a user disconnecting a
// bank does not expect their tracked net worth to vanish.
//
// Body is either { item_id } (our plaid_items.id, one connection) or
// { all: true } (every connection the user has — used by Settings' "delete
// everything", which must not leave a live Plaid connection — and its
// billing — behind after the rest of the account is wiped).

import {
  corsHeaders, json, plaidFetch, requireUser, serviceClient, PLAID_CLIENT_ID, PLAID_SECRET,
} from '../_shared/plaidClient.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const { user } = auth

  let payload: { item_id?: string; all?: boolean }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!payload.item_id && !payload.all) {
    return json({ error: 'item_id or all is required' }, 400)
  }

  const db = serviceClient()
  let itemsQuery = db.from('plaid_items').select('*').eq('user_id', user.id)
  if (payload.item_id) itemsQuery = itemsQuery.eq('id', payload.item_id)
  const { data: items, error: itemsError } = await itemsQuery
  if (itemsError) return json({ error: itemsError.message }, 500)
  if (!items?.length) return payload.all ? json({ removed: 0, errors: [] }) : json({ error: 'Bank connection not found.' }, 404)

  let removed = 0
  const errors: Array<{ institution_name: string | null; detail: string }> = []

  for (const item of items) {
    try {
      // Revoking is best-effort: if PLAID_CLIENT_ID isn't configured, or
      // Plaid has already invalidated this item, we still want the local
      // record gone — an orphaned local row is worse than a redundant
      // revoke call.
      if (PLAID_CLIENT_ID && PLAID_SECRET) {
        try { await plaidFetch('/item/remove', { access_token: item.access_token }) } catch { /* already revoked/invalid — proceed */ }
      }
      await db.from('accounts').update({ source: 'manual', plaid_item_id: null }).eq('user_id', user.id).eq('plaid_item_id', item.id)
      await db.from('debts').update({ source: 'manual', plaid_item_id: null }).eq('user_id', user.id).eq('plaid_item_id', item.id)
      const { error: deleteError } = await db.from('plaid_items').delete().eq('id', item.id).eq('user_id', user.id)
      if (deleteError) throw deleteError
      removed += 1
    } catch (caught) {
      errors.push({ institution_name: item.institution_name, detail: caught?.message || 'Could not disconnect.' })
    }
  }

  return json({ removed, errors })
})
