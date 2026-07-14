export const STAGE_NAMES = [
  'Seedbed',
  'Sprouting',
  'Taking Root',
  'Growing',
  'Blooming',
  'Flourishing',
  'Abundant',
  'Sanctuary',
]

export const STAGE_THRESHOLDS = [0, 1, 3, 6, 10, 16, 24, 36]

export const STAGE_COLORS = [
  '#c99a5b',
  '#a9bf68',
  '#75b85b',
  '#52ad4d',
  '#35a65a',
  '#2f9e67',
  '#34b981',
  '#5ee3a5',
]

export function milestonesToStage(total = 0) {
  const safeTotal = Math.max(0, Number(total) || 0)
  for (let index = STAGE_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (safeTotal >= STAGE_THRESHOLDS[index]) return index
  }
  return 0
}

export function stageProgress(total = 0) {
  const safeTotal = Math.max(0, Number(total) || 0)
  const stage = milestonesToStage(safeTotal)
  const currentThreshold = STAGE_THRESHOLDS[stage]
  const nextThreshold = STAGE_THRESHOLDS[stage + 1] ?? null
  const percent = nextThreshold === null
    ? 100
    : Math.max(0, Math.min(100, Math.round(
      ((safeTotal - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
    )))

  return {
    stage,
    currentThreshold,
    nextThreshold,
    percent,
    remaining: nextThreshold === null ? 0 : Math.max(0, nextThreshold - safeTotal),
  }
}

function legacyStepKey(planId, index) {
  return `step:${planId || 'legacy'}:${index}`
}

export function milestoneEventForStep(plan, step, index = 0) {
  if (!step?.done) return null
  return {
    kind: 'plan_step',
    source_key: step.id ? `step:${step.id}` : legacyStepKey(plan?.id, index),
    label: step.text || 'Completed a plan step',
    metadata: { planId: plan?.id || null },
    earned_at: step.completedAt || plan?.updated_at || new Date().toISOString(),
  }
}

export function milestoneEventForGoal(goal) {
  const target = Number(goal?.target_amount) || 0
  const current = Number(goal?.current_amount) || 0
  if (!goal?.id || target <= 0 || current < target) return null
  return {
    kind: 'goal',
    source_key: `goal:${goal.id}`,
    label: goal.name || 'Reached a goal',
    metadata: { goalId: goal.id, goalType: goal.goal_type || 'savings' },
    earned_at: goal.updated_at || new Date().toISOString(),
  }
}

export function milestoneEventsFromState({ plans = [], goals = [] } = {}) {
  return [
    ...plans.flatMap(plan => (Array.isArray(plan?.steps) ? plan.steps : [])
      .map((step, index) => milestoneEventForStep(plan, step, index))
      .filter(Boolean)),
    ...goals.map(milestoneEventForGoal).filter(Boolean),
  ]
}

export function gardenMomentum({ milestones = [], goals = [], now = Date.now() } = {}) {
  const dates = [
    ...milestones.map(item => item?.earned_at),
    ...goals.map(goal => goal?.updated_at || goal?.created_at),
  ]
    .filter(Boolean)
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite)

  if (!dates.length) return 'resting'
  const days = Math.max(0, (now - Math.max(...dates)) / 86400000)
  if (days <= 7) return 'lively'
  if (days <= 30) return 'gentle'
  return 'resting'
}

export function sceneToneFromCashFlow(income = 0, expenses = 0) {
  const safeIncome = Number(income) || 0
  const safeExpenses = Number(expenses) || 0
  return safeIncome > 0 && safeExpenses > safeIncome ? 'strained' : 'calm'
}

export function groupGardenGoals(goals = [], milestones = [], visibleLimit = 5) {
  const ordered = [...goals].sort((left, right) => {
    const leftDate = new Date(left.created_at || 0).getTime()
    const rightDate = new Date(right.created_at || 0).getTime()
    return leftDate - rightDate
  })
  const active = ordered.filter(goal => {
    const target = Number(goal.target_amount) || 0
    return target <= 0 || Number(goal.current_amount || 0) < target
  })
  const legacy = milestones
    .filter(item => item.kind === 'goal')
    .sort((left, right) => new Date(right.earned_at || 0) - new Date(left.earned_at || 0))

  return {
    visible: active.slice(0, visibleLimit),
    overflow: active.slice(visibleLimit),
    legacy,
  }
}
