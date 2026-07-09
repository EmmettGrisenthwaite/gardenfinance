// Supabase Edge Function: `chat`
// Server-side proxy to the Anthropic Messages API. The Anthropic key lives ONLY
// here (as a function secret) — it is never shipped to the browser.
//
// Security: requires a valid Supabase user JWT (Authorization: Bearer <token>).
// Anonymous callers are rejected, so the key can't be abused by the public.
//
// Deploy + configure (run once, from the repo root):
//   supabase functions deploy chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY  = Deno.env.get('SUPABASE_ANON_KEY')!

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const ALLOWED_MODELS = new Set([DEFAULT_MODEL])
const MAX_REQUEST_BYTES = 256_000
const MAX_MESSAGES = 80
const MAX_MESSAGE_CHARS = 12_000
const MAX_SYSTEM_CHARS = 60_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Request is too large' }, 413)
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'Server is missing ANTHROPIC_API_KEY. Run: supabase secrets set ANTHROPIC_API_KEY=...' }, 500)
  }

  // ── Require an authenticated Supabase user ──────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Parse + validate the request ────────────────────────────────────────────
  let payload: {
    messages?: unknown; system?: string; maxTokens?: number; model?: string
    stream?: boolean; tool?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { messages, system, maxTokens = 1024, model: requestedModel = DEFAULT_MODEL, stream = false, tool } = payload
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages[] is required' }, 400)
  }
  if (messages.length > MAX_MESSAGES || messages.some((message) => {
    if (!message || typeof message !== 'object') return true
    const item = message as { role?: unknown; content?: unknown }
    return !['user', 'assistant'].includes(String(item.role))
      || typeof item.content !== 'string'
      || item.content.length > MAX_MESSAGE_CHARS
  })) {
    return json({ error: 'messages[] contains an invalid or oversized message' }, 400)
  }
  if (system !== undefined && (typeof system !== 'string' || system.length > MAX_SYSTEM_CHARS)) {
    return json({ error: 'system prompt is invalid or too large' }, 400)
  }
  const model = ALLOWED_MODELS.has(String(requestedModel)) ? String(requestedModel) : DEFAULT_MODEL
  // Clamp to keep costs/abuse bounded
  const max_tokens = Math.min(Math.max(Number(maxTokens) || 1024, 1), 2048)

  // ── Tool definitions (structured outputs the client can save/apply) ──────────
  const ACTION_PLAN_TOOL = {
    name: 'create_action_plan',
    description: 'Create a short, personalized financial action plan for the user based on their real numbers. 3–5 concrete, ordered steps. Where a step naturally maps to adding a savings/investment goal or a recurring budget line, fill in its `apply` object so the user can act in one tap.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short plan title, e.g. "Your 90-day money plan"' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text:   { type: 'string', description: 'The action, imperative and specific, e.g. "Build a $6,000 emergency fund"' },
              detail: { type: 'string', description: 'Why this matters for THIS user, referencing their real numbers — one short sentence' },
              impact: { type: 'string', description: 'Quantified benefit, ultra-short, e.g. "≈ $43/mo saved" or "+$1,000 cushion". Omit rather than invent a number.' },
              due:    { type: 'string', description: 'YYYY-MM-DD, only for genuinely time-sensitive steps (enrollment windows, promo APR expirations). Usually omit.' },
              apply: {
                type: 'object',
                description: 'Optional one-tap action this step enables',
                properties: {
                  type:                 { type: 'string', enum: ['goal', 'budget'] },
                  name:                 { type: 'string', description: 'goal: the goal name' },
                  goal_type:            { type: 'string', enum: ['savings', 'investment'] },
                  target_amount:        { type: 'number', description: 'goal: target $' },
                  monthly_contribution: { type: 'number', description: 'goal: planned $/month' },
                  budget_type:          { type: 'string', enum: ['income', 'expense'], description: 'budget: adjusts the user\'s monthly income or expense total by `amount`' },
                  category:             { type: 'string', description: 'budget: what the adjustment is, e.g. "Side income", "Cut subscriptions"' },
                  amount:               { type: 'number', description: 'budget: monthly $ change (positive number)' },
                },
                required: ['type'],
              },
            },
            required: ['text', 'detail'],
          },
        },
      },
      required: ['title', 'steps'],
    },
  }

  const SUGGEST_GOAL_TOOL = {
    name: 'suggest_goal',
    description: 'Decide whether the user just expressed a concrete financial goal worth tracking — e.g. saving for a house, car, trip, wedding, emergency fund, or starting to invest. If yes, propose realistic numbers grounded in their actual income and monthly surplus, and set should_suggest=true. If the latest message is NOT about a specific savings/investment goal (general questions, budgeting chat, etc.), set should_suggest=false and leave the rest blank.',
    input_schema: {
      type: 'object',
      properties: {
        should_suggest:       { type: 'boolean', description: 'true only if there is a concrete goal to track' },
        name:                 { type: 'string',  description: 'Short, specific goal name, e.g. "House Down Payment", "Japan Trip", "New Car"' },
        goal_type:            { type: 'string',  enum: ['savings', 'investment'] },
        target_amount:        { type: 'number',  description: 'Realistic target $ for this goal' },
        monthly_contribution: { type: 'number',  description: 'A realistic monthly amount given their budget surplus' },
        timeline_months:      { type: 'number',  description: 'Roughly how many months at that contribution' },
        rationale:            { type: 'string',  description: 'One short, friendly sentence explaining the suggested numbers' },
      },
      required: ['should_suggest'],
    },
  }

  const CREATE_GUIDE_TOOL = {
    name: 'create_guide',
    description: 'Use when the user wants to TAKE A CONCRETE SETUP ACTION — e.g. open a Roth IRA, open a high-yield savings account, start investing in index funds, roll over an old 401(k), open an HSA, get term life insurance, freeze their credit, set up automatic transfers. Produce a short do-it-today walkthrough: 3–6 ordered steps. On the step where they pick a provider, list 2–4 reputable, genuinely top-rated options with their OFFICIAL website URLs — use only primary official domains you are confident about (e.g. fidelity.com, vanguard.com, schwab.com, ally.com, marcus.com, sofi.com, wealthfront.com, irs.gov). Never invent URLs. Ground the recommendations in the user’s real situation (age, income, existing accounts). If the latest message is NOT a request to actually set something up, set should_guide=false and leave the rest blank.',
    input_schema: {
      type: 'object',
      properties: {
        should_guide:      { type: 'boolean', description: 'true only if the user wants step-by-step help doing a concrete financial task' },
        title:             { type: 'string',  description: 'Imperative task title, e.g. "Open a Roth IRA"' },
        summary:           { type: 'string',  description: 'One friendly sentence on why this is the right move for them right now' },
        estimated_minutes: { type: 'number',  description: 'Rough minutes to complete, e.g. 20' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text:   { type: 'string', description: 'The action, imperative and specific' },
              detail: { type: 'string', description: 'One short sentence of how/why' },
              resources: {
                type: 'array',
                description: 'Optional reputable links for this step (e.g. provider sign-up pages). Official domains only.',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Provider/resource name, e.g. "Fidelity"' },
                    url:   { type: 'string', description: 'Official https URL' },
                    note:  { type: 'string', description: 'Optional why-this-one, ≤6 words, e.g. "no fees, great app"' },
                  },
                  required: ['label', 'url'],
                },
              },
            },
            required: ['text'],
          },
        },
      },
      required: ['should_guide'],
    },
  }

  const EXTRACT_MEMORIES_TOOL = {
    name: 'extract_memories',
    description: 'Extract durable facts about the user\'s financial life from the conversation — things likely to stay true for months (income, employment, employer match, goals, debts, family/life events, risk preferences, upcoming large expenses). Skip transient states ("stressed today", "market is down"). Return an empty array when nothing durable was revealed.',
    input_schema: {
      type: 'object',
      properties: {
        memories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fact:     { type: 'string', description: 'One durable fact, phrased in third person, e.g. "Employer matches 401k up to 4%"' },
              category: { type: 'string', enum: ['income', 'employment', 'life_event', 'risk_preference', 'goal', 'debt', 'family', 'health', 'investment', 'other'] },
            },
            required: ['fact', 'category'],
          },
        },
      },
      required: ['memories'],
    },
  }

  const TOOLS: Record<string, unknown> = { action_plan: ACTION_PLAN_TOOL, suggest_goal: SUGGEST_GOAL_TOOL, guide: CREATE_GUIDE_TOOL, extract_memories: EXTRACT_MEMORIES_TOOL }

  // Cache the (large, mostly-stable) system prompt — cuts input cost ~90% and
  // speeds first-token on every follow-up message in a conversation.
  const systemBlocks = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined
  const body: Record<string, unknown> = { model, max_tokens, system: systemBlocks, messages }
  if (tool && TOOLS[tool]) {
    const def = TOOLS[tool] as { name: string }
    body.tools = [def]
    body.tool_choice = { type: 'tool', name: def.name }
  } else {
    body.stream = Boolean(stream)
  }

  // ── Proxy to Anthropic — one retry on transient overload/rate-limit ─────────
  async function callAnthropic(): Promise<Response> {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  let res: Response
  try {
    res = await callAnthropic()
    // 429 (rate limit) / 529 (overloaded) are transient — bursts of parallel
    // calls (streamed reply + a suggest_goal/guide call + a background memory
    // distill) can collide. One short-backoff retry absorbs that instead of
    // failing the whole request.
    if ((res.status === 429 || res.status === 529) && !stream) {
      await new Promise((r) => setTimeout(r, 700))
      res = await callAnthropic()
    }
  } catch (e) {
    return json({ error: 'Upstream request failed', detail: String(e).slice(0, 300) }, 502)
  }

  if (!res.ok) {
    // Preserve the real upstream status (429/5xx) instead of laundering every
    // failure into 502 — callers can distinguish "try again later" from a
    // genuine server error, and error messages in logs are actually useful.
    const detail = (await res.text()).slice(0, 500)
    const status = res.status >= 400 && res.status < 600 ? res.status : 502
    return json({ error: `Anthropic error ${res.status}`, detail }, status)
  }

  // Streaming: pipe Anthropic's SSE straight through to the browser
  if (!tool && stream) {
    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    })
  }

  const data = await res.json()
  // Tool call → return the structured input the model produced
  if (tool && TOOLS[tool]) {
    const block = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string }) => b.type === 'tool_use')
      : null
    if (!block) return json({ error: 'Model did not return structured output' }, 502)
    // `plan` kept for backward-compat with the action-plan client
    return json(tool === 'action_plan' ? { plan: block.input } : { result: block.input })
  }
  const text = data?.content?.[0]?.text ?? ''
  return json({ text })
})
