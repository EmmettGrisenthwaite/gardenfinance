export const NEXT_CHAPTER_THRESHOLD = 2

const STOPWORDS = new Set([
  'a', 'an', 'the', 'your', 'you', 'my', 'i', 'me', 'to', 'so', 'can', 'at',
  'for', 'of', 'on', 'in', 'with', 'and', 'or', 'is', 'are', 'it', 'that',
  'this', 'about', 'any', 'once', 'even', 'get', 'see',
])

export function planStepKey(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\$?[\d,.]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentWords(key) {
  return new Set(key.split(' ').filter(word => word && !STOPWORDS.has(word)))
}

export function samePlanStep(leftText, rightText) {
  const leftKey = planStepKey(leftText)
  const rightKey = planStepKey(rightText)
  if (!leftKey || !rightKey) return false
  if (leftKey.includes(rightKey) || rightKey.includes(leftKey)) return true
  const left = contentWords(leftKey)
  const right = contentWords(rightKey)
  if (left.size < 4 || right.size < 4) return false
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / (left.size + right.size - shared) >= 0.6
}

export function filterFreshPlanSteps(existingSteps = [], incomingSteps = [], { dedupeCompleted = false } = {}) {
  const comparisonSteps = existingSteps.filter(step => dedupeCompleted || !step?.done)
  const fresh = []
  let skipped = 0
  for (const step of incomingSteps) {
    const text = step?.text || ''
    const intentKey = step?.intentKey || step?.intent_key || null
    const duplicateIntent = intentKey && comparisonSteps.some(existing => {
      if ((existing?.intentKey || existing?.intent_key) !== intentKey) return false
      const policy = step?.completionPolicy || step?.completion_policy || 'once'
      if (policy !== 'repeatable') return true
      const previousState = existing?.outcome?.stateFingerprint
      const nextState = step?.outcome?.stateFingerprint
      return !previousState || !nextState || previousState === nextState
    })
    if (!text.trim() || duplicateIntent || comparisonSteps.some(existing => samePlanStep(existing?.text || '', text))) {
      skipped++
      continue
    }
    fresh.push(step)
    comparisonSteps.push(step)
  }
  return { fresh, skipped }
}

function sortedRecords(records, project) {
  return (records || [])
    .map(project)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

function hashState(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function nextChapterFingerprint({ userId, profile, steps, goals, debts, accounts, cashFlowItems = [], budgetLimits = [], activities = [] }) {
  const state = {
    userId: userId || '',
    profile: {
      age: Number(profile?.age) || 0,
      monthly_income: Number(profile?.monthly_income) || 0,
      monthly_expenses: Number(profile?.monthly_expenses) || 0,
      primary_goal: profile?.primary_goal || '',
      employment_type: profile?.employment_type || '',
      income_stability: profile?.income_stability || '',
      health_insurance: profile?.health_insurance || '',
      employer_401k: profile?.employer_401k || '',
      investment_types: [...(profile?.investment_types || [])].sort(),
    },
    steps: sortedRecords(steps, step => ({
      id: step?.id || '', text: step?.text || '', done: Boolean(step?.done),
      detail: step?.detail || '', impact: step?.impact || '', due: step?.due || '',
      apply: step?.apply || null, completedAt: step?.completedAt || '',
      intentKey: step?.intentKey || '', completionPolicy: step?.completionPolicy || '', outcome: step?.outcome || null,
      doneWhen: step?.doneWhen || '', priorityKey: step?.priorityKey || '', basis: step?.basis || null,
      chapterId: step?.chapterId || '', chapterOrder: step?.chapterOrder ?? null,
      generatedForFingerprint: step?.generatedForFingerprint || '', pinnedAt: step?.pinnedAt || '',
      supersededAt: step?.supersededAt || '', guideFingerprint: step?.guideFingerprint || '',
    })),
    goals: sortedRecords(goals, goal => ({
      id: goal?.id || '', name: goal?.name || '', target: Number(goal?.target_amount) || 0,
      current: Number(goal?.current_amount) || 0, monthly: Number(goal?.monthly_contribution) || 0,
      type: goal?.goal_type || '', deadline: goal?.deadline || '',
    })),
    debts: sortedRecords(debts, debt => ({
      id: debt?.id || '', name: debt?.name || '', balance: Number(debt?.balance) || 0,
      type: debt?.type || '', rate: Number(debt?.interest_rate) || 0,
      minimum: Number(debt?.minimum_payment) || 0, planned: Number(debt?.planned_payment) || 0,
      limit: Number(debt?.credit_limit) || 0, included: debt?.include_in_net_worth !== false,
    })),
    accounts: sortedRecords(accounts, account => ({
      id: account?.id || '', name: account?.name || '', type: account?.type || '',
      subtype: account?.subtype || '', institution: account?.institution || '',
      balance: Number(account?.balance) || 0, rate: Number(account?.interest_rate) || 0,
      contribution: Number(account?.monthly_contribution) || 0,
      contributionPercent: Number(account?.contribution_percent) || 0,
      match: Number(account?.employer_match_percent) || 0,
      matchLimit: Number(account?.employer_match_limit_percent) || 0,
      liquid: account?.is_liquid ?? null, included: account?.include_in_net_worth !== false,
    })),
    cashFlowItems: sortedRecords(cashFlowItems, item => ({
      id: item?.id || '', kind: item?.kind || '', group: item?.group_key || '',
      category: item?.category_key || '', name: item?.name || '',
      amount: Number(item?.amount) || 0, frequency: item?.frequency || 'monthly',
      monthly: Number(item?.monthly_amount) || 0,
    })),
    budgetLimits: sortedRecords(budgetLimits, limit => ({
      category: limit?.category || '', monthly: Number(limit?.monthly_limit) || 0,
    })),
    activities: sortedRecords(activities, activity => ({
      id: activity?.id || '', source: activity?.source_key || '', intent: activity?.intent_key || '',
      kind: activity?.kind || '', status: activity?.status || '', amount: Number(activity?.amount) || 0,
      sourceAccount: activity?.source_account_id || '', destinationAccount: activity?.destination_account_id || '',
      debt: activity?.debt_id || '', goal: activity?.goal_id || '', appliedAt: activity?.applied_at || '',
    })),
  }
  return `next-v2-${hashState(JSON.stringify(state))}`
}

export function shouldRequestNextChapter({
  activeCount,
  fingerprint,
  loading = false,
  busy = false,
  hasDraft = false,
  attemptedFingerprint = null,
  dismissedFingerprint = null,
}) {
  return Number(activeCount) <= NEXT_CHAPTER_THRESHOLD && Boolean(fingerprint) && !loading && !busy &&
    !hasDraft && attemptedFingerprint !== fingerprint && dismissedFingerprint !== fingerprint
}

export function isCurrentNextChapter(requestFingerprint, currentFingerprint) {
  return Boolean(requestFingerprint) && requestFingerprint === currentFingerprint
}
