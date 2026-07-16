import { accountFamily } from './moneyModel.js'

export const FINANCIAL_OUTCOME_KINDS = Object.freeze([
  'transfer', 'contribution', 'debt_payment', 'recurring_setup', 'account_opening', 'information',
])

const PROMPTABLE_KINDS = new Set(FINANCIAL_OUTCOME_KINDS.filter(kind => kind !== 'information'))

function clean(value) {
  return (value || '').toString().trim()
}

function normalized(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseAmount(text) {
  const match = clean(text).match(/\$\s*([\d,.]+(?:\.\d{1,2})?)|\b([\d,.]+(?:\.\d{1,2})?)\s*(?:dollars?|\/\s*mo|per month)\b/i)
  const amount = Number((match?.[1] || match?.[2] || '').replace(/,/g, ''))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function accountKind(text) {
  if (/roth/.test(text)) return 'roth_ira'
  if (/traditional ira|trad ira/.test(text)) return 'traditional_ira'
  if (/401\s*\(?k\)?/.test(text)) return '401k'
  if (/403\s*\(?b\)?/.test(text)) return '403b'
  if (/\bhsa\b/.test(text)) return 'hsa'
  if (/brokerage|index fund|invest/.test(text)) return 'taxable_brokerage'
  if (/high.?yield|\bhysa\b/.test(text)) return 'hysa'
  if (/saving|emergency fund/.test(text)) return 'savings'
  if (/checking/.test(text)) return 'checking'
  return null
}

function inferredIntent(text, kind) {
  const target = accountKind(text)
  if (kind === 'account_opening') return `open.${target || 'account'}`
  if (kind === 'recurring_setup') return `setup.recurring_${target || 'transfer'}`
  if (kind === 'debt_payment') return 'pay.debt'
  if (kind === 'transfer') return `transfer.${target || 'money'}`
  if (kind === 'contribution') return `fund.${target || 'goal'}`
  return null
}

export function inferStepOutcome(step = {}) {
  const text = normalized(`${step.text || ''} ${step.detail || ''}`)
  let kind = 'information'
  if (/\b(open|create|start)\b.{0,55}\b(account|ira|401k|403b|hsa|brokerage|hysa|savings)\b/.test(text)) {
    kind = 'account_opening'
  } else if (/\b(set up|setup|automate|automatic|recurring|schedule)\b.{0,70}\b(transfer|contribution|payment|deposit)\b/.test(text)) {
    kind = 'recurring_setup'
  } else if (/\b(pay|payment|paydown|pay down|payoff|pay off)\b.{0,60}\b(debt|card|loan|mortgage)\b|\b(debt|card|loan|mortgage)\b.{0,60}\b(pay|payment)\b|\b(pay|payment)\b.{0,35}\b\d+(?:\.\d+)?\b/.test(text)) {
    kind = 'debt_payment'
  } else if (/\b(move|transfer|roll over|rollover|consolidate)\b.{0,90}\b(saving|account|fund|ira|401k|403b|brokerage|hysa|checking|invest)/.test(text)) {
    kind = 'transfer'
  } else if (/\b(contribute|deposit|fund|invest|add)\b.{0,70}\b(goal|saving|fund|ira|401k|403b|hsa|brokerage|account)\b/.test(text)) {
    kind = 'contribution'
  }

  const fromTo = clean(step.text).match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:[.,;]|$)/i)
  return {
    kind,
    amount: parseAmount(step.text),
    sourceAccountHint: clean(fromTo?.[1]) || null,
    destinationAccountHint: clean(fromTo?.[2]) || null,
    debtHint: kind === 'debt_payment' ? clean(step.text) : null,
    goalHint: /goal|emergency fund|down payment|vacation|house|car/i.test(step.text || '') ? clean(step.text) : null,
    accountSubtypeHint: accountKind(text),
    recurrence: kind === 'recurring_setup' ? (/payday/.test(text) ? 'payday' : /weekly/.test(text) ? 'weekly' : 'monthly') : null,
    intentKey: inferredIntent(text, kind),
    completionPolicy: ['transfer', 'contribution', 'debt_payment'].includes(kind) ? 'repeatable' : 'once',
  }
}

export function normalizeStepOutcome(step = {}) {
  const inferred = inferStepOutcome(step)
  const raw = step.outcome && typeof step.outcome === 'object' ? step.outcome : {}
  const rawKind = raw.kind || raw.type
  const kind = FINANCIAL_OUTCOME_KINDS.includes(rawKind) ? rawKind : inferred.kind
  const rawAmount = Number(raw.amount)
  const rawPolicy = step.completionPolicy || step.completion_policy || raw.completionPolicy || raw.completion_policy
  return {
    kind,
    amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : inferred.amount,
    sourceAccountHint: clean(raw.sourceAccountHint || raw.source_account_hint) || inferred.sourceAccountHint,
    destinationAccountHint: clean(raw.destinationAccountHint || raw.destination_account_hint) || inferred.destinationAccountHint,
    debtHint: clean(raw.debtHint || raw.debt_hint) || inferred.debtHint,
    goalHint: clean(raw.goalHint || raw.goal_hint) || inferred.goalHint,
    accountSubtypeHint: clean(raw.accountSubtypeHint || raw.account_subtype_hint) || inferred.accountSubtypeHint,
    recurrence: clean(raw.recurrence) || inferred.recurrence,
    intentKey: clean(step.intentKey || step.intent_key || raw.intentKey || raw.intent_key) || inferredIntent(normalized(step.text), kind),
    completionPolicy: ['once', 'repeatable'].includes(rawPolicy) ? rawPolicy : inferred.completionPolicy,
  }
}

function tokenScore(record, hint) {
  const words = new Set(normalized(hint).split(' ').filter(word => word.length > 2))
  if (!words.size) return 0
  const haystack = normalized(`${record.name || ''} ${record.institution || ''} ${record.type || ''} ${record.subtype || ''}`)
  let score = 0
  for (const word of words) if (haystack.includes(word)) score++
  return score
}

function bestMatch(records, hint) {
  if (!hint || !records.length) return null
  return records
    .map(record => ({ record, score: tokenScore(record, hint) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.record || null
}

export function resolveOutcomeTargets(outcome, { accounts = [], debts = [], goals = [] } = {}) {
  const cash = accounts.filter(account => accountFamily(account) === 'cash')
  const investments = accounts.filter(account => accountFamily(account) === 'investment')
  const checking = cash.filter(account => (account.subtype || account.type) === 'checking')
  const savings = cash.filter(account => (account.subtype || account.type) !== 'checking')

  let source = bestMatch(accounts, outcome.sourceAccountHint)
  let destination = bestMatch(accounts, outcome.destinationAccountHint)
  if (!source && ['transfer', 'debt_payment'].includes(outcome.kind) && checking.length === 1) source = checking[0]
  if (!destination && ['transfer', 'contribution', 'recurring_setup'].includes(outcome.kind)) {
    if (/ira|401k|403b|hsa|brokerage|invest/.test(outcome.accountSubtypeHint || '') && investments.length === 1) destination = investments[0]
    else if (/saving|hysa/.test(outcome.accountSubtypeHint || '') && savings.length === 1) destination = savings[0]
  }
  if (source?.id && destination?.id === source.id) destination = null

  const activeDebts = debts.filter(debt => Number(debt.balance) > 0)
  const debt = bestMatch(activeDebts, outcome.debtHint) || (outcome.kind === 'debt_payment' && activeDebts.length === 1 ? activeDebts[0] : null)
  const activeGoals = goals.filter(goal => Number(goal.target_amount) <= 0 || Number(goal.current_amount) < Number(goal.target_amount))
  const goal = bestMatch(activeGoals, outcome.goalHint) || (outcome.goalHint && activeGoals.length === 1 ? activeGoals[0] : null)

  return {
    sourceAccountId: source?.id || null,
    destinationAccountId: destination?.id || null,
    debtId: debt?.id || null,
    goalId: goal?.id || null,
  }
}

export function isPromptableActivity(activity) {
  return Boolean(activity && PROMPTABLE_KINDS.has(activity.kind) && activity.status === 'pending')
}

export function buildFinancialPreview({ activity, amount, sourceAccountId, destinationAccountId, debtId, goalId }, data = {}) {
  const accounts = data.accounts || []
  const debts = data.debts || []
  const goals = data.goals || []
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return { error: 'Enter the amount that moved.', updates: [] }

  const source = accounts.find(record => record.id === sourceAccountId)
  const destination = accounts.find(record => record.id === destinationAccountId)
  const debt = debts.find(record => record.id === debtId)
  const goal = goals.find(record => record.id === goalId)
  const updates = []
  let appliedAmount = value

  if (activity.kind === 'debt_payment') {
    if (!debt) return { error: 'Choose the debt that was paid.', updates: [] }
    appliedAmount = Math.min(value, Number(debt.balance) || 0)
    if (source && Number(source.balance) < appliedAmount) return { error: `${source.name} does not have enough tracked cash for this payment.`, updates: [] }
    if (source) updates.push({ entity: 'account', id: source.id, name: source.name, before: Number(source.balance) || 0, after: (Number(source.balance) || 0) - appliedAmount })
    updates.push({ entity: 'debt', id: debt.id, name: debt.name, before: Number(debt.balance) || 0, after: Math.max(0, (Number(debt.balance) || 0) - appliedAmount) })
  } else {
    if (!destination) return { error: 'Choose where the money went.', updates: [] }
    if (sourceAccountId && !source) return { error: 'Choose where the money came from.', updates: [] }
    if (source?.id === destination.id) return { error: 'Choose two different accounts.', updates: [] }
    if (source && Number(source.balance) < value) return { error: `${source.name} does not have enough tracked cash for this move.`, updates: [] }
    if (source) updates.push({ entity: 'account', id: source.id, name: source.name, before: Number(source.balance) || 0, after: (Number(source.balance) || 0) - value })
    updates.push({ entity: 'account', id: destination.id, name: destination.name, before: Number(destination.balance) || 0, after: (Number(destination.balance) || 0) + value })
  }

  if (goal) {
    const before = Number(goal.current_amount) || 0
    const target = Number(goal.target_amount) || 0
    updates.push({ entity: 'goal', id: goal.id, name: goal.name, before, after: target > 0 ? Math.min(target, before + appliedAmount) : before + appliedAmount })
  }

  return {
    error: null,
    amount: appliedAmount,
    updates,
    beforeState: Object.fromEntries(updates.map(update => [`${update.entity}:${update.id}`, update.before])),
    afterState: Object.fromEntries(updates.map(update => [`${update.entity}:${update.id}`, update.after])),
  }
}
