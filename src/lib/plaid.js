import { supabase } from '@/lib/supabase'

// Thin client for the plaid-* edge functions (supabase/functions/plaid-*).
// Every call needs the user's Supabase session — the functions verify it
// server-side the same way the chat function does. No Plaid credentials ever
// reach the browser; the edge functions hold PLAID_CLIENT_ID/PLAID_SECRET.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : null

export const plaidConfigured = Boolean(FUNCTIONS_URL)

async function authedFetch(path, body) {
  if (!FUNCTIONS_URL) throw new Error('Bank linking is not configured (missing VITE_SUPABASE_URL).')
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Please sign in to connect a bank.')

  let res
  try {
    res = await fetch(`${FUNCTIONS_URL}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    // A raw "Failed to fetch" (network error, or the function genuinely not
    // deployed yet — CORS never gets a chance to respond) reads as a bug.
    // Surface it as a normal, recoverable message instead.
    throw new Error('Could not reach the bank-linking service. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`
    const error = new Error(data?.detail ? `${message} ${data.detail}` : message)
    error.status = res.status
    error.code = data?.code || null
    // 501 is this app's own "server isn't configured yet" signal (see
    // plaidNotConfigured() in the edge function) — worth distinguishing so
    // the UI can show setup guidance instead of a generic failure.
    error.notConfigured = res.status === 501
    throw error
  }
  return data
}

export async function createPlaidLinkToken() {
  const data = await authedFetch('plaid-link-token')
  return data.link_token
}

export async function exchangePlaidPublicToken({ publicToken, institutionId, institutionName }) {
  return authedFetch('plaid-exchange', {
    public_token: publicToken, institution_id: institutionId, institution_name: institutionName,
  })
}

export async function syncPlaidAccounts(itemId) {
  return authedFetch('plaid-sync', itemId ? { item_id: itemId } : {})
}

export async function removePlaidConnection(itemId) {
  return authedFetch('plaid-remove', { item_id: itemId })
}

export async function removeAllPlaidConnections() {
  return authedFetch('plaid-remove', { all: true })
}

export async function listPlaidConnections() {
  const { data, error } = await supabase.rpc('list_plaid_connections')
  if (error) throw error
  return data ?? []
}
