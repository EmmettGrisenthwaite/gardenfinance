import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const CHAT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/chat` : null

// True when the app is configured to reach the secure chat proxy.
export const chatConfigured = Boolean(CHAT_ENDPOINT)

// Calls Claude via the Supabase Edge Function proxy (`supabase/functions/chat`).
// The Anthropic key lives only on the server — never in the browser bundle.
// Pass `onDelta(fullTextSoFar)` to stream the reply token-by-token; without it
// (or if the server replies with plain JSON) the full text resolves at the end.
export async function callClaude(messages, systemPrompt, { maxTokens = 1024, onDelta } = {}) {
  if (!CHAT_ENDPOINT) {
    throw new Error('Advisor is not configured (missing VITE_SUPABASE_URL).')
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Please sign in to use the advisor.')

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ messages, system: systemPrompt, maxTokens, stream: Boolean(onDelta) }),
  })

  if (!res.ok) {
    let message = `Advisor unavailable (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch { /* non-JSON error body */ }
    if (res.status === 404) {
      message = 'The advisor service isn’t deployed yet. Deploy the `chat` Edge Function to enable it.'
    }
    throw new Error(message)
  }

  // Non-streaming (or an older server build that ignores `stream`)
  const ctype = res.headers.get('content-type') ?? ''
  if (!onDelta || ctype.includes('application/json')) {
    const data = await res.json()
    return data?.text ?? ''
  }

  // SSE stream — accumulate text deltas and surface progress via onDelta
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = '', full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const dataStr = line.slice(5).trim()
      if (!dataStr) continue
      let evt
      try { evt = JSON.parse(dataStr) } catch { continue }
      if (evt.type === 'content_block_delta' && evt.delta?.text) {
        full += evt.delta.text
        onDelta(full)
      } else if (evt.type === 'error') {
        throw new Error(evt.error?.message ?? 'The advisor stream failed.')
      }
    }
  }
  return full
}

// Asks Claude to produce a structured action plan via tool-use (non-streaming).
// Returns { title, steps: [{ text, detail?, apply? }] }.
export async function requestPlan(messages, systemPrompt) {
  if (!CHAT_ENDPOINT) throw new Error('Advisor is not configured (missing VITE_SUPABASE_URL).')

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Please sign in to use the advisor.')

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages, system: systemPrompt, maxTokens: 1536, tool: 'action_plan' }),
  })

  if (!res.ok) {
    let message = `Advisor unavailable (${res.status})`
    try { const b = await res.json(); if (b?.error) message = b.error } catch { /* noop */ }
    throw new Error(message)
  }

  const data = await res.json()
  const plan = data?.plan
  if (!plan || !Array.isArray(plan.steps)) throw new Error('Could not build a plan. Try again.')
  return plan
}

// Asks Claude (via tool-use) whether the latest message implies a concrete goal
// worth tracking. Returns the structured suggestion, or null if none.
export async function suggestGoal(messages, systemPrompt) {
  if (!CHAT_ENDPOINT) return null
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  // Forced tool-use requires the turn to end with a user message.
  const probe = messages[messages.length - 1]?.role === 'assistant'
    ? [...messages, { role: 'user', content: 'Based on my messages above, if there is a specific financial goal worth tracking, capture it; otherwise set should_suggest to false.' }]
    : messages

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: probe, system: systemPrompt, maxTokens: 512, tool: 'suggest_goal' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.result
    return r?.should_suggest ? r : null
  } catch {
    return null
  }
}
