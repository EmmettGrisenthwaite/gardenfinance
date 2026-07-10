import { supabase } from '@/lib/supabase'

// ── The one-plan model ──────────────────────────────────────────────────────────
// A user has exactly ONE plan ("Your plan"). Every surface that produces steps —
// the advisor's action plans, saved guides, "add this to my plan", suggestions,
// the user's own typing — APPENDS to it (with dedupe) instead of creating
// sibling plans. `getPlan` lazily merges any legacy multi-plan rows.

const GENERIC_TITLE = /^your (action )?plan$/i

// Normalize a step's text for dedupe: amounts and punctuation vary between
// phrasings of the same action ("Save $1,000" vs "save 1000"), so strip them.
function dedupeKey(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\$?[\d,.]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Two steps are the same action if one key contains the other, or if their
// CONTENT words overlap heavily — the model paraphrases freely ("add your
// income & expenses to get real numbers" vs "…so I can see your real numbers"),
// and containment alone misses those. Deliberately conservative: a missed
// paraphrase is clutter the user can delete; a false positive silently drops a
// real step (which is why appendSteps reports `skipped` out loud).
const STOPWORDS = new Set(['a', 'an', 'the', 'your', 'you', 'my', 'i', 'me', 'to', 'so',
  'can', 'at', 'for', 'of', 'on', 'in', 'with', 'and', 'or', 'is', 'are', 'it', 'that',
  'this', 'about', 'any', 'once', 'even', 'get', 'see'])
function contentWords(key) {
  return new Set(key.split(' ').filter(w => w && !STOPWORDS.has(w)))
}
function sameStep(keyA, keyB) {
  if (!keyA || !keyB) return false
  if (keyA.includes(keyB) || keyB.includes(keyA)) return true
  const a = contentWords(keyA), b = contentWords(keyB)
  if (a.size < 4 || b.size < 4) return false   // short texts collide too easily
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  return inter / (a.size + b.size - inter) >= 0.6
}

// Normalize raw plan steps (from the model or a caller) into stored step objects.
export function normalizeSteps(steps = []) {
  return steps.map((s, i) => ({
    id:      s.id ?? `s${i}_${Math.random().toString(36).slice(2, 8)}`,
    text:    s.text ?? '',
    detail:  s.detail ?? null,
    impact:  s.impact ?? null,   // quantified benefit, e.g. "≈ $43/mo saved"
    apply:   s.apply ?? null,
    // Optional reputable links (e.g. provider sign-up pages) for how-to guides.
    resources: Array.isArray(s.resources)
      ? s.resources
          .filter(r => r && typeof r.url === 'string' && /^https?:\/\//i.test(r.url))
          .map(r => ({ label: r.label || r.url, url: r.url, note: r.note || null }))
      : null,
    due:     s.due ?? null,          // optional YYYY-MM-DD target date
    guide:   s.guide ?? null,        // the fetched "how to do this" text — cached on the step
    source:  s.source ?? null,       // 'advisor' | 'guide' | 'suggestion' | 'user'
    group:   s.group ?? null,        // where it came from, e.g. a guide's title
    addedAt: s.addedAt ?? null,
    completedAt: s.completedAt ?? null,
    done:    Boolean(s.done),
    applied: Boolean(s.applied),
  }))
}

// Fetch the user's single plan, lazily merging any legacy multi-plan rows into
// one. Merge is data-safe by construction: steps are concatenated verbatim
// (done/due/applied preserved), the merged list is WRITTEN AND VERIFIED before
// any extra row is deleted, and re-running is a no-op.
export async function getPlan(userId) {
  const { data, error } = await supabase.from('advisor_plans')
    .select('*').eq('user_id', userId).order('created_at', { ascending: true })
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return null
  if (rows.length === 1) return rows[0]

  // Legacy state: several mini-plans. Fold them into the oldest row, tagging
  // inherited steps with their old plan's title so context isn't lost.
  const steps = rows.flatMap(r => normalizeSteps(r.steps).map(s => ({
    ...s,
    group: s.group ?? (GENERIC_TITLE.test(r.title || '') ? null : r.title),
  })))
  const base = rows[0]
  const { error: writeErr } = await supabase.from('advisor_plans')
    .update({ title: 'Your plan', steps, updated_at: new Date().toISOString() })
    .eq('id', base.id)
  if (!writeErr) {
    // Only after the merged write landed is it safe to drop the extras.
    await supabase.from('advisor_plans').delete().eq('user_id', userId).neq('id', base.id)
  }
  return { ...base, title: 'Your plan', steps }
}

// Compatibility wrapper — callers that render a list still work; there is at
// most one plan after getPlan's lazy merge.
export async function listPlans(userId) {
  const plan = await getPlan(userId)
  return plan ? [plan] : []
}

// Append steps to the user's plan (creating it if needed), skipping any step
// that duplicates an existing NOT-done one. Returns { plan, added, skipped } so
// callers can be honest: "Added 2 steps — 1 already there."
export async function appendSteps(userId, rawSteps, { source = null, group = null } = {}) {
  const incoming = normalizeSteps(rawSteps)
  let plan = await getPlan(userId)
  const existing = plan?.steps ?? []
  const keys = existing.filter(s => !s.done).map(s => dedupeKey(s.text)).filter(Boolean)
  const now = new Date().toISOString()

  const fresh = []
  let skipped = 0
  for (const s of incoming) {
    const key = dedupeKey(s.text)
    const dup = key && keys.some(k => sameStep(k, key))
    if (dup) { skipped++; continue }
    fresh.push({
      ...s,
      source: s.source ?? source,
      group:  s.group ?? (group && !GENERIC_TITLE.test(group) ? group : null),
      addedAt: now,
    })
    if (key) keys.push(key)   // also dedupe within the incoming batch
  }

  if (fresh.length === 0) return { plan, added: 0, skipped }
  if (plan) {
    const steps = [...existing, ...fresh]
    const { error } = await supabase.from('advisor_plans')
      .update({ steps, updated_at: now }).eq('id', plan.id)
    if (error) throw error
    plan = { ...plan, steps }
  } else {
    const { data, error } = await supabase.from('advisor_plans')
      .insert({ user_id: userId, title: 'Your plan', steps: fresh }).select().single()
    if (error) throw error
    plan = data
  }
  return { plan, added: fresh.length, skipped }
}

// Legacy save API — now appends into the one plan instead of forking a new row.
export async function savePlan(userId, plan, { source = 'advisor' } = {}) {
  const { plan: saved } = await appendSteps(userId, plan.steps, { source, group: plan.title })
  return saved
}

// Create a goal directly (used by the advisor's inline goal suggestions).
export async function addGoal(userId, g) {
  const targetAmount = Math.max(0, Math.round(Number(g.target_amount) || 0))
  const monthlyContribution = Math.max(0, Math.round(Number(g.monthly_contribution) || 0))
  const { data, error } = await supabase.from('goals').insert({
    user_id:              userId,
    name:                 g.name || 'New goal',
    goal_type:            g.goal_type === 'investment' ? 'investment' : 'savings',
    target_amount:        targetAmount,
    current_amount:       0,
    monthly_contribution: monthlyContribution,
    deadline:             null,
  }).select().single()
  if (error) throw error
  return data
}

// The button label for a step's one-tap action (null = no action).
export function applyLabel(apply) {
  if (apply?.type === 'goal')   return 'Add to Goals'
  if (apply?.type === 'budget') return apply.budget_type === 'income' ? 'Add to my income' : 'Add to my expenses'
  return null
}

// Apply a step's action. Returns a toast message.
// 'budget' adjusts the profile's monthly income/expense totals — the single
// source of truth every money snapshot in the app reads. (It used to insert
// into the retired `budgets` table, which nothing displays.)
export async function applyStep(userId, apply) {
  if (apply?.type === 'goal') {
    const targetAmount = Math.max(0, Number(apply.target_amount) || 0)
    const monthlyContribution = Math.max(0, Number(apply.monthly_contribution) || 0)
    const { error } = await supabase.from('goals').insert({
      user_id:              userId,
      name:                 apply.name || 'New goal',
      goal_type:            apply.goal_type === 'investment' ? 'investment' : 'savings',
      target_amount:        targetAmount,
      current_amount:       0,
      monthly_contribution: monthlyContribution,
      deadline:             null,
    })
    if (error) throw error
    return 'Goal planted 🌱'
  }
  if (apply?.type === 'budget') {
    const isIncome = apply.budget_type === 'income'
    const col = isIncome ? 'monthly_income' : 'monthly_expenses'
    const { data: prof, error: readErr } = await supabase.from('profiles')
      .select(col).eq('id', userId).single()
    if (readErr) throw readErr
    const amount = Math.max(0, Number(apply.amount) || 0)
    const next = Math.max(0, Number(prof?.[col] || 0) + amount)
    const { error } = await supabase.from('profiles').update({ [col]: next }).eq('id', userId)
    if (error) throw error
    return `${isIncome ? 'Income' : 'Expenses'} updated → $${next.toLocaleString()}/mo`
  }
  throw new Error('Nothing to apply for this step')
}

// ── Persistence ───────────────────────────────────────────────────────────────
export async function updatePlanSteps(planId, steps, userId = null) {
  let query = supabase.from('advisor_plans')
    .update({ steps, updated_at: new Date().toISOString() }).eq('id', planId)
  if (userId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
}

export async function deletePlan(planId, userId = null) {
  let query = supabase.from('advisor_plans').delete().eq('id', planId)
  if (userId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
}
