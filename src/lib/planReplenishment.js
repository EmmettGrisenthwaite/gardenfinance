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
  const comparisonTexts = existingSteps
    .filter(step => dedupeCompleted || !step?.done)
    .map(step => step?.text || '')
    .filter(Boolean)
  const fresh = []
  let skipped = 0
  for (const step of incomingSteps) {
    const text = step?.text || ''
    if (!text.trim() || comparisonTexts.some(existing => samePlanStep(existing, text))) {
      skipped++
      continue
    }
    fresh.push(step)
    comparisonTexts.push(text)
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

export function nextChapterFingerprint({ userId, profile, steps, goals, debts, accounts }) {
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
    })),
    goals: sortedRecords(goals, goal => ({
      id: goal?.id || '', name: goal?.name || '', target: Number(goal?.target_amount) || 0,
      current: Number(goal?.current_amount) || 0, monthly: Number(goal?.monthly_contribution) || 0,
      type: goal?.goal_type || '', deadline: goal?.deadline || '',
    })),
    debts: sortedRecords(debts, debt => ({
      id: debt?.id || '', name: debt?.name || '', balance: Number(debt?.balance) || 0,
      rate: Number(debt?.interest_rate) || 0,
    })),
    accounts: sortedRecords(accounts, account => ({
      id: account?.id || '', name: account?.name || '', type: account?.type || '',
      balance: Number(account?.balance) || 0, rate: Number(account?.interest_rate) || 0,
    })),
  }
  return `next-v1-${hashState(JSON.stringify(state))}`
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
