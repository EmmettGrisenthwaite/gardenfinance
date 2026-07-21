import { daysSince, isWorkplaceAccount } from './moneyModel.js'

const DAY_MS = 86400000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const number = value => Number(value) || 0

function asDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }
  const text = String(value || '').slice(0, 10)
  if (!DATE_ONLY.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return date
}

export function toDateKey(value = new Date()) {
  const date = asDate(value)
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

export function addCalendarDays(value, amount) {
  const date = asDate(value)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + Number(amount || 0))
  return toDateKey(date)
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

// Every quarterly occurrence is derived from the original anchor. Jan 31 thus
// becomes Apr 30, Jul 31, Oct 31—not a permanently shifted series of the 30th.
export function addAnchoredMonths(anchorValue, monthOffset) {
  const anchor = asDate(anchorValue)
  if (!anchor) return null
  const totalMonths = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + Number(monthOffset || 0)
  const year = Math.floor(totalMonths / 12)
  const month = ((totalMonths % 12) + 12) % 12
  const day = Math.min(anchor.getUTCDate(), daysInMonth(year, month))
  return toDateKey(new Date(Date.UTC(year, month, day)))
}

export function nextAnchoredOccurrence(anchorValue, cadence, afterValue) {
  const anchor = asDate(anchorValue)
  const after = asDate(afterValue)
  if (!anchor || !after || !['weekly', 'quarterly'].includes(cadence)) return null
  if (anchor > after) return toDateKey(anchor)

  if (cadence === 'weekly') {
    const elapsedDays = Math.floor((after.getTime() - anchor.getTime()) / DAY_MS)
    return addCalendarDays(anchor, (Math.floor(elapsedDays / 7) + 1) * 7)
  }

  const monthDistance = Math.max(
    0,
    (after.getUTCFullYear() - anchor.getUTCFullYear()) * 12
      + after.getUTCMonth() - anchor.getUTCMonth(),
  )
  let quarter = Math.max(1, Math.floor(monthDistance / 3))
  let candidate = addAnchoredMonths(anchor, quarter * 3)
  while (candidate && asDate(candidate) <= after) {
    quarter += 1
    candidate = addAnchoredMonths(anchor, quarter * 3)
  }
  return candidate
}

export function previewOccurrences(anchorValue, cadence, count = 3) {
  const anchor = toDateKey(anchorValue)
  if (!anchor || !['weekly', 'quarterly'].includes(cadence)) return []
  return Array.from({ length: Math.max(0, count) }, (_, index) => (
    cadence === 'weekly'
      ? addCalendarDays(anchor, index * 7)
      : addAnchoredMonths(anchor, index * 3)
  ))
}

export function advanceReminder(reminder, actionDate = new Date()) {
  const today = toDateKey(actionDate)
  return nextAnchoredOccurrence(reminder?.anchor_date, reminder?.cadence, today)
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stableValue(value[key])]),
    )
  }
  return value ?? null
}

export function reminderFingerprint(value) {
  const text = JSON.stringify(stableValue(value))
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `rem-${(hash >>> 0).toString(36)}`
}

function firstMondayOnOrAfter(value) {
  const date = asDate(value)
  if (!date) return null
  const offset = (8 - date.getUTCDay()) % 7
  return addCalendarDays(date, offset)
}

function firstDayOfNextQuarter(value) {
  const date = asDate(value)
  if (!date) return null
  const nextQuarterMonth = Math.floor(date.getUTCMonth() / 3) * 3 + 3
  return toDateKey(new Date(Date.UTC(date.getUTCFullYear(), nextQuarterMonth, 1)))
}

function goalActive(goal) {
  return number(goal?.target_amount) > 0 && number(goal?.current_amount) < number(goal?.target_amount)
}

function debtActive(debt) {
  return number(debt?.balance) > 0
}

function nearestGoal(goals = []) {
  return goals.filter(goalActive).sort((left, right) => {
    const leftDeadline = asDate(left?.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightDeadline = asDate(right?.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline
    return String(left?.created_at || left?.id || '').localeCompare(String(right?.created_at || right?.id || ''))
  })[0] || null
}

function highestAprDebt(debts = []) {
  return debts.filter(debtActive).sort((left, right) => {
    const apr = number(right?.interest_rate) - number(left?.interest_rate)
    if (apr) return apr
    return number(right?.balance) - number(left?.balance)
  })[0] || null
}

function recordFreshness(record, now) {
  const age = daysSince(record?.last_verified_at, asDate(now) || new Date())
  return { missing: age === null, age }
}

function staleMoneyRecords(accounts, debts, now) {
  return [...accounts, ...debts]
    .filter(record => {
      const freshness = recordFreshness(record, now)
      return freshness.missing || freshness.age >= 90
    })
    .sort((left, right) => {
      const leftDate = left?.last_verified_at || ''
      const rightDate = right?.last_verified_at || ''
      return leftDate.localeCompare(rightDate)
    })
}

function candidateEvidence(rule, values) {
  return reminderFingerprint({ rule, ...values })
}

function weeklyCandidate({ snapshot, debts, goals, today }) {
  if (number(snapshot?.income) > 0 && number(snapshot?.cashFlowMargin) < 0) {
    const gap = Math.abs(Math.round(number(snapshot.cashFlowMargin)))
    const sourceFingerprint = candidateEvidence('weekly.monthly_plan', { state: 'deficit', gap })
    return {
      candidateKey: 'weekly.monthly_plan',
      sourceFingerprint,
      cadence: 'weekly',
      title: 'Check the Monthly Plan',
      detail: `Typical spending is $${gap.toLocaleString()} above monthly income. Use this check-in to adjust one category.`,
      anchorDate: firstMondayOnOrAfter(today),
      linkedRecordType: 'monthly_plan',
      linkedRecordId: null,
      evidence: `Monthly cash-flow gap: $${gap.toLocaleString()}`,
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'weekly.monthly_plan', state: 'deficit', amount: gap },
    }
  }
  if (number(snapshot?.income) > 0 && number(snapshot?.unallocated) < 0) {
    const gap = Math.abs(Math.round(number(snapshot.unallocated)))
    const sourceFingerprint = candidateEvidence('weekly.monthly_plan', { state: 'overcommitted', gap })
    return {
      candidateKey: 'weekly.monthly_plan',
      sourceFingerprint,
      cadence: 'weekly',
      title: 'Check planned allocations',
      detail: `Future allocations exceed available monthly cash by $${gap.toLocaleString()}. Use this check-in to keep the plan realistic.`,
      anchorDate: firstMondayOnOrAfter(today),
      linkedRecordType: 'monthly_plan',
      linkedRecordId: null,
      evidence: `Overcommitted by $${gap.toLocaleString()} each month`,
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'weekly.monthly_plan', state: 'overcommitted', amount: gap },
    }
  }

  const debt = highestAprDebt(debts)
  if (debt) {
    const sourceFingerprint = candidateEvidence('weekly.debt_progress', {
      debtId: debt.id,
      balance: Math.round(number(debt.balance)),
      apr: number(debt.interest_rate),
    })
    return {
      candidateKey: `weekly.debt_progress.${debt.id}`,
      sourceFingerprint,
      cadence: 'weekly',
      title: `Check progress on ${debt.name || 'your highest-rate debt'}`,
      detail: 'Record the latest balance after a payment so future recommendations use current information.',
      anchorDate: firstMondayOnOrAfter(today),
      linkedRecordType: 'debt',
      linkedRecordId: debt.id || null,
      evidence: number(debt.interest_rate) > 0
        ? `${number(debt.interest_rate).toLocaleString()}% APR · $${Math.round(number(debt.balance)).toLocaleString()} balance`
        : `$${Math.round(number(debt.balance)).toLocaleString()} balance`,
      actionLabel: 'Update debt',
      actionTarget: '/?sheet=debts',
      metadata: { rule: 'weekly.debt_progress', debtId: debt.id || null },
    }
  }

  const goal = nearestGoal(goals)
  if (!goal) return null
  const progress = Math.min(100, Math.round(number(goal.current_amount) / number(goal.target_amount) * 100))
  return {
    candidateKey: `weekly.goal_progress.${goal.id}`,
    sourceFingerprint: candidateEvidence('weekly.goal_progress', {
      goalId: goal.id,
      current: Math.round(number(goal.current_amount)),
      target: Math.round(number(goal.target_amount)),
      deadline: goal.deadline || null,
    }),
    cadence: 'weekly',
    title: `Update ${goal.name || 'your nearest goal'}`,
    detail: 'A brief weekly update keeps the projection useful without turning it into daily bookkeeping.',
    anchorDate: firstMondayOnOrAfter(today),
    linkedRecordType: 'goal',
    linkedRecordId: goal.id || null,
    evidence: `${progress}% of the $${Math.round(number(goal.target_amount)).toLocaleString()} target`,
    actionLabel: 'Update goal',
    actionTarget: `/plan?goal=${encodeURIComponent(goal.id || '')}#goals`,
    metadata: { rule: 'weekly.goal_progress', goalId: goal.id || null },
  }
}

function quarterlyCandidate({ profile, accounts, debts, goals, today }) {
  if (['freelance', 'self_employed'].includes(profile?.employment_type)) {
    return {
      candidateKey: 'quarterly.estimated_tax',
      sourceFingerprint: candidateEvidence('quarterly.estimated_tax', {
        employment: profile.employment_type,
      }),
      cadence: 'quarterly',
      title: 'Review estimated-tax preparation',
      detail: 'Confirm that income records and tax savings are current. This check-in does not estimate a payment or replace tax advice.',
      anchorDate: firstDayOfNextQuarter(today),
      linkedRecordType: 'profile',
      linkedRecordId: null,
      evidence: 'Employment is recorded as self-employed',
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'quarterly.estimated_tax' },
    }
  }

  const stale = staleMoneyRecords(accounts, debts, today)
  if (stale.length) {
    const ids = stale.map(record => record.id).filter(Boolean).sort()
    const labels = stale.slice(0, 2).map(record => record.name || record.institution || 'financial record')
    return {
      candidateKey: 'quarterly.refresh_records',
      sourceFingerprint: candidateEvidence('quarterly.refresh_records', {
        records: stale.map(record => [record.id || record.name, record.last_verified_at || null]),
      }),
      cadence: 'quarterly',
      title: 'Refresh account and debt balances',
      detail: 'A quarterly refresh keeps net worth and recommendations grounded in current balances.',
      anchorDate: firstDayOfNextQuarter(today),
      linkedRecordType: 'money_records',
      linkedRecordId: null,
      evidence: `${stale.length} ${stale.length === 1 ? 'record needs' : 'records need'} verification${labels.length ? `: ${labels.join(', ')}` : ''}`,
      actionLabel: 'Update balances',
      actionTarget: '/?sheet=balances',
      metadata: { rule: 'quarterly.refresh_records', recordIds: ids },
    }
  }

  const workplace = accounts.find(isWorkplaceAccount)
  if (workplace) {
    return {
      candidateKey: `quarterly.workplace_match.${workplace.id}`,
      sourceFingerprint: candidateEvidence('quarterly.workplace_match', {
        accountId: workplace.id,
        contribution: workplace.contribution_percent ?? null,
        match: workplace.employer_match_percent ?? null,
        matchLimit: workplace.employer_match_limit_percent ?? null,
      }),
      cadence: 'quarterly',
      title: `Confirm ${workplace.name || 'workplace plan'} contributions`,
      detail: 'Check the contribution and employer-match details against a recent pay statement.',
      anchorDate: firstDayOfNextQuarter(today),
      linkedRecordType: 'account',
      linkedRecordId: workplace.id || null,
      evidence: 'A workplace retirement account is on file',
      actionLabel: 'Open account',
      actionTarget: '/?section=money&sheet=accounts',
      metadata: { rule: 'quarterly.workplace_match', accountId: workplace.id || null },
    }
  }

  const goal = nearestGoal(goals)
  if (!goal) return null
  const progress = Math.min(100, Math.round(number(goal.current_amount) / number(goal.target_amount) * 100))
  return {
    candidateKey: `quarterly.goal_pace.${goal.id}`,
    sourceFingerprint: candidateEvidence('quarterly.goal_pace', {
      goalId: goal.id,
      current: Math.round(number(goal.current_amount)),
      target: Math.round(number(goal.target_amount)),
      contribution: Math.round(number(goal.monthly_contribution)),
      deadline: goal.deadline || null,
    }),
    cadence: 'quarterly',
    title: `Review the pace of ${goal.name || 'your nearest goal'}`,
    detail: 'Compare progress and the current monthly contribution with the goal date.',
    anchorDate: firstDayOfNextQuarter(today),
    linkedRecordType: 'goal',
    linkedRecordId: goal.id || null,
    evidence: `${progress}% complete${goal.deadline ? ` · target date ${goal.deadline}` : ''}`,
    actionLabel: 'Update goal',
    actionTarget: `/plan?goal=${encodeURIComponent(goal.id || '')}#goals`,
    metadata: { rule: 'quarterly.goal_pace', goalId: goal.id || null },
  }
}

function candidateSuppressed(candidate, reminders) {
  if (!candidate) return true
  return reminders.some(reminder => {
    if (reminder?.candidate_key !== candidate.candidateKey) return false
    if (['active', 'paused', 'archived'].includes(reminder.status)) return true
    return reminder.status === 'dismissed'
      && reminder.source_fingerprint === candidate.sourceFingerprint
  })
}

function autoBasis(reminder, context) {
  const rule = reminder?.metadata?.rule
  const linkedId = reminder?.linked_record_id
  if (!rule) return { active: true, fingerprint: null }

  let active = true
  let basis = {}
  if (rule === 'weekly.monthly_plan') {
    const deficit = number(context.snapshot?.income) > 0 && number(context.snapshot?.cashFlowMargin) < 0
    const overcommitted = number(context.snapshot?.income) > 0 && number(context.snapshot?.unallocated) < 0
    active = deficit || overcommitted
    basis = { deficit, overcommitted }
  } else if (rule === 'weekly.debt_progress') {
    const debt = context.debts.find(item => item.id === linkedId)
    active = debtActive(debt)
    basis = { id: debt?.id, balance: Math.round(number(debt?.balance)) }
  } else if (['weekly.goal_progress', 'quarterly.goal_pace'].includes(rule)) {
    const goal = context.goals.find(item => item.id === linkedId)
    active = goalActive(goal)
    basis = { id: goal?.id, current: Math.round(number(goal?.current_amount)), target: Math.round(number(goal?.target_amount)) }
  } else if (rule === 'quarterly.estimated_tax') {
    active = ['freelance', 'self_employed'].includes(context.profile?.employment_type)
    basis = { employment: context.profile?.employment_type || null }
  } else if (rule === 'quarterly.refresh_records') {
    const stale = staleMoneyRecords(context.accounts, context.debts, context.today)
    active = stale.length > 0
    basis = { records: stale.map(record => [record.id || record.name, record.last_verified_at || null]) }
  } else if (rule === 'quarterly.workplace_match') {
    const account = context.accounts.find(item => item.id === linkedId)
    active = Boolean(account && isWorkplaceAccount(account))
    basis = { id: account?.id, subtype: account?.subtype, contribution: account?.contribution_percent ?? null }
  }
  return { active, fingerprint: candidateEvidence(rule, basis) }
}

function staleReview(reminders, context) {
  return reminders
    .filter(reminder => (
      reminder?.source === 'automatic'
      && ['active', 'paused'].includes(reminder?.status)
      && !reminder?.user_edited
    ))
    .map(reminder => ({ reminder, basis: autoBasis(reminder, context) }))
    .find(({ reminder, basis }) => (
      !basis.active
      && reminder?.metadata?.review_suppressed_fingerprint !== basis.fingerprint
    )) || null
}

function dueDate(reminder) {
  return reminder?.snoozed_until || reminder?.next_due_on || reminder?.anchor_date || null
}

function sortByDue(left, right) {
  return String(dueDate(left) || '').localeCompare(String(dueDate(right) || ''))
}

export function buildReminderModel({
  snapshot = {},
  profile = {},
  accounts = [],
  debts = [],
  goals = [],
  activities = [],
  reminders = [],
  events = [],
  now = new Date(),
} = {}) {
  const today = toDateKey(now)
  const active = reminders.filter(reminder => reminder?.status === 'active')
  const due = active
    .filter(reminder => dueDate(reminder) && dueDate(reminder) <= today)
    .sort(sortByDue)
  const weekly = active.filter(reminder => reminder?.cadence === 'weekly').sort(sortByDue)
  const quarterly = active.filter(reminder => reminder?.cadence === 'quarterly').sort(sortByDue)

  const context = { snapshot, profile, accounts, debts, goals, activities, reminders, events, today }
  const weeklySuggestion = weeklyCandidate(context)
  const quarterlySuggestion = quarterlyCandidate(context)
  const suggestions = [weeklySuggestion, quarterlySuggestion]
    .filter(candidate => candidate && !candidateSuppressed(candidate, reminders))

  const reviewMatch = staleReview(reminders, context)
  const review = reviewMatch ? {
    reminder: reviewMatch.reminder,
    basisFingerprint: reviewMatch.basis.fingerprint,
    reason: 'The financial information that created this automatic reminder has changed.',
  } : null

  return {
    due,
    weekly,
    quarterly,
    suggestions,
    review,
    counts: {
      due: due.length,
      weeklyDue: due.filter(reminder => reminder.cadence === 'weekly').length,
      quarterlyDue: due.filter(reminder => reminder.cadence === 'quarterly').length,
      weekly: weekly.length,
      quarterly: quarterly.length,
      activeGoals: goals.filter(goalActive).length,
    },
    fingerprint: reminderFingerprint({
      today,
      snapshot: {
        income: snapshot?.income,
        cashFlowMargin: snapshot?.cashFlowMargin,
        unallocated: snapshot?.unallocated,
      },
      profile: { employment_type: profile?.employment_type },
      accounts: accounts.map(account => ({
        id: account.id,
        subtype: account.subtype,
        balance: account.balance,
        last_verified_at: account.last_verified_at,
        contribution_percent: account.contribution_percent,
        employer_match_percent: account.employer_match_percent,
        employer_match_limit_percent: account.employer_match_limit_percent,
      })),
      debts: debts.map(debt => ({ id: debt.id, balance: debt.balance, interest_rate: debt.interest_rate, last_verified_at: debt.last_verified_at })),
      goals: goals.map(goal => ({ id: goal.id, current_amount: goal.current_amount, target_amount: goal.target_amount, deadline: goal.deadline })),
      reminders: reminders.map(reminder => ({ id: reminder.id, status: reminder.status, next_due_on: reminder.next_due_on, snoozed_until: reminder.snoozed_until, source_fingerprint: reminder.source_fingerprint })),
      events: events.slice(0, 25).map(event => ({ id: event.id, reminder_id: event.reminder_id, action: event.action, scheduled_for: event.scheduled_for })),
    }),
  }
}
