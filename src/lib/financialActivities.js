import { supabase } from './supabase.js'
import { normalizeStepOutcome, resolveOutcomeTargets } from './progressOutcome.js'

export async function listFinancialActivities(userId, { limit = 30 } = {}) {
  const { data, error } = await supabase.from('financial_activities')
    .select('*').eq('user_id', userId).order('occurred_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

export async function recordStepActivity({ plan, step, accounts = [], debts = [], goals = [] }) {
  if (!plan?.id || !step?.id) return null
  const outcome = normalizeStepOutcome(step)
  const targets = resolveOutcomeTargets(outcome, { accounts, debts, goals })
  const payload = {
    plan_id: plan.id,
    step_id: step.id,
    source_key: `plan:${plan.id}:step:${step.id}`,
    label: step.text || 'Completed plan step',
    intent_key: outcome.intentKey,
    completion_policy: outcome.completionPolicy,
    kind: outcome.kind,
    amount: outcome.amount,
    recurrence: outcome.recurrence,
    source_account_id: targets.sourceAccountId,
    destination_account_id: targets.destinationAccountId,
    debt_id: targets.debtId,
    goal_id: targets.goalId,
    occurred_at: step.completedAt || new Date().toISOString(),
    metadata: {
      source_account_hint: outcome.sourceAccountHint,
      destination_account_hint: outcome.destinationAccountHint,
      debt_hint: outcome.debtHint,
      goal_hint: outcome.goalHint,
      account_subtype_hint: outcome.accountSubtypeHint,
    },
  }
  const { data, error } = await supabase.rpc('record_financial_activity', { p_activity: payload })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function markFinancialActivity(activityId, disposition = 'seen') {
  const { data, error } = await supabase.rpc('mark_financial_activity', {
    p_activity_id: activityId,
    p_disposition: disposition,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function applyFinancialActivity(activityId, payload) {
  const { data, error } = await supabase.rpc('apply_financial_activity', {
    p_activity_id: activityId,
    p_payload: payload,
  })
  if (error) {
    const stale = /STALE_FINANCIAL_STATE/i.test(`${error.message || ''} ${error.details || ''}`)
    if (stale) {
      const conflict = new Error('One of these balances changed. We refreshed the preview so nothing is applied twice.')
      conflict.code = 'STALE_FINANCIAL_STATE'
      throw conflict
    }
    throw error
  }
  return data
}
