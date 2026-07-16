import { supabase } from '@/lib/supabase'
import { filterFreshPlanSteps } from './planReplenishment.js'

// ── The one-plan model ──────────────────────────────────────────────────────────
// A user has exactly ONE plan ("Your plan"). Every surface that produces steps —
// the advisor's action plans, saved guides, "add this to my plan", suggestions,
// the user's own typing — APPENDS to it (with dedupe) instead of creating
// sibling plans. `getPlan` lazily merges any legacy multi-plan rows.

const GENERIC_TITLE = /^your (action )?plan$/i

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
    intentKey: s.intentKey ?? s.intent_key ?? null,
    completionPolicy: (s.completionPolicy ?? s.completion_policy) === 'repeatable' ? 'repeatable' : 'once',
    outcome: s.outcome && typeof s.outcome === 'object' ? { ...s.outcome } : null,
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

// Append steps to the user's plan (creating it if needed). Existing callers
// dedupe against active work; replenishment can also include completed history.
// Returns { plan, added, skipped } so callers can report what actually changed.
export async function appendSteps(userId, rawSteps, { source = null, group = null, dedupeCompleted = false } = {}) {
  const incoming = normalizeSteps(rawSteps)
  let plan = await getPlan(userId)
  const existing = plan?.steps ?? []
  const now = new Date().toISOString()
  const filtered = filterFreshPlanSteps(existing, incoming, { dedupeCompleted })
  const fresh = filtered.fresh.map(s => ({
      ...s,
      source: s.source ?? source,
      group:  s.group ?? (group && !GENERIC_TITLE.test(group) ? group : null),
      addedAt: now,
  }))
  const skipped = filtered.skipped

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
    const amount = Math.max(0, Number(apply.amount) || 0)
    const name = apply.name || apply.category || (isIncome ? 'Additional income' : 'Additional spending')
    const keyBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'plan_item'
    const { error } = await supabase.from('cash_flow_items').insert({
      user_id: userId,
      kind: isIncome ? 'income' : 'expense',
      group_key: isIncome ? 'income' : 'wants',
      category_key: `plan_${keyBase}`,
      name,
      amount,
      frequency: 'monthly',
      source: 'plan',
      sort_order: 999,
    })
    if (error) throw error
    return `${name} added to your Monthly Plan at $${amount.toLocaleString()}/mo`
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
