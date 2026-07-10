import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/lib/finance'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const CHAT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/chat` : null

// True when the app is configured to reach the secure chat proxy.
export const chatConfigured = Boolean(CHAT_ENDPOINT)

// Local message objects carry UI-only fields (artifacts, options, quickReplies)
// alongside role/content. Anthropic's Messages API rejects unknown properties
// on message objects — sending those straight through causes a 400 the moment
// a reply with an artifact/options block becomes part of the next request's
// history. Strip to {role, content} right before it leaves the browser.
function sanitizeMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }))
}

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
    body: JSON.stringify({ messages: sanitizeMessages(messages), system: systemPrompt, maxTokens, stream: Boolean(onDelta) }),
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

// Generates THE way to do one plan step, rendered INLINE in its card when the
// user taps into it (no trip to the advisor chat). Deliberately DECISIVE: it
// commits to one provider, one account type, one sequence — a user who tapped
// "how do I do this" wants marching orders, not a menu.
// Returns plain text: 3–6 numbered steps.
export async function fetchHowTo(subject, context = '') {
  const system = `You are the financial advisor inside Garden Financial. The user tapped a step in their plan and wants to know EXACTLY how to do it. Produce the definitive way — decide for them. Rules:
- BE DECISIVE. Pick exactly ONE provider, ONE account type, ONE sequence — the best fit for their situation below. Never offer alternatives, never say "consider", "you could", "or", "such as". If a choice depends on something unknown, make the sensible default call for a young adult and just state it.
- 3–6 numbered steps, each a single short imperative sentence. Step 1 must be startable today, on their phone.
- Use their real numbers from the situation below for every dollar amount — computed, not generic.
- Ground picks in current reality: Roth IRA limit $${LIMITS.rothIra.toLocaleString()} and 401(k) limit $${LIMITS.k401.toLocaleString()} for ${LIMITS.year}; top HYSAs (Ally, Marcus, SoFi) pay ~4–5% APY. Default brokerage pick: Fidelity (no minimums, no fees, best app for beginners).
- No preamble, no closing remarks, no headings, no hedging — just the numbered steps.`
  const messages = [{
    role: 'user',
    content: `${context ? `My situation:\n${context}\n\n` : ''}Show me exactly how to: ${subject}`,
  }]
  return callClaude(messages, system, { maxTokens: 450 })
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
    body: JSON.stringify({ messages: sanitizeMessages(messages), system: systemPrompt, maxTokens: 1536, tool: 'action_plan' }),
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

// Asks Claude (via tool-use) for a do-it-today how-to guide when the user wants
// to set something up (open an IRA, HYSA, etc.). Returns { title, summary,
// estimated_minutes, steps: [{ text, detail?, resources? }] } or null.
export async function requestGuide(messages, systemPrompt) {
  if (!CHAT_ENDPOINT) return null
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  // Forced tool-use requires the turn to end with a user message.
  const clean = sanitizeMessages(messages)
  const probe = clean[clean.length - 1]?.role === 'assistant'
    ? [...clean, { role: 'user', content: 'If my latest request is about actually setting something up (opening an account, starting investing, etc.), build me a step-by-step guide with reputable provider links; otherwise set should_guide to false.' }]
    : clean

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: probe, system: systemPrompt, maxTokens: 1536, tool: 'guide' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.result
    return r?.should_guide && Array.isArray(r.steps) && r.steps.length ? r : null
  } catch {
    return null
  }
}

// Asks Claude (via tool-use) whether the latest message implies a concrete goal
// worth tracking. Returns the structured suggestion, or null if none.
export async function suggestGoal(messages, systemPrompt) {
  if (!CHAT_ENDPOINT) return null
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  // Forced tool-use requires the turn to end with a user message.
  const clean = sanitizeMessages(messages)
  const probe = clean[clean.length - 1]?.role === 'assistant'
    ? [...clean, { role: 'user', content: 'Based on my messages above, if there is a specific financial goal worth tracking, capture it; otherwise set should_suggest to false.' }]
    : clean

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
