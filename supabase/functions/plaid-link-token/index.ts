// Supabase Edge Function: `plaid-link-token`
// Creates a short-lived Plaid Link token so the browser can open Plaid Link
// without ever seeing PLAID_CLIENT_ID / PLAID_SECRET. Requires a valid
// Supabase user JWT — see supabase/functions/_shared/plaidClient.ts for the
// deploy/secrets setup and why.

import {
  corsHeaders, json, plaidFetch, plaidNotConfigured, requireUser,
  PLAID_CLIENT_ID, PLAID_SECRET,
} from '../_shared/plaidClient.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return plaidNotConfigured()

  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  try {
    const data = await plaidFetch('/link/token/create', {
      user: { client_user_id: auth.user.id },
      client_name: 'Garden Financial',
      // `auth` gives real-time balances for every account type; `liabilities`
      // adds APR/minimum-payment/loan-term detail for cards and loans where
      // the institution supports it (Link still completes for ones that
      // don't — the sync step just gets less detail for those accounts).
      products: ['auth', 'liabilities'],
      country_codes: ['US'],
      language: 'en',
    })
    return json({ link_token: data.link_token, expiration: data.expiration })
  } catch (caught) {
    const status = caught?.status && caught.status >= 400 && caught.status < 600 ? caught.status : 502
    return json({ error: 'Could not start the bank connection.', detail: caught?.message, code: caught?.code }, status)
  }
})
