import { supabase } from '@/lib/supabase'

// Normalize raw plan steps (from the model) into stored step objects.
export function normalizeSteps(steps = []) {
  return steps.map((s, i) => ({
    id:      s.id ?? `s${i}_${Math.random().toString(36).slice(2, 8)}`,
    text:    s.text ?? '',
    detail:  s.detail ?? null,
    apply:   s.apply ?? null,
    done:    Boolean(s.done),
    applied: Boolean(s.applied),
  }))
}

// Create a goal directly (used by the advisor's inline goal suggestions).
export async function addGoal(userId, g) {
  const { data, error } = await supabase.from('goals').insert({
    user_id:              userId,
    name:                 g.name || 'New goal',
    goal_type:            g.goal_type === 'investment' ? 'investment' : 'savings',
    target_amount:        Math.round(g.target_amount) || 0,
    current_amount:       0,
    monthly_contribution: Math.round(g.monthly_contribution) || 0,
    deadline:             null,
  }).select().single()
  if (error) throw error
  return data
}

// The button label for a step's one-tap action (null = no action).
export function applyLabel(apply) {
  if (apply?.type === 'goal')   return 'Add to Goals'
  if (apply?.type === 'budget') return apply.budget_type === 'income' ? 'Add income' : 'Add to Budget'
  return null
}

// Apply a step's action — writes a real goals/budgets row. Returns a toast msg.
export async function applyStep(userId, apply) {
  if (apply?.type === 'goal') {
    const { error } = await supabase.from('goals').insert({
      user_id:              userId,
      name:                 apply.name || 'New goal',
      goal_type:            apply.goal_type === 'investment' ? 'investment' : 'savings',
      target_amount:        Number(apply.target_amount) || 0,
      current_amount:       0,
      monthly_contribution: Number(apply.monthly_contribution) || 0,
      deadline:             null,
    })
    if (error) throw error
    return 'Added to Goals 🌱'
  }
  if (apply?.type === 'budget') {
    const { error } = await supabase.from('budgets').insert({
      user_id:   userId,
      name:      apply.category || 'Budget item',
      type:      apply.budget_type === 'income' ? 'income' : 'expense',
      category:  apply.category || 'Other',
      amount:    Number(apply.amount) || 0,
      recurring: true,
    })
    if (error) throw error
    return 'Added to Budget'
  }
  throw new Error('Nothing to apply for this step')
}

// ── Persistence ───────────────────────────────────────────────────────────────
export async function savePlan(userId, plan) {
  const { data, error } = await supabase.from('advisor_plans')
    .insert({ user_id: userId, title: plan.title || 'Your action plan', steps: normalizeSteps(plan.steps) })
    .select().single()
  if (error) throw error
  return data
}

export async function listPlans(userId) {
  const { data, error } = await supabase.from('advisor_plans')
    .select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updatePlanSteps(planId, steps) {
  const { error } = await supabase.from('advisor_plans')
    .update({ steps, updated_at: new Date().toISOString() }).eq('id', planId)
  if (error) throw error
}

export async function deletePlan(planId) {
  const { error } = await supabase.from('advisor_plans').delete().eq('id', planId)
  if (error) throw error
}
