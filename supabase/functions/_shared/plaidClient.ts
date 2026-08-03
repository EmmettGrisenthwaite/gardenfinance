// Shared plumbing for the plaid-* edge functions: auth verification (same
// pattern as supabase/functions/chat/index.ts), a service-role DB client for
// touching plaid_items (which `authenticated` has zero grants on — see the
// migration), and a thin wrapper around Plaid's REST API.
//
// Deploy + configure (run once, from the repo root):
//   supabase functions deploy plaid-link-token plaid-exchange plaid-sync plaid-remove
//   supabase secrets set PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected
// automatically — never set those manually.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
export const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}
export const PLAID_BASE_URL = PLAID_HOSTS[PLAID_ENV] || PLAID_HOSTS.sandbox

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

export function plaidNotConfigured() {
  return json({
    error: 'Bank linking is not set up yet.',
    detail: 'Server is missing PLAID_CLIENT_ID / PLAID_SECRET. Run: supabase secrets set PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox',
  }, 501)
}

// Verifies the caller's Supabase JWT the same way chat/index.ts does. Returns
// the authenticated user, or a ready-to-return 401 Response.
export async function requireUser(req: Request): Promise<
  { user: { id: string; email?: string } } | { response: Response }
> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return { response: json({ error: 'Unauthorized' }, 401) }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { response: json({ error: 'Unauthorized' }, 401) }
  return { user }
}

// service_role bypasses RLS entirely — every query built with this client
// MUST be manually scoped with `.eq('user_id', user.id)`. This is the only
// client in the app that can read/write plaid_items at all, by design (see
// the migration: `authenticated` has no grant on that table).
export function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export class PlaidError extends Error {
  status: number
  code: string | null
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Every Plaid call needs client_id/secret merged in — never sent to or
// stored by the browser, only used here, server-side.
export async function plaidFetch(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${PLAID_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new PlaidError(data?.error_message || `Plaid request failed (${res.status})`, res.status, data?.error_code || null)
  }
  return data
}
