import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/lib/finance'
import { formatHowToResult, HOW_TO_TIMEOUT_MS } from '@/lib/howToGuide'
import {
  collectWebSources,
  compactWebSources,
  limitGuideLinks,
  needsActionLinks,
} from '@/lib/webSources'

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
// - `systemPrompt` may be a string or an array of system blocks (the advisor
//   sends [cached static instructions, dynamic user context]).
// - Pass `onDelta(fullTextSoFar)` to stream the reply token-by-token.
// - Pass `onSources(sources)` to receive web-search citations — [{label, url}]
//   deduped by URL — once the reply finishes. Only real searched sources are
//   reported; the model can't fabricate these.
export async function callClaude(messages, systemPrompt, { maxTokens = 4000, onDelta, onSources } = {}) {
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
    if (Array.isArray(data?.sources) && data.sources.length) onSources?.(data.sources)
    return data?.text ?? ''
  }

  // SSE stream — accumulate text deltas and surface progress via onDelta.
  // Web-search citations arrive as citations_delta events; collect the unique
  // source URLs so the UI can render them as tappable chips.
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  const sourceSets = { cited: new Map(), searched: new Map() }
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
      if (evt.type === 'content_block_start') collectWebSources(evt.content_block, sourceSets)
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'citations_delta') {
        collectWebSources(evt.delta.citation, sourceSets)
      } else if (evt.type === 'content_block_delta' && evt.delta?.text) {
        full += evt.delta.text
        onDelta(full)
      } else if (evt.type === 'error') {
        throw new Error(evt.error?.message ?? 'The advisor stream failed.')
      }
    }
  }
  const latestUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content ?? ''
  const sources = compactWebSources(sourceSets, {
    allowSearchFallback: needsActionLinks(latestUserMessage),
  })
  if (sources.length) onSources?.(sources)
  return full
}

// Generates THE way to do one plan step, rendered INLINE in its card when the
// user taps into it (no trip to the advisor chat). Deliberately DECISIVE: it
// commits to one provider, one account type, one sequence — a user who tapped
// "how do I do this" wants marching orders, not a menu.
// Returns plain text: 3–6 numbered steps.
export async function fetchHowTo(subject, context = '', { signal, timeoutMs = HOW_TO_TIMEOUT_MS } = {}) {
  if (!CHAT_ENDPOINT) throw new Error('Advisor is not configured (missing VITE_SUPABASE_URL).')

  const system = `You are the financial advisor inside Garden Financial. The user tapped a step in their plan and wants to know EXACTLY how to do it. Produce the definitive way — decide for them. Rules:
- BE DECISIVE. Pick exactly ONE provider, ONE account type, ONE sequence — the best fit for their situation below. Never offer alternatives, never say "consider", "you could", "or", "such as". If a choice depends on something unknown, make the sensible default call for a young adult and just state it.
- BUILD ON WHAT EXISTS. If the situation says they ALREADY HAVE an account (Roth IRA, 401(k), brokerage, HSA…), never tell them to open one — the steps are about contributing to / increasing / automating the account they have.
- 3–6 numbered steps, each a single short imperative sentence. Step 1 must be startable today, on their phone.
- Use their real numbers from the situation below for every dollar amount — computed, not generic.
- Use the app's verified ${LIMITS.year} limits when relevant: Roth IRA $${LIMITS.rothIra.toLocaleString()} and 401(k) $${LIMITS.k401.toLocaleString()}. Do not quote live rates, promotions, or deadlines in this fast guide. If an exact current fact is required, tell the user which official page or account field to verify.
- Default brokerage pick: Fidelity (no minimums, no account fees, strong beginner experience).
- No preamble, no closing remarks, no headings, no hedging — just the numbered steps.`
  const messages = [{
    role: 'user',
    content: `${context ? `My situation:\n${context}\n\n` : ''}Show me exactly how to: ${subject}`,
  }]
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Please sign in to generate this guide.')

  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort(signal?.reason)
  if (signal?.aborted) abortFromCaller()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages, system, maxTokens: 900, tool: 'how_to' }),
      signal: controller.signal,
    })
    if (!res.ok) {
      let message = `Could not generate this guide (${res.status}).`
      try { const body = await res.json(); if (body?.error) message = body.error } catch { /* noop */ }
      throw new Error(message)
    }
    const data = await res.json()
    const guide = formatHowToResult(data?.result)
    if (!guide) throw new Error('The guide came back empty. Please try again.')
    return guide
  } catch (error) {
    if (timedOut) throw new Error('The guide took too long to generate. Please try again.')
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
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
    body: JSON.stringify({ messages: sanitizeMessages(messages), system: systemPrompt, maxTokens: 4000, tool: 'action_plan' }),
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
      body: JSON.stringify({ messages: probe, system: systemPrompt, maxTokens: 4000, tool: 'guide' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.result
    return r?.should_guide && Array.isArray(r.steps) && r.steps.length ? limitGuideLinks(r) : null
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
      body: JSON.stringify({ messages: probe, system: systemPrompt, maxTokens: 1500, tool: 'suggest_goal' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const r = data?.result
    return r?.should_suggest ? r : null
  } catch {
    return null
  }
}
