import { accountFamily, daysSince, isWorkplaceAccount } from './moneyModel.js'
import { LIMITS } from './finance.js'

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

// A sensible default first date so a blank manual reminder is already scheduled:
// the next Monday for weekly, the next quarter start for quarterly.
export function suggestedAnchor(cadence, now = new Date()) {
  const today = toDateKey(now)
  if (cadence === 'weekly') return firstMondayOnOrAfter(today)
  if (cadence === 'quarterly') return firstDayOfNextQuarter(today)
  return today
}

// One-tap starting points for the manual editor. Each fully prefills the form so
// adding a common reminder is a tap plus Save. `linkedRecordType` is only set for
// link targets that need no record id (Monthly Plan, all balances).
const REMINDER_TEMPLATES = {
  weekly: [
    { key: 'budget', title: "Review this week's budget", detail: 'Check spending against your plan and adjust one category.', linkedRecordType: 'monthly_plan', category: 'budget' },
    { key: 'debt', title: 'Check debt payoff progress', detail: 'Record the latest balance after a payment.', linkedRecordType: '', category: 'debt' },
    { key: 'savings', title: 'Move money to savings', detail: "Send this week's amount toward your reserve or a goal.", linkedRecordType: 'money_records', category: 'savings' },
    { key: 'goal', title: 'Update a goal', detail: 'Log progress so the projection stays current.', linkedRecordType: '', category: 'goals' },
  ],
  quarterly: [
    { key: 'taxes', title: 'Review estimated taxes', detail: 'Confirm income and tax set-aside are current. Not tax advice.', linkedRecordType: '', category: 'taxes' },
    { key: 'balances', title: 'Refresh all balances', detail: 'Update account and debt balances so net worth stays accurate.', linkedRecordType: 'money_records', category: 'accounts' },
    { key: 'rate', title: 'Check my savings APY', detail: 'Rates move — confirm your cash still earns a competitive yield.', linkedRecordType: '', category: 'accounts' },
    { key: 'retirement', title: 'Confirm 401(k) contribution & match', detail: 'Check your contribution and employer match on a recent paystub.', linkedRecordType: '', category: 'retirement' },
  ],
}

export function reminderTemplates(cadence) {
  return REMINDER_TEMPLATES[cadence] || []
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

// ── Category-aware suggestion engine ────────────────────────────────────────
// Deterministic rules read the user's real records; each returns a fully-formed
// candidate or null. Rules below are listed by importance. buildReminderModel
// surfaces the single most valuable non-suppressed candidate per cadence, so
// approving or dismissing one reveals the next category (taxes, budgeting, debt,
// savings, retirement, investing, accounts, goals).

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// IRS estimated-tax deadlines: Apr 15, Jun 15, Sep 15, and Jan 15 of next year.
const TAX_DEADLINES = [[3, 15], [5, 15], [8, 15], [0, 15]]
const COMPETITIVE_APY = 3.75

const subtypeOf = account => String(account?.subtype || account?.type || '').toLowerCase()

function laterDateKey(left, right) {
  if (!left) return right
  if (!right) return left
  return left >= right ? left : right
}

// The next estimated-tax deadline strictly after `today`, so a self-employed
// user's reminder lands ahead of a real IRS date instead of a generic quarter.
function nextTaxDeadline(todayValue) {
  const today = asDate(todayValue)
  if (!today) return null
  const year = today.getUTCFullYear()
  return [year, year + 1]
    .flatMap(annum => TAX_DEADLINES.map(([month, day]) => new Date(Date.UTC(annum, month, day))))
    .filter(date => date > today)
    .sort((left, right) => left - right)
    .map(date => toDateKey(date))[0] || null
}

function taxDeadlineLabel(dateKey) {
  const date = asDate(dateKey)
  if (!date) return ''
  const quarter = { 3: 'Q1', 5: 'Q2', 8: 'Q3', 0: 'Q4 (prior year)' }[date.getUTCMonth()] || ''
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}${quarter ? ` · ${quarter}` : ''}`
}

function weeklyCandidates(context) {
  const { snapshot, debts, goals, today } = context
  const anchorDate = firstMondayOnOrAfter(today)
  const income = number(snapshot?.income)
  const surplus = Math.round(number(snapshot?.cashFlowMargin))
  const list = []

  // 1. Budgeting — a spending deficit outranks everything: nothing else matters
  //    while more goes out than comes in. Overcommitted allocations are the
  //    softer sibling and share the same plan check-in key.
  if (income > 0 && number(snapshot?.cashFlowMargin) < 0) {
    const gap = Math.abs(surplus)
    list.push({
      candidateKey: 'weekly.monthly_plan',
      category: 'budget',
      sourceFingerprint: candidateEvidence('weekly.monthly_plan', { state: 'deficit', gap }),
      cadence: 'weekly',
      title: 'Rebalance the Monthly Plan',
      detail: `Typical spending is $${gap.toLocaleString()} above monthly income. Use this check-in to trim one category back into the black.`,
      anchorDate,
      linkedRecordType: 'monthly_plan',
      linkedRecordId: null,
      evidence: `Cash-flow gap: $${gap.toLocaleString()}/mo over income`,
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'weekly.monthly_plan', category: 'budget', state: 'deficit', amount: gap },
    })
  } else if (income > 0 && number(snapshot?.unallocated) < 0) {
    const gap = Math.abs(Math.round(number(snapshot.unallocated)))
    list.push({
      candidateKey: 'weekly.monthly_plan',
      category: 'budget',
      sourceFingerprint: candidateEvidence('weekly.monthly_plan', { state: 'overcommitted', gap }),
      cadence: 'weekly',
      title: 'Right-size planned allocations',
      detail: `Future allocations exceed available monthly cash by $${gap.toLocaleString()}. Keep the plan realistic so the surplus is real.`,
      anchorDate,
      linkedRecordType: 'monthly_plan',
      linkedRecordId: null,
      evidence: `Overcommitted by $${gap.toLocaleString()}/mo`,
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'weekly.monthly_plan', category: 'budget', state: 'overcommitted', amount: gap },
    })
  }

  // 2. Debt — the highest-APR balance is the most expensive dollar; keeping it
  //    current keeps payoff math honest.
  const debt = highestAprDebt(debts)
  if (debt) {
    list.push({
      candidateKey: `weekly.debt_progress.${debt.id}`,
      category: 'debt',
      sourceFingerprint: candidateEvidence('weekly.debt_progress', {
        debtId: debt.id,
        balance: Math.round(number(debt.balance)),
        apr: number(debt.interest_rate),
      }),
      cadence: 'weekly',
      title: `Log progress on ${debt.name || 'your highest-rate debt'}`,
      detail: 'Record the balance after each payment so payoff timelines and recommendations stay current.',
      anchorDate,
      linkedRecordType: 'debt',
      linkedRecordId: debt.id || null,
      evidence: number(debt.interest_rate) > 0
        ? `${number(debt.interest_rate).toLocaleString()}% APR · $${Math.round(number(debt.balance)).toLocaleString()} balance`
        : `$${Math.round(number(debt.balance)).toLocaleString()} balance`,
      actionLabel: 'Update debt',
      actionTarget: '/?sheet=debts',
      metadata: { rule: 'weekly.debt_progress', category: 'debt', debtId: debt.id || null },
    })
  }

  // 3. Debt — high credit utilization quietly costs credit-score points; a
  //    mid-cycle paydown is the fix.
  const utilization = number(snapshot?.cardUtilization)
  if (utilization > 0.3) {
    const card = (debts || []).filter(debtActive).find(item => item.type === 'credit_card')
    const pct = Math.round(utilization * 100)
    list.push({
      candidateKey: 'weekly.card_utilization',
      category: 'debt',
      sourceFingerprint: candidateEvidence('weekly.card_utilization', { bucket: Math.min(100, Math.round(pct / 5) * 5) }),
      cadence: 'weekly',
      title: 'Bring credit utilization down',
      detail: 'Keeping reported balances under 30% of your limits protects your credit score. A mid-cycle payment helps the most.',
      anchorDate,
      linkedRecordType: card ? 'debt' : 'money_records',
      linkedRecordId: card?.id || null,
      evidence: `Credit utilization ${pct}% — aim under 30%`,
      actionLabel: card ? 'Update debt' : 'Update balances',
      actionTarget: '/?sheet=debts',
      metadata: { rule: 'weekly.card_utilization', category: 'debt', utilization: pct },
    })
  }

  // 4. Savings — an underfunded emergency reserve with room in the budget.
  const efTargetMonths = number(snapshot?.efTargetMonths)
  const efMonths = number(snapshot?.efMonths)
  if (efTargetMonths > 0 && efMonths < efTargetMonths && number(snapshot?.expenses) > 0 && surplus > 0) {
    const targetAmount = Math.round(number(snapshot?.efTargetAmount))
    list.push({
      candidateKey: 'weekly.emergency_gap',
      category: 'savings',
      sourceFingerprint: candidateEvidence('weekly.emergency_gap', {
        target: efTargetMonths,
        covered: Math.round(efMonths * 10),
      }),
      cadence: 'weekly',
      title: 'Add to your emergency fund',
      detail: `A steady weekly transfer closes the gap without straining the budget — your surplus is about $${surplus.toLocaleString()}/mo.`,
      anchorDate,
      linkedRecordType: 'money_records',
      linkedRecordId: null,
      evidence: `${efMonths.toFixed(1)} of ${efTargetMonths} months saved${targetAmount ? ` ($${targetAmount.toLocaleString()} target)` : ''}`,
      actionLabel: 'Update balances',
      actionTarget: '/?sheet=balances',
      metadata: { rule: 'weekly.emergency_gap', category: 'savings' },
    })
  }

  // 5. Budgeting — a healthy surplus sitting idle once the reserve is funded and
  //    there is no active goal or expensive debt pulling on it.
  const activeGoals = (goals || []).filter(goalActive)
  const fundedReserve = efTargetMonths > 0 && efMonths >= efTargetMonths
  if (income > 0 && surplus >= 300 && fundedReserve && activeGoals.length === 0 && !debt) {
    list.push({
      candidateKey: 'weekly.idle_surplus',
      category: 'budget',
      sourceFingerprint: candidateEvidence('weekly.idle_surplus', { bucket: Math.round(surplus / 100) * 100 }),
      cadence: 'weekly',
      title: 'Put your surplus to work',
      detail: `About $${surplus.toLocaleString()}/mo is unassigned with your reserve already funded. Direct it toward investing or a goal before it drifts into spending.`,
      anchorDate,
      linkedRecordType: 'monthly_plan',
      linkedRecordId: null,
      evidence: `$${surplus.toLocaleString()}/mo unassigned surplus`,
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'weekly.idle_surplus', category: 'budget', amount: surplus },
    })
  }

  // 6. Goals — keep the nearest goal's projection honest.
  const goal = nearestGoal(goals)
  if (goal) {
    const progress = Math.min(100, Math.round(number(goal.current_amount) / number(goal.target_amount) * 100))
    list.push({
      candidateKey: `weekly.goal_progress.${goal.id}`,
      category: 'goals',
      sourceFingerprint: candidateEvidence('weekly.goal_progress', {
        goalId: goal.id,
        current: Math.round(number(goal.current_amount)),
        target: Math.round(number(goal.target_amount)),
        deadline: goal.deadline || null,
      }),
      cadence: 'weekly',
      title: `Update ${goal.name || 'your nearest goal'}`,
      detail: 'A quick weekly update keeps the projection useful without turning it into daily bookkeeping.',
      anchorDate,
      linkedRecordType: 'goal',
      linkedRecordId: goal.id || null,
      evidence: `${progress}% of the $${Math.round(number(goal.target_amount)).toLocaleString()} target`,
      actionLabel: 'Update goal',
      actionTarget: `/plan?goal=${encodeURIComponent(goal.id || '')}#goals`,
      metadata: { rule: 'weekly.goal_progress', category: 'goals', goalId: goal.id || null },
    })
  }

  return list
}

function quarterlyCandidates(context) {
  const { snapshot, profile, accounts, debts, goals, today } = context
  const anchorDate = firstDayOfNextQuarter(today)
  const list = []

  // 1. Taxes — self-employed users owe quarterly estimates; anchor to the next
  //    real IRS deadline (minus a lead week) so the first check-in is well-timed.
  if (['freelance', 'self_employed'].includes(profile?.employment_type)) {
    const deadline = nextTaxDeadline(today)
    const taxAnchor = deadline ? laterDateKey(today, addCalendarDays(deadline, -10)) : anchorDate
    list.push({
      candidateKey: 'quarterly.estimated_tax',
      category: 'taxes',
      sourceFingerprint: candidateEvidence('quarterly.estimated_tax', { employment: profile.employment_type, deadline }),
      cadence: 'quarterly',
      title: 'Prepare your estimated taxes',
      detail: `Review income and set aside your quarterly payment${deadline ? ` ahead of the ${taxDeadlineLabel(deadline)} deadline` : ''}. This is a check-in, not tax advice.`,
      anchorDate: taxAnchor,
      linkedRecordType: 'profile',
      linkedRecordId: null,
      evidence: deadline ? `Next IRS deadline: ${taxDeadlineLabel(deadline)}` : 'Self-employment income is on file',
      actionLabel: 'Open Monthly Plan',
      actionTarget: '/?sheet=plan',
      metadata: { rule: 'quarterly.estimated_tax', category: 'taxes', deadline: deadline || null },
    })
  }

  // 2. Accounts — stale balances undermine every downstream number.
  const stale = staleMoneyRecords(accounts, debts, today)
  if (stale.length) {
    const ids = stale.map(record => record.id).filter(Boolean).sort()
    const labels = stale.slice(0, 2).map(record => record.name || record.institution || 'financial record')
    list.push({
      candidateKey: 'quarterly.refresh_records',
      category: 'accounts',
      sourceFingerprint: candidateEvidence('quarterly.refresh_records', {
        records: stale.map(record => [record.id || record.name, record.last_verified_at || null]),
      }),
      cadence: 'quarterly',
      title: 'Refresh account and debt balances',
      detail: 'A quarterly refresh keeps net worth and every recommendation grounded in real balances.',
      anchorDate,
      linkedRecordType: 'money_records',
      linkedRecordId: null,
      evidence: `${stale.length} ${stale.length === 1 ? 'record needs' : 'records need'} verification${labels.length ? `: ${labels.join(', ')}` : ''}`,
      actionLabel: 'Update balances',
      actionTarget: '/?sheet=balances',
      metadata: { rule: 'quarterly.refresh_records', category: 'accounts', recordIds: ids },
    })
  }

  // 3. Retirement — matched workplace dollars are the highest-return money there
  //    is; confirm the contribution still captures the full match.
  const workplace = (accounts || []).find(isWorkplaceAccount)
  if (workplace) {
    const contribution = number(workplace.contribution_percent)
    const matchLimit = number(workplace.employer_match_limit_percent)
    const capturing = matchLimit > 0 && contribution >= matchLimit
    list.push({
      candidateKey: `quarterly.workplace_match.${workplace.id}`,
      category: 'retirement',
      sourceFingerprint: candidateEvidence('quarterly.workplace_match', {
        accountId: workplace.id,
        contribution: workplace.contribution_percent ?? null,
        match: workplace.employer_match_percent ?? null,
        matchLimit: workplace.employer_match_limit_percent ?? null,
      }),
      cadence: 'quarterly',
      title: capturing
        ? `Confirm ${workplace.name || 'your workplace plan'} still captures the match`
        : `Capture more of the ${workplace.name || 'workplace plan'} match`,
      detail: 'Check the contribution and employer-match details against a recent pay statement — matched dollars are an instant return.',
      anchorDate,
      linkedRecordType: 'account',
      linkedRecordId: workplace.id || null,
      evidence: matchLimit > 0
        ? `Contributing ${contribution}% toward a ${matchLimit}% matched limit`
        : 'A workplace retirement account is on file',
      actionLabel: 'Open account',
      actionTarget: '/?section=money&sheet=accounts',
      metadata: { rule: 'quarterly.workplace_match', category: 'retirement', accountId: workplace.id || null },
    })
  }

  // 4. Retirement — IRA/HSA room is use-it-or-lose-it; a quarterly nudge spreads
  //    contributions so the annual limit is reachable.
  const investmentAccounts = (accounts || []).filter(account => accountFamily(account) === 'investment')
  const retirementAccounts = investmentAccounts.filter(account => ['roth_ira', 'traditional_ira', 'sep_ira', 'hsa'].includes(subtypeOf(account)))
  if (retirementAccounts.length) {
    const hasRoth = retirementAccounts.some(account => subtypeOf(account) === 'roth_ira')
    list.push({
      candidateKey: 'quarterly.contribution_room',
      category: 'retirement',
      sourceFingerprint: candidateEvidence('quarterly.contribution_room', {
        accounts: retirementAccounts.map(account => account.id || subtypeOf(account)).sort(),
      }),
      cadence: 'quarterly',
      title: 'Check your IRA contribution pace',
      detail: `Spread contributions across the year so the annual limit is easy to hit${hasRoth ? ` — Roth IRA room is $${LIMITS.rothIra.toLocaleString()} in ${LIMITS.year}` : ''}.`,
      anchorDate,
      linkedRecordType: 'account',
      linkedRecordId: retirementAccounts[0].id || null,
      evidence: hasRoth
        ? `Roth IRA limit $${LIMITS.rothIra.toLocaleString()} · ${LIMITS.year}`
        : `${retirementAccounts.length} tax-advantaged account${retirementAccounts.length === 1 ? '' : 's'} on file`,
      actionLabel: 'Open account',
      actionTarget: '/?section=money&sheet=accounts',
      metadata: { rule: 'quarterly.contribution_room', category: 'retirement' },
    })
  }

  // 5. Accounts — cash rates move; low blended yield on real cash is worth a look.
  const liquid = number(snapshot?.liquid)
  const apy = number(snapshot?.weightedCashApy)
  if (liquid >= 1000 && apy < COMPETITIVE_APY) {
    list.push({
      candidateKey: 'quarterly.savings_rate',
      category: 'accounts',
      sourceFingerprint: candidateEvidence('quarterly.savings_rate', {
        bucket: Math.round(liquid / 500) * 500,
        apy: Math.round(apy * 10),
      }),
      cadence: 'quarterly',
      title: 'Check your savings interest rate',
      detail: 'Savings rates drift through the year. Confirm your cash still earns a competitive yield, or move it to one that does.',
      anchorDate,
      linkedRecordType: 'account',
      linkedRecordId: null,
      evidence: apy > 0
        ? `Cash earns about ${apy.toFixed(2)}% — strong HYSAs pay ~4%+`
        : `$${Math.round(liquid).toLocaleString()} in cash with no recorded yield`,
      actionLabel: 'Open account',
      actionTarget: '/?section=money&sheet=accounts',
      metadata: { rule: 'quarterly.savings_rate', category: 'accounts' },
    })
  }

  // 6. Investing — a user-managed portfolio benefits from a periodic rebalance.
  const taxableInvestments = investmentAccounts.filter(account => ['taxable_brokerage', 'crypto', 'other_investment'].includes(subtypeOf(account)))
  if (taxableInvestments.length > 0 || investmentAccounts.length >= 2) {
    const invested = Math.round(number(snapshot?.invested))
    list.push({
      candidateKey: 'quarterly.rebalance',
      category: 'investing',
      sourceFingerprint: candidateEvidence('quarterly.rebalance', {
        accounts: investmentAccounts.map(account => account.id || subtypeOf(account)).sort(),
        invested: Math.round(invested / 500) * 500,
      }),
      cadence: 'quarterly',
      title: 'Review your investment mix',
      detail: 'A quarterly look keeps your allocation on target and lets you rebalance or invest idle cash deliberately.',
      anchorDate,
      linkedRecordType: 'account',
      linkedRecordId: taxableInvestments[0]?.id || investmentAccounts[0]?.id || null,
      evidence: invested > 0
        ? `$${invested.toLocaleString()} across ${investmentAccounts.length} account${investmentAccounts.length === 1 ? '' : 's'}`
        : `${investmentAccounts.length} investment accounts on file`,
      actionLabel: 'Open account',
      actionTarget: '/?section=money&sheet=accounts',
      metadata: { rule: 'quarterly.rebalance', category: 'investing' },
    })
  }

  // 7. Goals — a slower cadence for reviewing the pace of the nearest goal.
  const goal = nearestGoal(goals)
  if (goal) {
    const progress = Math.min(100, Math.round(number(goal.current_amount) / number(goal.target_amount) * 100))
    list.push({
      candidateKey: `quarterly.goal_pace.${goal.id}`,
      category: 'goals',
      sourceFingerprint: candidateEvidence('quarterly.goal_pace', {
        goalId: goal.id,
        current: Math.round(number(goal.current_amount)),
        target: Math.round(number(goal.target_amount)),
        contribution: Math.round(number(goal.monthly_contribution)),
        deadline: goal.deadline || null,
      }),
      cadence: 'quarterly',
      title: `Review the pace of ${goal.name || 'your nearest goal'}`,
      detail: 'Compare progress and the current monthly contribution against the goal date.',
      anchorDate,
      linkedRecordType: 'goal',
      linkedRecordId: goal.id || null,
      evidence: `${progress}% complete${goal.deadline ? ` · target date ${goal.deadline}` : ''}`,
      actionLabel: 'Update goal',
      actionTarget: `/plan?goal=${encodeURIComponent(goal.id || '')}#goals`,
      metadata: { rule: 'quarterly.goal_pace', category: 'goals', goalId: goal.id || null },
    })
  }

  return list
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
  } else if (rule === 'weekly.card_utilization') {
    const util = number(context.snapshot?.cardUtilization)
    active = util > 0.3
    basis = { bucket: Math.min(100, Math.round((util * 100) / 5) * 5) }
  } else if (rule === 'weekly.emergency_gap') {
    const target = number(context.snapshot?.efTargetMonths)
    active = target > 0 && number(context.snapshot?.efMonths) < target
    basis = { target, covered: Math.round(number(context.snapshot?.efMonths) * 10) }
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
  // Rank every applicable candidate, then surface the most valuable one per
  // cadence that isn't already added or dismissed — so acting on one reveals the
  // next category instead of leaving the section empty.
  const suggestionPool = [...weeklyCandidates(context), ...quarterlyCandidates(context)]
  const topFor = cadence => suggestionPool.find(candidate => (
    candidate.cadence === cadence && !candidateSuppressed(candidate, reminders)
  )) || null
  const suggestions = [topFor('weekly'), topFor('quarterly')].filter(Boolean)

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
