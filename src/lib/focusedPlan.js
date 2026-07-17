import { financialPriorities, THRESHOLDS } from './finance.js'
import { filterFreshPlanSteps, samePlanStep } from './planReplenishment.js'
import { isWorkplaceAccount } from './moneyModel.js'

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

export function focusPlanFingerprint({ snapshot = {}, setupState, plan, activities = [] } = {}) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : []
  const state = {
    setup: setupState?.next?.id || null,
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

export function buildFocusCandidates({ snapshot = {}, plan, activities = [], now = new Date(), fingerprint } = {}) {
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

  if (key === 'kill_debt' || basis.recordType === 'debt') {
    const debt = findRecord(snapshot.debts, basis)
    if (!debt || num(debt.balance) <= 0) return `${basis.recordName || 'This debt'} is now paid off.`
    if (basis.balance !== null && basis.balance !== undefined) {
      const original = Math.max(1, num(basis.balance))
      if (Math.abs(num(debt.balance) - original) / original >= 0.25) return 'The debt balance changed materially, so the amount and sequence need a fresh calculation.'
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

  const sourceId = step.outcome?.sourceAccountId
  if (sourceId && num(step.outcome?.amount) > 0) {
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

export function buildPlanModel({ snapshot = {}, setupState, plan, activities = [], now = new Date(), proposals = [] } = {}) {
  const fingerprint = focusPlanFingerprint({ snapshot, setupState, plan, activities })
  const prerequisite = prerequisiteFromSetup(setupState)
  const active = orderFocusSteps((plan?.steps || []).filter(step => !step.done && !step.supersededAt))
  const approvedFocus = active.slice(0, FOCUS_SIZE)
  const later = active.slice(FOCUS_SIZE)
  const candidates = prerequisite ? [] : buildFocusCandidates({ snapshot, plan, activities, now, fingerprint })
  const wording = new Map((proposals || []).map(step => [step.candidateKey, step]))
  const proposed = candidates.map(candidate => {
    const improved = wording.get(candidate.candidateKey)
    return improved ? { ...candidate, ...improved, id: candidate.id, proposed: true } : candidate
  })
  const focus = [...approvedFocus, ...proposed.slice(0, Math.max(0, FOCUS_SIZE - approvedFocus.length))]
  const reviewStep = active.find(step => staleStepReason(step, snapshot, activities, fingerprint)) || null
  const review = reviewStep ? {
    step: reviewStep,
    reason: staleStepReason(reviewStep, snapshot, activities, fingerprint),
  } : null

  return {
    prerequisite,
    focus,
    later,
    review,
    fingerprint,
    candidates: proposed.slice(0, Math.max(0, FOCUS_SIZE - approvedFocus.length)),
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
  return model.candidates.find(candidate => candidate.intentKey !== model.review.step.intentKey)
    || model.candidates[0]
    || null
}
