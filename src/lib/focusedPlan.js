import { financialPriorities, THRESHOLDS } from './finance.js'
import { filterFreshPlanSteps, samePlanStep } from './planReplenishment.js'
import { isWorkplaceAccount } from './moneyModel.js'
import { doneWhenForStep } from './stepQuality.js'
import { buildInitialPlan, routeStepPool } from './moneyRoute.js'

export const FOCUS_SIZE = 3

const PRIORITY_RANK = {
  deficit: 0,
  overcommitted: 1,
  insurance: 2,
  starter_ef: 3,
  capture_match: 4,
  kill_debt: 5,
  build_ef: 6,
  goal: 7,
  roth: 7,
  invest: 7,
  assign_cash: 8,
  grow: 9,
}

const LEGACY_PRIORITY = [
  ['deficit', /deficit|overspend|spending more|cut spending|trim expenses/i],
  ['overcommitted', /allocation|overcommitted|assigned too much/i],
  ['insurance', /health insurance|uninsured|marketplace coverage/i],
  ['starter_ef', /starter emergency|\$1,?000 (reserve|emergency)/i],
  ['capture_match', /employer match|full match|401\s?\(?k\)? contribution/i],
  ['kill_debt', /credit card|high[- ]interest|\bapr\b|pay(ing)? (down|off)|debt/i],
  ['build_ef', /emergency fund|cash reserve|months of expenses|\bhysa\b/i],
  ['goal', /goal|down payment|save for/i],
  ['roth', /\broth\b|\bira\b|open.*invest/i],
  ['invest', /invest|brokerage|index fund/i],
  ['assign_cash', /unassigned|give.*cash.*job|automate.*transfer/i],
]

const num = value => Number(value) || 0
const roundMoney = value => Math.max(0, Math.round(num(value)))
const money = value => `$${roundMoney(value).toLocaleString()}`

function isoDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function addMonths(value, count) {
  const date = new Date(`${isoDay(value)}T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + count)
  return date.toISOString().slice(0, 10)
}

function addDays(value, count) {
  const date = new Date(`${isoDay(value)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

function stableRecords(records, project) {
  return (records || []).map(project).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function hashState(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function focusPlanFingerprint({ snapshot = {}, setupState, plan, activities = [], reminders = [], moneyRoute = null } = {}) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  const state = {
    setup: setupState?.next?.id || null,
    moneyRoute: moneyRoute?.fingerprint || null,
    profile: {
      income: num(snapshot.income),
      expenses: num(snapshot.expenses),
      allocations: num(snapshot.futureAllocations),
      insurance: snapshot.profile?.health_insurance || '',
      employer401k: snapshot.profile?.employer_401k || '',
      investmentTypes: [...(snapshot.profile?.investment_types || [])].sort(),
    },
    accounts: stableRecords(snapshot.accounts, account => ({
      id: account?.id || '', name: account?.name || '', type: account?.type || '', subtype: account?.subtype || '',
      balance: num(account?.balance), rate: num(account?.interest_rate), contribution: num(account?.monthly_contribution),
      contributionPercent: num(account?.contribution_percent), match: num(account?.employer_match_percent),
      matchLimit: num(account?.employer_match_limit_percent), verified: account?.last_verified_at || '',
    })),
    debts: stableRecords(snapshot.debts, debt => ({
      id: debt?.id || '', name: debt?.name || '', balance: num(debt?.balance), rate: num(debt?.interest_rate),
      minimum: num(debt?.minimum_payment), planned: num(debt?.planned_payment), due: debt?.due_day || null,
    })),
    goals: stableRecords(snapshot.goals, goal => ({
      id: goal?.id || '', name: goal?.name || '', target: num(goal?.target_amount), current: num(goal?.current_amount),
      monthly: num(goal?.monthly_contribution), deadline: goal?.deadline || '',
    })),
    cashFlow: stableRecords(snapshot.cashFlowItems, item => ({
      id: item?.id || '', kind: item?.kind || '', group: item?.group_key || '', category: item?.category_key || '',
      name: item?.name || '', monthly: num(item?.monthly_amount) || num(item?.amount),
    })),
    steps: stableRecords(steps, step => ({
      id: step?.id || '', text: step?.text || '', detail: step?.detail || '', doneWhen: step?.doneWhen || '',
      done: Boolean(step?.done), due: step?.due || '', completedAt: step?.completedAt || '', source: step?.source || '',
      intentKey: step?.intentKey || '', completionPolicy: step?.completionPolicy || '', outcome: step?.outcome || null,
      priorityKey: step?.priorityKey || '', basis: step?.basis || null, chapterId: step?.chapterId || '',
      chapterOrder: step?.chapterOrder ?? null, generatedForFingerprint: step?.generatedForFingerprint || '',
      supersededAt: step?.supersededAt || '',
    })),
    activities: stableRecords(activities, activity => ({
      id: activity?.id || '', source: activity?.source_key || '', intent: activity?.intent_key || '',
      status: activity?.status || '', amount: num(activity?.amount), recurrence: activity?.recurrence || '',
      sourceAccount: activity?.source_account_id || '', destinationAccount: activity?.destination_account_id || '',
      debt: activity?.debt_id || '', goal: activity?.goal_id || '', appliedAt: activity?.applied_at || '',
    })),
    // A reminder can suppress only a duplicate recurring-setup proposal. Its
    // title, due date, and check-in history never alter financial priorities.
    reminderSetups: stableRecords(
      reminders.filter(reminder => (
        ['active', 'paused'].includes(reminder?.status)
        && reminder?.metadata?.intent_key
      )),
      reminder => ({ intent: reminder.metadata.intent_key, status: reminder.status }),
    ),
  }
  return `focus-v1-${hashState(JSON.stringify(state))}`
}

function inferredPriority(step) {
  if (step?.priorityKey && PRIORITY_RANK[step.priorityKey] !== undefined) return step.priorityKey
  const text = `${step?.text || ''} ${step?.intentKey || ''}`
  return LEGACY_PRIORITY.find(([, pattern]) => pattern.test(text))?.[0] || 'grow'
}

function dueTime(step) {
  if (!step?.due) return Number.POSITIVE_INFINITY
  const value = new Date(`${step.due}T00:00:00`).getTime()
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

export function orderFocusSteps(steps = []) {
  return [...steps].sort((left, right) => {
    const leftPinned = left?.pinnedAt ? new Date(left.pinnedAt).getTime() || 1 : 0
    const rightPinned = right?.pinnedAt ? new Date(right.pinnedAt).getTime() || 1 : 0
    if (leftPinned || rightPinned) {
      if (!leftPinned) return 1
      if (!rightPinned) return -1
      if (leftPinned !== rightPinned) return rightPinned - leftPinned
    }
    const leftDeferred = left?.chapterId === 'manual.later'
    const rightDeferred = right?.chapterId === 'manual.later'
    if (leftDeferred !== rightDeferred) return leftDeferred ? 1 : -1
    const leftDue = dueTime(left)
    const rightDue = dueTime(right)
    if (leftDue !== rightDue) return leftDue - rightDue
    const rank = (PRIORITY_RANK[inferredPriority(left)] ?? 99) - (PRIORITY_RANK[inferredPriority(right)] ?? 99)
    if (rank) return rank
    const chapter = num(left?.chapterOrder) - num(right?.chapterOrder)
    if (chapter) return chapter
    return String(left?.addedAt || left?.id || '').localeCompare(String(right?.addedAt || right?.id || ''))
  })
}

function candidateBase(priority, index, values) {
  const basis = {
    priorityKey: priority.key,
    recordType: values.recordType || null,
    recordId: values.recordId || null,
    recordName: values.recordName || null,
    balance: values.balance ?? null,
    rate: values.rate ?? null,
    target: values.target ?? null,
    current: values.current ?? null,
    contributionPercent: values.contributionPercent ?? null,
    matchLimitPercent: values.matchLimitPercent ?? null,
    monthlyCapacity: values.monthlyCapacity ?? null,
  }
  return {
    candidateKey: `${priority.key}.${values.key || index + 1}`,
    priorityKey: priority.key,
    text: values.text,
    detail: values.detail || priority.why,
    doneWhen: values.doneWhen,
    impact: values.impact || null,
    due: values.due || null,
    intentKey: values.intentKey || `${priority.key}.${values.key || index + 1}`,
    completionPolicy: values.completionPolicy === 'repeatable' ? 'repeatable' : 'once',
    outcome: values.outcome || null,
    basis,
    chapterId: `focus.${priority.key}`,
    chapterOrder: index + 1,
    source: 'focus',
    proposed: true,
  }
}

function monthlyCapacity(snapshot) {
  const available = snapshot.cashFlowItems?.length
    ? num(snapshot.unallocated)
    : num(snapshot.cashFlowMargin)
  return Math.max(0, Math.floor(available / 25) * 25)
}

function cashNames(snapshot) {
  const cash = snapshot.cashAccounts || []
  const source = cash.find(account => String(account.subtype || account.type).toLowerCase() === 'checking') || cash[0] || null
  const destination = cash.find(account => {
    const type = String(account.subtype || account.type).toLowerCase()
    return type.includes('saving') || type === 'hysa' || type === 'money_market'
  }) || null
  return { source, destination }
}

function contributionSequence(priority, snapshot, now, {
  recordType,
  record,
  amount,
  intentKey,
  outcomeKind = 'contribution',
  destinationHint,
  goalHint,
} = {}) {
  const capacity = monthlyCapacity(snapshot)
  const requested = roundMoney(amount || capacity)
  if (requested <= 0) return []
  const payment = Math.min(requested, 1000)
  const name = record?.name || priority.title.replace(/^Move |^Grow /, '')
  return [1, 2, 3].map((month, index) => {
    const due = addMonths(now, month)
    const outcome = {
      kind: outcomeKind,
      amount: payment,
      recurrence: 'monthly',
      stateFingerprint: `${priority.key}:${record?.id || name}:${due}`,
    }
    if (recordType === 'debt') {
      outcome.debtId = record?.id || null
      outcome.debtHint = record?.name || null
    }
    if (recordType === 'goal') {
      outcome.goalId = record?.id || null
      outcome.goalHint = record?.name || null
    }
    if (destinationHint) outcome.destinationAccountHint = destinationHint
    if (goalHint) outcome.goalHint = goalHint
    return candidateBase(priority, index, {
      key: `${record?.id || 'primary'}.${due}`,
      text: `${outcomeKind === 'debt_payment' ? 'Pay' : 'Move'} ${money(payment)} ${outcomeKind === 'debt_payment' ? `to ${name}` : `toward ${name}`} by ${due}`,
      detail: priority.why,
      doneWhen: `${money(payment)} is ${outcomeKind === 'debt_payment' ? 'paid and the confirmation is saved' : 'transferred and the destination balance reflects it'}.`,
      impact: outcomeKind === 'debt_payment' && record?.interest_rate
        ? `Reduces debt charging ${num(record.interest_rate)}% APR`
        : `Moves ${money(payment)} closer to the target`,
      due,
      intentKey,
      completionPolicy: 'repeatable',
      outcome,
      recordType,
      recordId: record?.id,
      recordName: name,
      balance: recordType === 'debt' ? num(record?.balance) : undefined,
      rate: recordType === 'debt' ? num(record?.interest_rate) : undefined,
      target: recordType === 'goal' ? num(record?.target_amount) : undefined,
      current: recordType === 'goal' ? num(record?.current_amount) : undefined,
      monthlyCapacity: capacity,
    })
  })
}

function candidatesForPriority(priority, snapshot, now) {
  const capacity = monthlyCapacity(snapshot)
  const { source, destination } = cashNames(snapshot)
  const dueSoon = addDays(now, 7)

  if (priority.key === 'deficit') {
    const gap = roundMoney(Math.abs(snapshot.cashFlowMargin))
    const wants = [...(snapshot.cashFlowItems || [])]
      .filter(item => item.kind === 'expense' && item.group_key === 'wants')
      .sort((left, right) => num(right.monthly_amount || right.amount) - num(left.monthly_amount || left.amount))[0]
    const current = num(wants?.monthly_amount || wants?.amount)
    const target = Math.max(0, roundMoney(current - gap))
    return [candidateBase(priority, 0, {
      key: wants?.id || 'monthly-plan',
      text: wants ? `Lower ${wants.name} to ${money(target)} per month` : `Reduce typical monthly spending by ${money(gap)}`,
      detail: priority.why,
      doneWhen: wants
        ? `The Monthly Plan shows ${wants.name} at ${money(target)} per month.`
        : `Typical monthly expenses are no more than ${money(snapshot.income)}.`,
      impact: `Closes a ${money(gap)}/mo gap`,
      intentKey: `budget.close_deficit.${wants?.id || 'total'}`,
      recordType: wants ? 'cash_flow_item' : 'monthly_plan',
      recordId: wants?.id,
      recordName: wants?.name,
      monthlyCapacity: capacity,
    })]
  }

  if (priority.key === 'overcommitted') {
    const gap = roundMoney(Math.abs(snapshot.unallocated))
    const allocation = [...(snapshot.cashFlowItems || [])]
      .filter(item => item.kind === 'allocation')
      .sort((left, right) => num(right.monthly_amount || right.amount) - num(left.monthly_amount || left.amount))[0]
    const target = Math.max(0, roundMoney(num(allocation?.monthly_amount || allocation?.amount) - gap))
    return [candidateBase(priority, 0, {
      key: allocation?.id || 'monthly-plan',
      text: allocation ? `Lower ${allocation.name} to ${money(target)} per month` : `Reduce future allocations by ${money(gap)} per month`,
      detail: priority.why,
      doneWhen: `Money left to assign is ${money(0)} or more in the Monthly Plan.`,
      impact: `Removes ${money(gap)}/mo of overcommitment`,
      intentKey: `budget.fix_allocations.${allocation?.id || 'total'}`,
      recordType: allocation ? 'cash_flow_item' : 'monthly_plan',
      recordId: allocation?.id,
      recordName: allocation?.name,
      monthlyCapacity: capacity,
    })]
  }

  if (priority.key === 'insurance') {
    return [
      candidateBase(priority, 0, {
        key: 'choose',
        text: `Choose a health plan by ${dueSoon}`,
        detail: 'Choose one plan with a premium and deductible that fit your monthly budget.',
        doneWhen: 'A specific plan, monthly premium, and coverage start date are selected.',
        due: dueSoon,
        intentKey: 'choose.health_insurance',
        recordType: 'profile',
      }),
      candidateBase(priority, 1, {
        key: 'enroll',
        text: 'Enroll in the selected health plan',
        detail: priority.why,
        doneWhen: 'Enrollment is confirmed and health coverage is recorded as active.',
        intentKey: 'enroll.health_insurance',
        outcome: { kind: 'information_only' },
        recordType: 'profile',
      }),
    ]
  }

  if (priority.key === 'starter_ef' || priority.key === 'build_ef') {
    const target = priority.key === 'starter_ef' ? THRESHOLDS.starterEmergency : snapshot.efTargetAmount
    const remaining = Math.max(0, roundMoney(target - snapshot.liquid))
    const proposed = []
    if (!destination) {
      proposed.push(candidateBase(priority, 0, {
        key: 'open-savings',
        text: 'Open a high-yield emergency savings account',
        detail: 'A separate liquid account makes the reserve easier to protect and track.',
        doneWhen: 'The savings account appears in Money with its current balance and APY.',
        intentKey: 'open.emergency_savings',
        outcome: { kind: 'account_opening', accountSubtypeHint: 'hysa' },
        recordType: 'account',
        target,
        current: snapshot.liquid,
        monthlyCapacity: capacity,
      }))
    }
    const availableNow = Math.max(0, num(source?.balance) - Math.min(500, num(source?.balance)))
    const amount = Math.min(remaining, Math.max(capacity, availableNow), 1000)
    const sequence = contributionSequence(priority, snapshot, now, {
      recordType: 'cash_reserve',
      record: { id: destination?.id || 'emergency', name: destination?.name || 'your emergency reserve' },
      amount,
      intentKey: 'fund.emergency_reserve',
      outcomeKind: 'transfer',
      destinationHint: destination?.name || 'Emergency savings',
    }).map(step => ({
      ...step,
      outcome: {
        ...step.outcome,
        sourceAccountId: source?.id || null,
        destinationAccountId: destination?.id || null,
        sourceAccountHint: source?.name || 'Checking',
        destinationAccountHint: destination?.name || 'Emergency savings',
        accountSubtypeHint: destination?.subtype || 'hysa',
      },
      basis: { ...step.basis, target, current: snapshot.liquid },
    }))
    return [...proposed, ...sequence].slice(0, 3)
  }

  if (priority.key === 'capture_match') {
    const account = priority.account
    const target = num(account?.employer_match_limit_percent)
    return [
      candidateBase(priority, 0, {
        key: account?.id || 'workplace',
        text: `Raise ${account?.name || 'your workplace plan'} contributions to ${target}%`,
        detail: priority.why,
        doneWhen: `The account contribution setting shows ${target}%.`,
        impact: 'Captures the full recorded employer match',
        intentKey: `capture.employer_match.${account?.id || 'workplace'}`,
        outcome: {
          kind: 'recurring_setup', destinationAccountId: account?.id || null,
          destinationAccountHint: account?.name || 'Workplace retirement plan',
          accountSubtypeHint: account?.subtype || '401k', contributionPercent: target,
        },
        recordType: 'account', recordId: account?.id, recordName: account?.name,
        contributionPercent: num(account?.contribution_percent), matchLimitPercent: target,
        monthlyCapacity: capacity,
      }),
      candidateBase(priority, 1, {
        key: `${account?.id || 'workplace'}.verify`,
        text: 'Confirm the new contribution on your next paystub',
        detail: 'The payroll deduction verifies that the change actually took effect.',
        doneWhen: `The next paystub shows a ${target}% workplace-plan contribution.`,
        intentKey: `verify.employer_match.${account?.id || 'workplace'}`,
        recordType: 'account', recordId: account?.id, recordName: account?.name,
        contributionPercent: num(account?.contribution_percent), matchLimitPercent: target,
      }),
    ]
  }

  if (priority.key === 'kill_debt') {
    const debt = priority.debt || snapshot.debts?.find(item => item.id === priority.recordId)
    const scheduled = Math.max(num(debt?.planned_payment), num(debt?.minimum_payment))
    const amount = Math.min(num(debt?.balance), capacity || scheduled, 1000)
    return contributionSequence(priority, snapshot, now, {
      recordType: 'debt', record: debt, amount,
      intentKey: `pay.debt.${debt?.id || 'highest_apr'}`,
      outcomeKind: 'debt_payment',
    })
  }

  if (priority.key === 'goal') {
    const goal = priority.goal
    const remaining = Math.max(0, num(goal?.target_amount) - num(goal?.current_amount))
    const recorded = num(goal?.monthly_contribution)
    const supportedRecorded = recorded > 0 && (recorded <= capacity || recorded <= num(snapshot.futureAllocations)) ? recorded : 0
    const amount = Math.min(remaining, supportedRecorded || capacity, 1000)
    if (amount <= 0) {
      return [candidateBase(priority, 0, {
        key: `${goal?.id || 'primary'}.deadline`,
        text: `Set a 90-day checkpoint for ${goal?.name || 'your goal'}`,
        detail: 'Cash is fully assigned, so define the next measurable checkpoint before adding a new contribution.',
        doneWhen: 'The goal has a saved checkpoint date and target amount in Plan.',
        due: addDays(now, 7), intentKey: `set.goal_checkpoint.${goal?.id || 'primary'}`,
        recordType: 'goal', recordId: goal?.id, recordName: goal?.name,
        target: num(goal?.target_amount), current: num(goal?.current_amount), monthlyCapacity: capacity,
      })]
    }
    return contributionSequence(priority, snapshot, now, {
      recordType: 'goal', record: goal, amount,
      intentKey: `fund.goal.${goal?.id || 'primary'}`,
      destinationHint: goal?.name,
      goalHint: goal?.name,
    })
  }

  if (priority.key === 'roth') {
    const deposit = Math.min(capacity, 500)
    const steps = [
      candidateBase(priority, 0, {
        key: 'open', text: 'Open a Roth IRA', detail: priority.why,
        doneWhen: 'The Roth IRA appears in Money with its institution and current balance.',
        intentKey: 'open.roth_ira', outcome: { kind: 'account_opening', accountSubtypeHint: 'roth_ira' },
        recordType: 'account', monthlyCapacity: capacity,
      }),
    ]
    if (deposit > 0) steps.push(candidateBase(priority, 1, {
        key: 'fund', text: `Contribute ${money(deposit)} to the new Roth IRA`,
        detail: `The contribution fits within the currently recorded ${money(capacity || deposit)}/mo capacity.`,
        doneWhen: `${money(deposit)} is deposited and the Roth IRA balance reflects it.`,
        impact: `Starts tax-advantaged investing with ${money(deposit)}`,
        intentKey: 'fund.roth_ira', completionPolicy: 'repeatable',
        outcome: { kind: 'contribution', amount: deposit, recurrence: 'monthly', destinationAccountHint: 'Roth IRA', stateFingerprint: `roth:${isoDay(now)}` },
        recordType: 'account', monthlyCapacity: capacity,
      }), candidateBase(priority, 2, {
        key: 'invest', text: `Invest the ${money(deposit)} Roth IRA contribution`,
        detail: 'A contribution left in settlement cash is not yet invested.',
        doneWhen: 'The full contribution shows as invested rather than uninvested cash.',
        intentKey: 'invest.roth_ira_contribution', recordType: 'account', monthlyCapacity: capacity,
      }))
    return steps
  }

  if (priority.key === 'invest') {
    const account = priority.account
    const recorded = num(account?.monthly_contribution)
    const supportedRecorded = recorded > 0 && (recorded <= capacity || recorded <= num(snapshot.futureAllocations)) ? recorded : 0
    const amount = Math.min(supportedRecorded || capacity, 1000)
    return contributionSequence(priority, snapshot, now, {
      recordType: 'account', record: account, amount,
      intentKey: `fund.investment.${account?.id || 'primary'}`,
      destinationHint: account?.name,
    })
  }

  if (priority.key === 'assign_cash') {
    const destinationAccount = snapshot.investmentAccounts?.[0] || destination
    const amount = Math.max(25, Math.min(roundMoney(snapshot.unallocated), 1000))
    return contributionSequence(priority, snapshot, now, {
      recordType: 'account', record: destinationAccount || { id: 'assigned', name: 'your highest-priority account' }, amount,
      intentKey: `assign.unallocated.${destinationAccount?.id || 'primary'}`,
      destinationHint: destinationAccount?.name,
    })
  }

  const recordsNeedRefresh = [...(snapshot.accounts || []), ...(snapshot.debts || [])]
  const refreshDue = addDays(now, 30)
  const result = [candidateBase(priority, 0, {
    key: 'goal', text: 'Add one specific 90-day money goal',
    detail: 'A named target gives the next plan chapter a measurable direction.',
    doneWhen: 'Plan contains a goal with a target amount and deadline.',
    due: addDays(now, 7), intentKey: 'set.goal.90_day', recordType: 'goal',
  })]
  if (recordsNeedRefresh.length) {
    result.push(candidateBase(priority, 1, {
      key: 'refresh', text: `Refresh every account and debt balance by ${refreshDue}`,
      detail: 'Current balances keep future recommendations tied to reality.',
      doneWhen: 'Every account and debt has a current balance and verification date.',
      due: refreshDue, intentKey: `verify.money_records.${refreshDue}`, completionPolicy: 'repeatable', recordType: 'money_records',
    }))
  }
  if ((snapshot.debts || []).length) {
    result.push(candidateBase(priority, 2, {
      key: 'debt-details', text: 'Confirm every debt APR and minimum payment',
      detail: 'Complete rate and payment data makes payoff guidance honest.',
      doneWhen: 'Every active debt shows an APR and minimum payment in Money.',
      intentKey: 'verify.debt_terms', recordType: 'debt',
    }))
  } else if ((snapshot.accounts || []).length) {
    result.push(candidateBase(priority, 2, {
      key: 'rates', text: 'Confirm the APY or contribution for each account',
      detail: 'Accurate rates and contributions improve the next recommendation.',
      doneWhen: 'Every relevant account shows its current APY or monthly contribution.',
      intentKey: 'verify.account_terms', recordType: 'account',
    }))
  }
  if (result.length < 3) {
    result.push(candidateBase(priority, result.length, {
      key: 'goal-contribution', text: 'Set a monthly contribution for the 90-day goal',
      detail: 'A saved contribution turns the target into a repeatable action.',
      doneWhen: 'The goal shows a positive monthly contribution in Plan.',
      intentKey: 'set.goal.90_day_contribution', recordType: 'goal', monthlyCapacity: capacity,
    }))
  }
  if (result.length < 3) {
    result.push(candidateBase(priority, result.length, {
      key: 'first-contribution', text: `Schedule the first goal contribution for ${addMonths(now, 1)}`,
      detail: 'A dated first contribution starts the 90-day plan without relying on memory.',
      doneWhen: 'The first contribution is scheduled and its date is confirmed.',
      due: addMonths(now, 1), intentKey: 'setup.goal.first_contribution',
      outcome: { kind: 'recurring_setup', recurrence: 'monthly' }, recordType: 'goal', monthlyCapacity: capacity,
    }))
  }
  return result
}

export function buildFocusCandidates({ snapshot = {}, plan, activities = [], reminders = [], now = new Date(), fingerprint } = {}) {
  const priorities = financialPriorities(snapshot)
  const pool = priorities.flatMap(priority => candidatesForPriority(priority, snapshot, now))
  if (!priorities.some(priority => priority.key === 'grow')) {
    pool.push(...candidatesForPriority({
      key: 'grow', urgent: false, title: 'Set a measurable next chapter',
      why: 'Your current numbers have no urgent gap, so the next useful move should be tied to a clear target.',
    }, snapshot, now))
  }
  const existing = Array.isArray(plan?.steps) ? [...plan.steps] : []
  const accepted = []
  for (const candidate of pool) {
    const reminderDuplicate = candidate?.outcome?.kind === 'recurring_setup'
      && reminders.some(reminder => (
        ['active', 'paused'].includes(reminder?.status)
        && reminder?.metadata?.intent_key === candidate.intentKey
      ))
    if (reminderDuplicate) continue
    const legacyPriorityDuplicate = candidate.priorityKey !== 'grow' && existing.some(step => (
      !step?.done
      && !step?.supersededAt
      && !(step?.intentKey || step?.intent_key)
      && inferredPriority(step) === candidate.priorityKey
    ))
    if (legacyPriorityDuplicate) continue
    const activityDuplicate = activities.some(activity => {
      if (!activity?.intent_key || activity.intent_key !== candidate.intentKey) return false
      if (candidate.completionPolicy !== 'repeatable') return true
      const previousState = activity?.metadata?.state_fingerprint || activity?.state_fingerprint
      const nextState = candidate.outcome?.stateFingerprint
      return !previousState || !nextState || previousState === nextState
    })
    if (activityDuplicate) continue
    const { fresh } = filterFreshPlanSteps(existing, [candidate], { dedupeCompleted: true })
    if (!fresh.length) continue
    const duplicateAccepted = accepted.some(step => {
      if (step.candidateKey === candidate.candidateKey) return true
      if (!samePlanStep(step.text, candidate.text)) return false
      const previousState = step.outcome?.stateFingerprint
      const nextState = candidate.outcome?.stateFingerprint
      return step.completionPolicy !== 'repeatable' || candidate.completionPolicy !== 'repeatable'
        || !previousState || !nextState || previousState === nextState
    })
    if (duplicateAccepted) continue
    accepted.push({
      ...candidate,
      id: `proposal:${candidate.candidateKey}`,
      generatedForFingerprint: fingerprint || null,
      guideFingerprint: fingerprint || null,
    })
    if (accepted.length >= 9) break
  }
  return accepted
}

function findRecord(records, basis) {
  if (!basis) return null
  return (records || []).find(record => record.id === basis.recordId)
    || (records || []).find(record => basis.recordName && record.name === basis.recordName)
    || null
}

export function staleStepReason(step, snapshot, activities, fingerprint) {
  if (!step || step.done || step.source === 'user' || step.supersededAt) return null
  // "Stop the scheduled payment" exists BECAUSE the debt is paid off; judging
  // it by the same record would flag it the moment it was created.
  if (String(step.intentKey || '').startsWith('stop.')) return null
  if (!step.priorityKey && !step.generatedForFingerprint && !step.basis) return null
  if (step.reviewOverrideFingerprint === fingerprint) return null

  const key = step.priorityKey || inferredPriority(step)
  const intent = step.intentKey || ''
  const basis = step.basis || {}

  if ((key === 'insurance' || /health_insurance/.test(intent)) && snapshot.profile?.health_insurance && snapshot.profile.health_insurance !== 'none') {
    return 'Health coverage is now recorded, so this step no longer matches your current situation.'
  }

  if (intent.startsWith('open.')) {
    const subtype = intent.replace(/^open\./, '').replace('emergency_savings', 'hysa')
    const exists = (snapshot.accounts || []).some(account => {
      const accountType = String(account.subtype || account.type || '').toLowerCase()
      if (subtype === 'roth_ira') return accountType === 'roth_ira'
      if (subtype === 'hysa') return ['hysa', 'savings', 'money_market'].includes(accountType)
      return accountType === subtype
    })
    if (exists) return 'That account now exists, so opening another one would repeat completed work.'
  }

  if (!intent.startsWith('open.') && basis.recordType === 'account' && basis.recordId
    && !(snapshot.accounts || []).some(account => account.id === basis.recordId)) {
    return `${basis.recordName || 'The linked account'} is no longer in Money.`
  }

  const matchingActivity = (activities || []).find(activity => activity.intent_key === intent && activity.status === 'applied')
  if (matchingActivity && step.completionPolicy !== 'repeatable') {
    return 'Recent Progress confirms this setup was already completed.'
  }

  // A step about every debt (autopay the minimums) names none of them, and
  // "no matching debt found" read as "paid off" — so it was flagged the moment
  // it reached the plan. It is only finished when every debt it covers is.
  const namesADebt = Boolean(basis.recordId || basis.recordName)
  if ((key === 'kill_debt' || basis.recordType === 'debt') && !namesADebt) {
    const ids = Array.isArray(step.outcome?.debtIds) ? step.outcome.debtIds : []
    const covered = ids.length
      ? (snapshot.debts || []).filter(debt => ids.includes(debt.id))
      : (snapshot.debts || [])
    if (!covered.some(debt => num(debt.balance) > 0)) {
      return ids.length === 1 && covered[0]?.name
        ? `${covered[0].name} is now paid off.`
        : 'Every debt is paid off, so there are no minimums left to automate.'
    }
  } else if (key === 'kill_debt' || basis.recordType === 'debt') {
    const debt = findRecord(snapshot.debts, basis)
    if (!debt || num(debt.balance) <= 0) return `${basis.recordName || 'This debt'} is now paid off.`
    // Only a balance that GREW is news. One falling is the plan working, and
    // flagging it would nag everyone who is paying their debt down.
    if (basis.balance !== null && basis.balance !== undefined) {
      const original = Math.max(1, num(basis.balance))
      if ((num(debt.balance) - original) / original >= 0.25) return `${debt.name || 'This debt'} grew since this step was set, so the amount and order need a fresh look.`
    }
    if (basis.rate !== null && basis.rate !== undefined && Math.abs(num(debt.interest_rate) - num(basis.rate)) >= 1) {
      return 'The debt APR changed, so its priority and payoff impact need review.'
    }
  }

  if (key === 'capture_match') {
    const account = findRecord(snapshot.accounts, basis) || (snapshot.accounts || []).find(isWorkplaceAccount)
    if (account && num(account.employer_match_limit_percent) > 0
      && num(account.contribution_percent) >= num(account.employer_match_limit_percent)) {
      return 'Your recorded contribution now captures the full employer match.'
    }
  }

  if (key === 'starter_ef' && num(snapshot.liquid) >= THRESHOLDS.starterEmergency) {
    return `Your liquid reserve has reached the ${money(THRESHOLDS.starterEmergency)} starter target.`
  }
  if (key === 'build_ef' && snapshot.expenses > 0 && snapshot.efMonths >= snapshot.efTargetMonths) {
    return `Your liquid reserve now covers ${snapshot.efTargetMonths} months of typical expenses.`
  }

  if (intent === 'set.goal.90_day' && (snapshot.goals || []).some(goal => num(goal.current_amount) < num(goal.target_amount))) {
    return 'A measurable active goal now exists, so this setup step is no longer needed.'
  }

  if (key === 'goal' || (basis.recordType === 'goal' && (basis.recordId || basis.recordName))) {
    const goal = findRecord(snapshot.goals, basis)
    if (!goal) return `${basis.recordName || 'The linked goal'} is no longer active.`
    if (num(goal.target_amount) > 0 && num(goal.current_amount) >= num(goal.target_amount)) return `${goal.name} has reached its target.`
    if (basis.target !== null && basis.target !== undefined && num(goal.target_amount) !== num(basis.target)) {
      return `${goal.name}'s target changed, so its contribution sequence needs review.`
    }
  }

  const recurringAmount = step.outcome?.recurrence ? num(step.outcome?.amount) : 0
  const capacity = monthlyCapacity(snapshot)
  if (recurringAmount > 0 && basis.monthlyCapacity !== null && basis.monthlyCapacity !== undefined
    && capacity < num(basis.monthlyCapacity) && recurringAmount > capacity) {
    return `Current cash flow no longer supports the suggested ${money(recurringAmount)}/mo commitment.`
  }

  // A recurring/monthly step (recurringAmount above) represents an ongoing
  // flow paid from future income, not a lump sum that must already be sitting
  // in the source account today — it was already checked against cash-flow
  // capacity, not a balance. Money Route's amounts are sized off the monthly
  // surplus, not any single account's balance, so applying this lump-sum
  // check to those steps flagged nearly every real plan as stale on day one
  // (e.g. "$1,240/mo toward a debt" against a $600 checking balance).
  const sourceId = step.outcome?.sourceAccountId
  if (sourceId && num(step.outcome?.amount) > 0 && !recurringAmount) {
    const source = (snapshot.accounts || []).find(account => account.id === sourceId)
    if (!source || num(source.balance) < num(step.outcome.amount)) return 'The source balance no longer supports this transfer amount.'
  }
  return null
}

function prerequisiteFromSetup(setupState) {
  if (!setupState?.next) return null
  return {
    kind: 'setup',
    id: setupState.next.id,
    title: setupState.next.label,
    detail: 'Add this missing detail so the next recommendation is based on complete numbers.',
    cta: setupState.next.cta || 'Add details',
    sheet: setupState.next.sheet,
  }
}

function candidatesFromMoneyRoute(moneyRoute, plan, activities) {
  const existing = Array.isArray(plan?.steps) ? plan.steps : []
  const activeIntents = new Set(existing
    .filter(step => !step?.done && !step?.supersededAt)
    .map(step => step?.intentKey || step?.intent_key)
    .filter(Boolean))
  // A move the plan already holds is one standing instruction. When its
  // amount changes, the plan offers to update that step (amountUpdateReview)
  // rather than proposing a second copy with a different number.
  const routeSteps = buildInitialPlan(moneyRoute).filter(candidate => !activeIntents.has(candidate.intentKey)
    && !existing.some(step => (
      !step?.done
      && !step?.supersededAt
      && !(step?.intentKey || step?.intent_key)
      && inferredPriority(step) === candidate.priorityKey
    )))
  const { fresh } = filterFreshPlanSteps(existing, routeSteps, { dedupeCompleted: true })
  return fresh.filter(candidate => !activities.some(activity => {
    if (activity?.intent_key !== candidate.intentKey || activity?.status !== 'applied') return false
    if (candidate.completionPolicy !== 'repeatable') return true
    const previousState = activity?.metadata?.state_fingerprint || activity?.state_fingerprint
    const nextState = candidate.outcome?.stateFingerprint
    return !previousState || !nextState || previousState === nextState
  })).map(candidate => ({
    ...candidate,
    id: `proposal:${candidate.candidateKey}`,
    proposed: true,
  }))
}

// Worth a trip to the bank's transfer screen. Below this, a changed number is
// the arithmetic breathing — the same threshold the route uses before it
// re-proposes a standing order.
const AMOUNT_UPDATE_SHARE = 0.15
const AMOUNT_UPDATE_MIN = 25

// Fields that describe the move. Everything else on a saved step — its id,
// due date, pin, when it was added — belongs to the user and survives.
function rewrittenMove(next, fingerprint) {
  return {
    text: next.text,
    detail: next.detail ?? null,
    impact: next.impact ?? null,
    doneWhen: next.doneWhen ?? null,
    outcome: next.outcome ? { ...next.outcome } : null,
    basis: next.basis ? { ...next.basis } : null,
    priorityKey: next.priorityKey ?? null,
    generatedForFingerprint: fingerprint || next.generatedForFingerprint || null,
    // The cached how-to quotes the old amount.
    guide: null,
    guideFingerprint: null,
    reviewOverrideFingerprint: null,
  }
}

function movedEnough(before, after) {
  return Math.abs(after - before) >= Math.max(AMOUNT_UPDATE_MIN, before * AMOUNT_UPDATE_SHARE)
}

// Why the number moved, in the order a person would look for it. Pinning a
// shrinking payment on "you have more money now" read as nonsense the one
// time the two moved in opposite directions — so the capacity explanation is
// only used when it actually points the same way as the change.
function amountUpdateReason({ step, before, after, beforeTarget, afterTarget, route, finishing, name }) {
  const up = after > before
  const amountMoved = movedEnough(before, after)
  if (finishing) {
    return step.outcome?.kind === 'debt_payment'
      ? `Only about ${money(after)} is left, so you can clear ${name || 'this'} this month.`
      : `Only ${money(after)} is left to reach ${money(afterTarget || beforeTarget)}, so this can be the last transfer.`
  }
  if (beforeTarget > 0 && afterTarget > 0 && afterTarget !== beforeTarget) {
    const reached = num(route?.planContext?.liquid) >= beforeTarget
    if (reached) return `You reached ${money(beforeTarget)}. Next stop: ${money(afterTarget)}${amountMoved ? `, at ${money(after)}/mo` : ''}.`
    const moved = amountMoved ? ` and this move ${up ? 'rises' : 'drops'} to ${money(after)}/mo from ${money(before)}` : ''
    return `Your spending ${afterTarget > beforeTarget ? 'went up' : 'went down'}, so your target is now ${money(afterTarget)} (was ${money(beforeTarget)})${moved}.`
  }
  const was = num(step.basis?.monthlyCapacity)
  const now = num(route?.availableMonthlyAmount)
  const change = `${up ? 'can rise' : 'should drop'} to ${money(after)}/mo from ${money(before)}`
  if (was > 0 && now > 0 && was !== now && (now > was) === up) {
    return `You now have ${money(now)} a month to direct, ${up ? 'up' : 'down'} from ${money(was)}, so this move ${change}.`
  }
  return up
    ? `Money another part of your plan was using is free now, so this move ${change}.`
    : `An earlier priority in your plan now needs part of this, so this move ${change}.`
}

/**
 * The plan already holds this move; only its size or finish line changed. A
 * raise, a paid-off card freeing money, a cushion reaching its first $1,000 —
 * the route resizes the same rung, and the saved step should follow rather
 * than keep quoting the day it was approved.
 *
 * Nothing changes without a tap: this returns a review the Plan offers, in the
 * same place as every other "your records changed" check. Approving it
 * rewrites the step in place, and the standing order that automates it with
 * it — a transfer instruction and a schedule quoting different amounts is
 * exactly the confusion the automation step exists to prevent. If that
 * standing order was already set up, it comes back as one errand: change it.
 */
export function amountUpdateReview({ steps = [], pool = [], route = null, fingerprint = null, now = null } = {}) {
  const live = steps.filter(step => !step?.supersededAt)
  for (const step of live) {
    if (step.done || step.source === 'user' || step.reviewOverrideFingerprint === fingerprint) continue
    if (step.outcome?.final) continue
    const intent = step.intentKey || ''
    if (!intent || intent.startsWith('setup.') || !step.outcome?.recurrence) continue
    const before = num(step.outcome?.amount)
    const next = pool.find(candidate => candidate.intentKey === intent)
    const after = num(next?.outcome?.amount)
    if (!(before > 0) || !(after > 0)) continue
    const beforeTarget = num(step.outcome?.targetAmount)
    const afterTarget = num(next.outcome?.targetAmount)
    const targetMoved = beforeTarget > 0 && afterTarget > 0 && afterTarget !== beforeTarget
    const lastMonth = num(next.outcome?.etaMonths) > 0 && num(next.outcome?.etaMonths) <= 1
    // A rung's final month is a one-time finish, not a new monthly amount.
    // When it shrinks, the difference is already being handed to the next
    // rung — leaving this step at its old size would direct the same dollars
    // twice, so any shrink counts. A rise only matters when it is material.
    const finishing = !targetMoved && lastMonth && (after < before || movedEnough(before, after))
    if (!finishing && !targetMoved && !movedEnough(before, after)) continue

    const payment = step.outcome?.kind === 'debt_payment' ? 'payment' : 'transfer'
    const name = next.basis?.recordName || step.basis?.recordName || null
    const twin = live.find(item => item.intentKey === `setup.${intent}`)
    const scheduled = num(twin?.outcome?.amount) || before
    const mainPatch = rewrittenMove(next, fingerprint)
    const updates = [{ id: step.id, patch: mainPatch }]

    if (finishing) {
      // Its last month. Resetting a standing order that ends next month is
      // two trips to the bank for one change — so the move becomes the
      // one-time finish, and it ends the standing order itself. Debt says
      // "about": interest and the autopaid minimum land in between, and the
      // statement's payoff figure is the exact one.
      const running = Boolean(twin?.done)
      const into = step.basis?.recordType === 'goal' ? 'toward' : 'to'
      const finish = payment === 'payment'
        ? `Pay off the last ${money(after)} of ${name || 'the balance'}`
        : `Move the last ${money(after)} ${into} ${name || 'it'}`
      // A debt is cleared; a savings account is not "finished" — its target is reached.
      const target = num(next.outcome?.targetAmount)
      const outcomeText = payment === 'payment'
        ? { done: `${name || 'It'} shows a $0 balance`, why: `This clears ${name || 'it'}.` }
        : { done: `${name || 'It'} is at ${target > 0 ? money(target) : 'its target'}`, why: `This takes ${name || 'it'} to ${target > 0 ? money(target) : 'its target'}.` }
      mainPatch.text = `${finish}${running ? `, then stop the ${money(scheduled)} scheduled ${payment}` : ''}`
      mainPatch.detail = `${outcomeText.why}${running ? ` The standing ${payment} would keep going after that, so this ends it rather than changing it for one month.` : ''}`
      mainPatch.doneWhen = `${outcomeText.done}${running ? ` and no ${payment} is scheduled for it` : ''}.`
      mainPatch.outcome = { ...(mainPatch.outcome || {}), final: true }
      if (twin) updates.push({ id: twin.id, patch: { supersededAt: now, pinnedAt: null } })
    } else if (twin && scheduled !== after) {
      // The standing order always follows the move, whatever the size of the
      // change: a plan quoting $950 while the bank sends $1,100 is the one
      // mismatch this whole review exists to prevent.
      const nextTwin = pool.find(candidate => candidate.intentKey === `setup.${intent}`)
      const patch = nextTwin
        ? rewrittenMove(nextTwin, fingerprint)
        : {
          ...rewrittenMove({ ...twin, outcome: { ...(twin.outcome || {}), amount: after } }, fingerprint),
          text: `Change your scheduled ${money(scheduled)} monthly ${payment} to ${money(after)}`,
          detail: `The plan now sizes this move at ${money(after)} a month, so the standing ${payment} you set up should match it.`,
          doneWhen: `The recurring ${payment} is set to ${money(after)} and its next date is confirmed.`,
        }
      // Already running at the bank at the old amount: reopening the step is
      // the honest instruction, because the bank will keep sending the old one.
      if (twin.done) {
        patch.text = `Change your scheduled ${money(scheduled)} monthly ${payment} to ${money(after)}`
        patch.done = false
        patch.completedAt = null
      }
      updates.push({ id: twin.id, patch })
    }

    return {
      kind: 'amount_update',
      step,
      reason: amountUpdateReason({ step, before, after, beforeTarget, afterTarget, route, finishing, name }),
      replacement: { ...next, ...mainPatch, id: step.id },
      updates,
      before,
      after,
      final: finishing,
    }
  }
  return null
}

// A move the route no longer funds at all: something new outranks it (an
// 18% loan appears, and the savings transfer pauses). Left alone, the plan
// directs the same dollars twice.
export function pausedMove({ active = [], pool = [], route = null, fingerprint = null } = {}) {
  if (!route?.ready || !(num(route.availableMonthlyAmount) > 0)) return null
  const funded = new Set(pool.map(step => step.intentKey))
  const lead = (route.allocations || []).find(item => num(item.amount) > 0 && !['unassigned', 'hold_for_coverage'].includes(item.key))
  if (!lead) return null
  for (const step of active) {
    if (step.done || step.source === 'user' || step.reviewOverrideFingerprint === fingerprint || step.outcome?.final) continue
    const intent = step.intentKey || ''
    if (!/^(fund\.|pay\.debt\.)/.test(intent) || funded.has(intent)) continue
    if (!(num(step.outcome?.amount) > 0) || !step.outcome?.recurrence) continue
    const leadName = lead.destinationName || lead.label
    return {
      step,
      reason: `Your plan now sends this money to ${leadName} first, so this ${money(step.outcome.amount)}/mo move pauses for now.`,
    }
  }
  return null
}

/**
 * What retiring a money move does to the standing order behind it. A paid-off
 * card with a $700 monthly payment still scheduled at the bank is the plan
 * leaving money running somewhere it no longer belongs — nothing used to say
 * so. An order never set up is simply retired with its move.
 */
export function retirementFor(steps = [], step) {
  const intent = step?.intentKey || ''
  if (!intent || intent.startsWith('setup.')) return null
  const twin = steps.find(item => item?.intentKey === `setup.${intent}` && !item.supersededAt)
  if (!twin) return null
  // Not set up yet — or it was a "pay the last amount, then stop" errand,
  // which already ends the standing order.
  if (!twin.done || twin.outcome?.final) return { twinId: twin.id, action: 'retire', text: null }
  const amount = num(twin.outcome?.amount) || num(step.outcome?.amount)
  const payment = step.outcome?.kind === 'debt_payment' ? 'payment' : 'transfer'
  const name = step.basis?.recordName
  const text = `Stop the scheduled ${money(amount)} monthly ${payment}${name ? ` to ${name}` : ''}`
  return {
    twinId: twin.id,
    action: 'stop',
    text,
    step: {
      text,
      detail: `That move is finished, so end the standing ${payment} behind it. Otherwise it keeps sending money your plan now puts somewhere else.`,
      doneWhen: `The scheduled ${payment} is cancelled and no future date shows.`,
      intentKey: `stop.${twin.intentKey}`,
      completionPolicy: 'once',
      priorityKey: step.priorityKey || null,
      outcome: {
        kind: 'information_only',
        sourceAccountId: twin.outcome?.sourceAccountId || step.outcome?.sourceAccountId || null,
        destinationAccountId: twin.outcome?.destinationAccountId || null,
        debtId: twin.outcome?.debtId || step.outcome?.debtId || null,
      },
      basis: step.basis ? { ...step.basis } : null,
      source: 'money-route',
    },
  }
}

// Retires a move and whatever automated it, returning the new step list.
export function retireMove(steps = [], stepId, { now = new Date().toISOString() } = {}) {
  const step = steps.find(item => item.id === stepId)
  if (!step) return steps
  const retirement = retirementFor(steps, step)
  // The old standing order is retired either way: directly, or via the new
  // "stop it" errand that now carries it. Left live, a cancelled schedule
  // would block the next move from ever getting one of its own.
  const next = steps.map(item => {
    if (item.id === stepId) return { ...item, supersededAt: now, pinnedAt: null }
    if (retirement && item.id === retirement.twinId) return { ...item, supersededAt: now, pinnedAt: null }
    return item
  })
  if (retirement?.action === 'stop' && !steps.some(item => item.intentKey === retirement.step.intentKey && !item.done)) {
    next.push({ ...retirement.step, id: `stop_${retirement.twinId}_${Date.parse(now) || 0}`, done: false, addedAt: now })
  }
  return next
}

export function buildPlanModel({ snapshot = {}, setupState, plan, activities = [], reminders = [], moneyRoute = null, now = new Date(), proposals = [] } = {}) {
  const fingerprint = focusPlanFingerprint({ snapshot, setupState, plan, activities, reminders, moneyRoute })
  // Money Route turns missing facts into reviewable confirmation steps. A gap
  // can refine the route without hiding every other verified recommendation.
  const prerequisite = moneyRoute ? null : prerequisiteFromSetup(setupState)
  const active = orderFocusSteps((plan?.steps || [])
    .filter(step => !step.done && !step.supersededAt)
    .map(step => ({ ...step, doneWhen: doneWhenForStep(step) })))
  const approvedFocus = active.slice(0, FOCUS_SIZE)
  const later = active.slice(FOCUS_SIZE)
  const candidates = moneyRoute
    ? candidatesFromMoneyRoute(moneyRoute, plan, activities)
    : prerequisite ? [] : buildFocusCandidates({ snapshot, plan, activities, reminders, now, fingerprint })
  const wording = new Map((proposals || []).map(step => [step.candidateKey, step]))
  const proposed = candidates.map(candidate => {
    const improved = wording.get(candidate.candidateKey)
    return improved ? { ...candidate, ...improved, id: candidate.id, proposed: true } : candidate
  })
  const focus = [...approvedFocus, ...proposed.slice(0, Math.max(0, FOCUS_SIZE - approvedFocus.length))]
  // An amount update only exists while the route still wants the same move,
  // so it never masks a structural change (debt paid off, target reached) —
  // those drop the intent from the route and fall through to staleStepReason.
  const pool = moneyRoute ? routeStepPool(moneyRoute) : []
  const stamp = now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString()
  const amountUpdate = moneyRoute
    ? amountUpdateReview({ steps: plan?.steps || [], pool, route: moneyRoute, fingerprint, now: stamp })
    : null
  // A finished move elsewhere goes first — it is usually WHY an amount moved
  // ("the card is paid off" before "this can rise to $1,100"). For the step
  // being resized itself, the resize wins: it keeps the step and its history.
  const resizing = new Set((amountUpdate?.updates || []).map(update => update.id))
  const reviewStep = active.find(step => !resizing.has(step.id) && staleStepReason(step, snapshot, activities, fingerprint)) || null
  const paused = !reviewStep && !amountUpdate && moneyRoute
    ? pausedMove({ active, pool, route: moneyRoute, fingerprint })
    : null
  const retiring = reviewStep || paused?.step || null
  const review = retiring ? {
    kind: 'replace',
    step: retiring,
    reason: reviewStep ? staleStepReason(reviewStep, snapshot, activities, fingerprint) : paused.reason,
    retire: retirementFor(plan?.steps || [], retiring),
  } : amountUpdate

  return {
    prerequisite,
    focus,
    later,
    review,
    fingerprint,
    candidates: proposed.slice(0, Math.max(0, FOCUS_SIZE - approvedFocus.length)),
    // The whole deduped plan. `candidates` is trimmed to what fits the
    // three-slot focus view; approving the plan should save all of it.
    routeCandidates: proposed,
    approvedCount: approvedFocus.length,
  }
}

function numericClaims(text) {
  return String(text || '').match(/\$\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\b20\d\d-\d\d-\d\d\b/g) || []
}

function normalizedClaim(value) {
  return String(value).replace(/\s|,/g, '').toLowerCase()
}

function validActionText(text) {
  const clean = String(text || '').trim()
  if (!clean || clean.length > 140) return false
  if (/^(learn|consider|explore|understand|look into|think about)\b/i.test(clean)) return false
  return /^[A-Za-z]/.test(clean)
}

function validDoneWhen(text) {
  const clean = String(text || '').trim()
  return clean.length >= 10 && clean.length <= 180
    && /(shows?|saved|selected|confirmed|active|appears?|exists?|paid|transferred|deposited|invested|scheduled|reached|recorded|reflects?|contains?|no more than|or more)/i.test(clean)
}

export function validateFocusPlanResult(result, candidates = []) {
  const steps = Array.isArray(result?.steps) ? result.steps : []
  const allowed = new Map(candidates.map(candidate => [candidate.candidateKey, candidate]))
  const accepted = []
  const rejected = []
  const seen = new Set()

  for (const raw of steps) {
    const candidate = allowed.get(raw?.candidateKey)
    let reason = null
    if (!candidate || seen.has(raw?.candidateKey)) reason = 'candidate'
    else if (!validActionText(raw?.text) || !String(raw?.detail || '').trim() || !validDoneWhen(raw?.doneWhen)) reason = 'quality'
    else if (accepted.some(step => samePlanStep(step.text, raw.text))) reason = 'duplicate'
    else {
      const grounding = [candidate.text, candidate.detail, candidate.doneWhen, candidate.impact, JSON.stringify(candidate.basis), JSON.stringify(candidate.outcome)]
        .filter(Boolean).join(' ')
      const allowedClaims = new Set(numericClaims(grounding).map(normalizedClaim))
      const claims = numericClaims(`${raw.text} ${raw.detail} ${raw.doneWhen} ${raw.impact || ''}`)
      if (claims.some(claim => !allowedClaims.has(normalizedClaim(claim)))) reason = 'grounding'
    }
    if (reason) {
      if (candidate) rejected.push({ candidate, reason })
      continue
    }
    seen.add(raw.candidateKey)
    accepted.push({
      candidateKey: raw.candidateKey,
      text: String(raw.text).trim(),
      detail: String(raw.detail).trim(),
      doneWhen: String(raw.doneWhen).trim(),
      impact: String(raw.impact || '').trim() || null,
    })
  }

  for (const candidate of candidates) {
    if (!seen.has(candidate.candidateKey) && !rejected.some(item => item.candidate.candidateKey === candidate.candidateKey)) {
      rejected.push({ candidate, reason: 'missing' })
    }
  }
  return { accepted, rejected }
}

export function mergeFocusWording(candidates = [], ...results) {
  const wording = new Map()
  for (const result of results) {
    const { accepted } = validateFocusPlanResult(result, candidates.filter(candidate => !wording.has(candidate.candidateKey)))
    for (const step of accepted) wording.set(step.candidateKey, step)
  }
  return candidates.map(candidate => ({ ...candidate, ...(wording.get(candidate.candidateKey) || {}) }))
}

export function replacementCandidate(model) {
  if (!model?.review?.step) return null
  if (model.review.kind === 'amount_update') return model.review.replacement
  return model.candidates.find(candidate => candidate.intentKey !== model.review.step.intentKey)
    || model.candidates[0]
    || null
}
