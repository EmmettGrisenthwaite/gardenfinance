import { supabase } from '@/lib/supabase'

// Account/goal types that count as retirement / long-term investment savings.
const INVEST_ACCT = ['roth_ira', 'trad_ira', '401k', '403b', 'hsa', 'pension', 'brokerage', 'crypto']

// Sensible defaults derived from the user's real data + profile.
export function deriveDefaults({ accounts = [], goals = [], budgets = [], profile = {} } = {}) {
  const investAccts = accounts.filter(a => INVEST_ACCT.includes(a.type)).reduce((s, a) => s + Number(a.balance), 0)
  const investGoals = goals.filter(g => g.goal_type === 'investment').reduce((s, g) => s + Number(g.current_amount), 0)
  const monthlyFromGoals = goals.filter(g => g.goal_type === 'investment')
    .reduce((s, g) => s + Number(g.monthly_contribution || 0), 0)
  const recurringExpenses = budgets
    .filter(b => b.type === 'expense' && b.recurring !== false)
    .reduce((s, b) => s + Number(b.amount), 0)

  const age = Number(profile?.age) || 30
  return {
    currentAge:    age,
    retireAge:     65,
    currentSaved:  Math.round(investAccts + investGoals),
    monthly:       Math.round(monthlyFromGoals) || 300,
    annualReturn:  6,    // % nominal, conservative balanced portfolio
    // Retirement income need ≈ 80% of today's spending (common rule of thumb)
    desiredIncome: recurringExpenses > 0 ? Math.round(recurringExpenses * 12 * 0.8) : 50000,
  }
}

// Core projection — compound growth of current savings + monthly contributions,
// target via the 4% rule (desired income × 25).
export function computeRetirement(inp) {
  const years   = Math.max(0, Number(inp.retireAge) - Number(inp.currentAge))
  const months  = years * 12
  const r        = Math.max(0, Number(inp.annualReturn) / 100)
  const i        = r / 12
  const saved    = Math.max(0, Number(inp.currentSaved) || 0)
  const monthly  = Math.max(0, Number(inp.monthly) || 0)
  const desired  = Math.max(0, Number(inp.desiredIncome) || 0)

  const growth   = i > 0 ? Math.pow(1 + i, months) : 1
  const fvSaved  = saved * growth
  const fvContrib = i > 0 ? monthly * ((growth - 1) / i) : monthly * months
  const projected = Math.round(fvSaved + fvContrib)

  const target   = Math.round(desired * 25)         // 4% rule
  const onTrack  = target > 0 ? projected / target : 1
  const safeIncome = Math.round(projected * 0.04)   // what the projection supports

  // Monthly contribution required to hit the target
  const needFromContrib = Math.max(0, target - fvSaved)
  const requiredMonthly = months > 0
    ? Math.round(i > 0 ? (needFromContrib * i) / (growth - 1) : needFromContrib / months)
    : 0
  const monthlyGap = Math.max(0, requiredMonthly - monthly)

  return { years, projected, target, onTrack, safeIncome, requiredMonthly, monthlyGap }
}

export const fmt$ = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`

// ── Persistence ───────────────────────────────────────────────────────────────
export async function loadRetirement(userId) {
  const { data } = await supabase.from('retirement_plans').select('*').eq('user_id', userId).maybeSingle()
  return data ?? null
}

export async function saveRetirement(userId, settings, linkedGoalId) {
  const row = { user_id: userId, settings, updated_at: new Date().toISOString() }
  if (linkedGoalId !== undefined) row.linked_goal_id = linkedGoalId
  const { error } = await supabase.from('retirement_plans').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

// Create or update a linked "Retirement" investment goal so the plan flows into
// the Goals system (and grows the investment trees in the garden).
export async function syncRetirementGoal(userId, { target, monthly, current, linkedGoalId }) {
  const payload = {
    name:                 'Retirement',
    goal_type:            'investment',
    target_amount:        Math.round(target) || 0,
    current_amount:       Math.round(current) || 0,
    monthly_contribution: Math.round(monthly) || 0,
  }
  if (linkedGoalId) {
    const { data, error } = await supabase.from('goals').update(payload).eq('id', linkedGoalId).select().maybeSingle()
    if (!error && data) return data.id   // updated existing
  }
  const { data, error } = await supabase.from('goals')
    .insert({ ...payload, user_id: userId, deadline: null }).select().single()
  if (error) throw error
  return data.id
}
