import { THRESHOLDS } from './finance.js'
import { accountFamily, isWorkplaceAccount } from './moneyModel.js'

const num = value => Number(value) || 0
const known = value => value !== null && value !== undefined && value !== ''
const roundMoney = value => Math.max(0, Math.round(num(value)))
const money = value => `$${roundMoney(value).toLocaleString()}`

function hashState(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function stableRecords(records, project) {
  return (records || []).map(project)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function routeState({ snapshot, profile, accounts, debts, goals, activities, setupState }) {
  return {
    profile: {
      income: num(snapshot.income),
      expenses: num(snapshot.expenses),
      allocations: num(snapshot.futureAllocations),
      insurance: profile?.health_insurance || '',
      workplacePlan: profile?.employer_401k || '',
      employment: profile?.employment_type || '',
      goal: profile?.primary_goal || '',
    },
    setup: setupState?.next?.id || null,
    accounts: stableRecords(accounts, account => ({
      id: account?.id || '', name: account?.name || '', type: account?.type || '', subtype: account?.subtype || '',
      balance: num(account?.balance), contribution: num(account?.monthly_contribution),
      contributionPercent: known(account?.contribution_percent) ? num(account?.contribution_percent) : null,
      match: known(account?.employer_match_percent) ? num(account?.employer_match_percent) : null,
      matchLimit: known(account?.employer_match_limit_percent) ? num(account?.employer_match_limit_percent) : null,
    })),
    debts: stableRecords(debts, debt => ({
      id: debt?.id || '', name: debt?.name || '', balance: num(debt?.balance),
      rate: known(debt?.interest_rate) ? num(debt?.interest_rate) : null,
      minimum: known(debt?.minimum_payment) ? num(debt?.minimum_payment) : null,
      planned: known(debt?.planned_payment) ? num(debt?.planned_payment) : null,
    })),
    goals: stableRecords(goals, goal => ({
      id: goal?.id || '', name: goal?.name || '', target: num(goal?.target_amount),
      current: num(goal?.current_amount), monthly: num(goal?.monthly_contribution), deadline: goal?.deadline || '',
    })),
    activities: stableRecords(activities, activity => ({
      intent: activity?.intent_key || '', status: activity?.status || '', amount: num(activity?.amount),
      appliedAt: activity?.applied_at || '',
    })),
  }
}

function firstCashAccount(accounts) {
  const cash = accounts.filter(account => accountFamily(account) === 'cash')
  return cash.find(account => String(account.subtype || account.type).toLowerCase() === 'checking') || cash[0] || null
}

function emergencyAccount(accounts) {
  return accounts.find(account => {
    if (accountFamily(account) !== 'cash') return false
    const type = String(account.subtype || account.type).toLowerCase()
    return ['hysa', 'standard_savings', 'savings', 'money_market', 'emergency'].includes(type)
  }) || null
}

function activeGoals(goals) {
  return goals.filter(goal => num(goal.target_amount) > num(goal.current_amount))
    .sort((left, right) => {
      if (left.deadline && right.deadline) return left.deadline.localeCompare(right.deadline)
      if (left.deadline) return -1
      if (right.deadline) return 1
      return String(left.created_at || left.id || '').localeCompare(String(right.created_at || right.id || ''))
    })
}

function routeBlocker({ id, title, detail, sheet, recordId = null, question = null }) {
  return { id, title, detail, sheet, recordId, question, material: true }
}

function addAllocation(list, allocation, remaining) {
  const maximum = allocation.maxAmount == null ? remaining : Math.min(remaining, roundMoney(allocation.maxAmount))
  const amount = allocation.amount == null ? maximum : Math.min(remaining, roundMoney(allocation.amount))
  list.push({ confidence: 'verified', adjustable: amount > 0, ...allocation, amount, maxAmount: allocation.maxAmount ?? amount })
  return Math.max(0, remaining - amount)
}

function applyAdjustments(allocations, available, adjustments) {
  if (!adjustments || typeof adjustments !== 'object') return allocations
  let remaining = available
  const adjusted = allocations.map(allocation => {
    if (!allocation.adjustable || allocation.amount <= 0) return allocation
    const requested = Object.hasOwn(adjustments, allocation.key)
      ? roundMoney(adjustments[allocation.key])
      : allocation.amount
    const amount = Math.min(remaining, requested)
    remaining -= amount
    return { ...allocation, amount, userAdjusted: amount !== allocation.amount }
  }).filter(allocation => allocation.amount > 0 || !allocation.adjustable)

  const existingUnassigned = adjusted.find(allocation => allocation.key === 'unassigned')
  if (existingUnassigned) {
    existingUnassigned.amount += remaining
  } else if (remaining > 0) {
    adjusted.push({
      key: 'unassigned', label: 'Left unassigned for now', amount: remaining,
      destinationType: 'unassigned', destinationId: null,
      reason: 'This amount remains available until you choose a destination.',
      confidence: 'verified', adjustable: false,
    })
  }
  return adjusted
}

function routeChapter({ snapshot, profile, allocations }) {
  if (num(snapshot.cashFlowMargin) < 0 || num(snapshot.unallocated) < 0) return 'Stabilize'
  if (profile?.health_insurance === 'none' || allocations.some(item => item.key === 'starter_emergency')) return 'Protect'
  if (allocations.some(item => item.destinationType === 'debt')) return 'Eliminate'
  if (allocations.some(item => item.key === 'full_emergency')) return 'Build your cushion'
  return 'Grow'
}

function nextDestinationFor(allocations, snapshot, goals) {
  const funded = allocations.filter(item => item.amount > 0 && item.destinationType !== 'unassigned')
  if (funded.length > 1) return funded[1].label
  const first = funded[0]
  if (first?.destinationType === 'debt') return `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`
  if (first?.key === 'starter_emergency') {
    const debt = (snapshot.debts || []).filter(item => num(item.balance) > 0 && num(item.interest_rate) > THRESHOLDS.highApr)
      .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))[0]
    return debt ? `Pay down ${debt.name}` : `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`
  }
  if (first?.key === 'full_emergency') {
    const goal = activeGoals(goals)[0]
    return goal ? `Fund ${goal.name}` : 'Increase long-term investing'
  }
  return null
}

/**
 * A deterministic monthly waterfall shared by onboarding, Advisor, Home, and
 * Plan. It allocates only recorded money left to assign; AI never participates
 * in the ordering or amount calculation.
 */
export function buildMoneyRoute({
  snapshot = {},
  profile = snapshot.profile || {},
  accounts = snapshot.accounts || [],
  debts = snapshot.debts || [],
  goals = snapshot.goals || [],
  activities = [],
  setupState = null,
  adjustments = null,
} = {}) {
  const baseFingerprint = `route-v1-${hashState(JSON.stringify(routeState({
    snapshot, profile, accounts, debts, goals, activities, setupState,
  })))}`
  const detailedFlow = (snapshot.cashFlowItems || []).length > 0
  const rawAvailable = detailedFlow ? num(snapshot.unallocated) : num(snapshot.cashFlowMargin)
  const debtMinimums = num(snapshot.requiredDebtPayments)
  const recordedDebtPayments = num(snapshot.budgetStatus?.byCategory?.debt_payments)
  const unrecordedDebtMinimums = detailedFlow ? Math.max(0, debtMinimums - recordedDebtPayments) : 0
  const availableMonthlyAmount = Math.max(0, Math.round(rawAvailable - unrecordedDebtMinimums))
  const alreadyCommitted = [
    ...(num(snapshot.expenses) > 0 ? [{ key: 'expenses', label: 'Typical spending', amount: roundMoney(snapshot.expenses), included: true }] : []),
    ...(debtMinimums > 0 ? [{
      key: 'debt_minimums', label: 'Required debt payments', amount: roundMoney(debtMinimums),
      included: detailedFlow ? recordedDebtPayments >= debtMinimums : 'assumed',
    }] : []),
    ...(num(snapshot.futureAllocations) > 0 ? [{ key: 'future_allocations', label: 'Existing future allocations', amount: roundMoney(snapshot.futureAllocations), included: true }] : []),
  ]
  const blockers = []
  const conditionalChanges = []
  const allocations = []
  const source = firstCashAccount(accounts)
  const emergency = emergencyAccount(accounts)
  const activeDebts = debts.filter(debt => num(debt.balance) > 0)
  const unratedDebt = [...activeDebts].filter(debt => !known(debt.interest_rate))
    .sort((left, right) => num(right.balance) - num(left.balance))[0]
  const missingMinimum = [...activeDebts].filter(debt => !known(debt.minimum_payment))
    .sort((left, right) => num(right.balance) - num(left.balance))[0]

  if (setupState?.next && ['income', 'expenses'].includes(setupState.next.id)) {
    blockers.push(routeBlocker({
      id: setupState.next.id, title: setupState.next.label,
      detail: 'Income and spending are required before money can be assigned safely.',
      sheet: setupState.next.sheet || 'plan',
    }))
  }

  // Employer match is evaluated before the debt/balance bookkeeping blockers
  // below: only the highest-ranked blocker is ever surfaced in the UI
  // (MoneyRouteCard shows blockers[0] as the headline), and an unconfirmed or
  // undetailed match is worth more to a user than a reconciliation nit — it's
  // the "free money" priority everywhere else in the app.
  const workplaceAccounts = accounts.filter(isWorkplaceAccount)
  const workplace = workplaceAccounts[0] || null
  const profileMatch = profile?.employer_401k
  const hasRecordedMatch = workplaceAccounts.some(account => (
    num(account.employer_match_percent) > 0 && num(account.employer_match_limit_percent) > 0
  ))
  const matchUnknown = profileMatch === 'unsure' && !hasRecordedMatch
  const matchExpected = profileMatch === 'match' || hasRecordedMatch
  const matchDetailsMissing = matchExpected && (!workplace
    || !known(workplace.employer_match_percent)
    || !known(workplace.employer_match_limit_percent)
    || !known(workplace.contribution_percent))

  if (matchUnknown) {
    const question = {
      key: 'employer_match',
      prompt: 'Does your employer match contributions to your workplace retirement plan?',
      options: [
        { value: 'match', label: 'Yes, there is a match' },
        { value: 'no_match', label: 'No employer match' },
        { value: 'unsure', label: 'I need to check' },
      ],
    }
    blockers.push(routeBlocker({
      id: 'employer_match_unknown', title: 'Confirm whether your employer offers a retirement match',
      detail: 'A match could redirect only the amount needed to capture it; the rest of this route still stands.',
      sheet: 'investment', question,
    }))
    conditionalChanges.push({
      key: 'employer_match_unknown',
      title: 'One fact could improve this route',
      detail: 'If a match exists, direct only enough payroll contribution to capture it. Keep the remaining monthly money on the current route.',
    })
  } else if (matchDetailsMissing) {
    blockers.push(routeBlocker({
      id: 'employer_match_details', title: 'Add your employer-match limit and current contribution',
      detail: 'The match is recorded, but the app needs the percentages before it can calculate the payroll change.',
      sheet: 'investment', recordId: workplace?.id || null,
    }))
  }

  if (unrecordedDebtMinimums > 0) {
    blockers.push(routeBlocker({
      id: 'debt_payment_gap', title: `Add ${money(unrecordedDebtMinimums)} of required debt payments to your Monthly Plan`,
      detail: 'This amount was reserved before calculating money left to assign.', sheet: 'plan',
    }))
  } else if (missingMinimum) {
    blockers.push(routeBlocker({
      id: 'debt_minimum', title: `Add the minimum payment for ${missingMinimum.name}`,
      detail: 'The route currently assumes your lump monthly spending already includes this required payment.',
      sheet: 'debts', recordId: missingMinimum.id,
    }))
  }
  if (unratedDebt) {
    blockers.push(routeBlocker({
      id: 'debt_rate', title: `Add the APR for ${unratedDebt.name}`,
      detail: 'Its balance remains tracked, but it cannot be ranked honestly against known high-interest debts.',
      sheet: 'debts', recordId: unratedDebt.id,
    }))
  }
  if (!accounts.length) {
    blockers.push(routeBlocker({
      id: 'balances', title: 'Add checking and savings balances',
      detail: 'The monthly route is still available, but transfers need real source and destination accounts.',
      sheet: 'accounts',
    }))
  }

  let remaining = availableMonthlyAmount
  const cashFlowGap = Math.abs(Math.min(0, Math.round(num(snapshot.cashFlowMargin))))
  const allocationGap = Math.abs(Math.min(0, Math.round(num(snapshot.unallocated))))

  if (cashFlowGap > 0) {
    allocations.push({
      key: 'repair_budget', label: `Reduce typical spending by ${money(cashFlowGap)}`,
      amount: 0, targetAmount: cashFlowGap, destinationType: 'monthly_plan', destinationId: null,
      reason: 'Spending is above income, so there is no safe monthly amount to route yet.', confidence: 'verified', adjustable: false,
    })
  } else if (allocationGap > 0) {
    allocations.push({
      key: 'repair_allocations', label: `Reduce planned allocations by ${money(allocationGap)}`,
      amount: 0, targetAmount: allocationGap, destinationType: 'monthly_plan', destinationId: null,
      reason: 'The spending plan works, but future allocations exceed the money available.', confidence: 'verified', adjustable: false,
    })
  } else if (profile?.health_insurance === 'none') {
    allocations.push({
      key: 'choose_health_coverage', label: 'Choose health coverage before committing new monthly money',
      amount: 0, destinationType: 'profile', destinationId: null,
      reason: 'A premium must be known before the remaining monthly amount can be assigned honestly.', confidence: 'verified', adjustable: false,
    })
    if (remaining > 0) {
      remaining = addAllocation(allocations, {
        key: 'hold_for_coverage', label: 'Keep available while you compare coverage',
        destinationType: 'cash', destinationId: source?.id || null,
        reason: 'No insurance premium was invented; this money remains available until a real cost is entered.',
        confidence: 'provisional', adjustable: false,
      }, remaining)
    }
  } else {
    const starterGap = Math.max(0, THRESHOLDS.starterEmergency - num(snapshot.liquid))
    if (starterGap > 0 && remaining > 0) {
      remaining = addAllocation(allocations, {
        key: 'starter_emergency', label: `Build the ${money(THRESHOLDS.starterEmergency)} starter reserve`,
        maxAmount: starterGap, destinationType: 'account', destinationId: emergency?.id || null,
        sourceAccountId: source?.id || null,
        reason: 'A small liquid buffer prevents routine surprises from becoming new debt.',
      }, remaining)
    }

    const matchLimit = num(workplace?.employer_match_limit_percent)
    const currentPercent = num(workplace?.contribution_percent)
    const monthlyContribution = num(workplace?.monthly_contribution)
    if (matchExpected && !matchDetailsMissing && matchLimit > currentPercent && remaining > 0) {
      const estimatedIncrease = currentPercent > 0 && monthlyContribution > 0
        ? Math.max(0, Math.round(monthlyContribution * (matchLimit / currentPercent - 1)))
        : 0
      if (estimatedIncrease > 0) {
        remaining = addAllocation(allocations, {
          key: 'capture_employer_match', label: `Raise ${workplace.name || 'workplace-plan'} contributions to ${matchLimit}%`,
          amount: Math.min(estimatedIncrease, remaining), destinationType: 'account', destinationId: workplace.id || null,
          reason: 'This is the estimated payroll increase needed to capture the recorded match.', confidence: 'estimated',
        }, remaining)
      } else {
        allocations.push({
          key: 'capture_employer_match', label: `Raise ${workplace.name || 'workplace-plan'} contributions to ${matchLimit}%`,
          amount: 0, destinationType: 'account', destinationId: workplace.id || null,
          reason: 'The percentage is known, but the monthly payroll amount is not; update take-home pay after the change.',
          confidence: 'provisional', adjustable: false,
        })
      }
    }

    const highInterest = activeDebts.filter(debt => known(debt.interest_rate) && num(debt.interest_rate) > THRESHOLDS.highApr)
      .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))
    for (const debt of highInterest) {
      if (remaining <= 0) break
      remaining = addAllocation(allocations, {
        key: `debt.${debt.id || debt.name}`, label: `Pay extra toward ${debt.name}`,
        maxAmount: num(debt.balance), destinationType: 'debt', destinationId: debt.id || null,
        sourceAccountId: source?.id || null,
        reason: `${num(debt.interest_rate)}% APR makes this the highest verified debt cost.`,
      }, remaining)
    }

    const projectedLiquid = num(snapshot.liquid) + allocations
      .filter(item => item.key === 'starter_emergency')
      .reduce((sum, item) => sum + num(item.amount), 0)
    const fullReserveGap = Math.max(0, num(snapshot.efTargetAmount) - projectedLiquid)
    if (fullReserveGap > 0 && remaining > 0) {
      remaining = addAllocation(allocations, {
        key: 'full_emergency', label: `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`,
        maxAmount: fullReserveGap, destinationType: 'account', destinationId: emergency?.id || null,
        sourceAccountId: source?.id || null,
        reason: `The recorded target is ${money(snapshot.efTargetAmount)} of liquid reserves.`,
      }, remaining)
    }

    if (remaining > 0) {
      const goal = activeGoals(goals)[0]
      const investment = accounts.find(account => accountFamily(account) === 'investment') || null
      if (goal) {
        remaining = addAllocation(allocations, {
          key: `goal.${goal.id || goal.name}`, label: `Fund ${goal.name}`,
          maxAmount: Math.max(0, num(goal.target_amount) - num(goal.current_amount)),
          destinationType: 'goal', destinationId: goal.id || null,
          reason: 'Higher protection and debt priorities are covered, so the nearest active goal is next.',
        }, remaining)
      } else if (investment) {
        remaining = addAllocation(allocations, {
          key: `investment.${investment.id || investment.name}`, label: `Increase investing in ${investment.name}`,
          destinationType: 'account', destinationId: investment.id || null,
          reason: 'Core protections are covered, so remaining monthly money can support long-term growth.',
        }, remaining)
      } else {
        allocations.push({
          key: 'open_investment_account', label: 'Open a long-term investment account', amount: 0,
          destinationType: 'account_opening', destinationId: null,
          reason: 'Choose and record the account before assigning a contribution.', confidence: 'provisional', adjustable: false,
        })
      }
    }
    if (remaining > 0) {
      remaining = addAllocation(allocations, {
        key: 'unassigned', label: 'Left unassigned for now', destinationType: 'unassigned', destinationId: null,
        reason: 'This amount stays available until the next destination is confirmed.', adjustable: false,
      }, remaining)
    }
  }

  const finalAllocations = applyAdjustments(allocations, availableMonthlyAmount, adjustments)
  const chapter = routeChapter({ snapshot, profile, allocations: finalAllocations })
  const fingerprint = adjustments
    ? `${baseFingerprint}-${hashState(JSON.stringify(adjustments))}`
    : baseFingerprint
  const provisional = blockers.length > 0 || finalAllocations.some(item => item.confidence !== 'verified')

  return {
    chapter,
    availableMonthlyAmount,
    allocations: finalAllocations,
    alreadyCommitted,
    blockers,
    conditionalChanges,
    primaryQuestion: blockers.find(blocker => blocker.question)?.question || null,
    nextDestination: nextDestinationFor(finalAllocations, snapshot, goals),
    provisional,
    complete: !provisional,
    baseFingerprint,
    fingerprint,
  }
}

function stepBase(route, index, values) {
  return {
    candidateKey: `money-route.${values.key}`,
    text: values.text,
    detail: values.detail,
    doneWhen: values.doneWhen,
    impact: values.impact || null,
    intentKey: values.intentKey,
    completionPolicy: values.completionPolicy || 'once',
    outcome: values.outcome || null,
    priorityKey: values.priorityKey || 'assign_cash',
    basis: values.basis || null,
    chapterId: `money-route.${route.chapter.toLowerCase().replace(/\s+/g, '_')}`,
    chapterOrder: index + 1,
    generatedForFingerprint: route.fingerprint,
    guideFingerprint: route.fingerprint,
    source: 'money-route',
    proposed: true,
  }
}

function blockerStep(route, blocker, index) {
  if (!blocker) return null
  const map = {
    employer_match_unknown: {
      text: 'Confirm whether your employer offers a retirement match',
      doneWhen: 'Your employer-match status is saved as yes or no.',
      intentKey: 'verify.employer_match', priorityKey: 'capture_match',
    },
    employer_match_details: {
      text: 'Add your employer-match limit and current contribution',
      doneWhen: 'Your workplace account shows the match limit and your current contribution percentage.',
      intentKey: 'verify.employer_match_details', priorityKey: 'capture_match',
    },
    debt_rate: {
      text: blocker.title,
      doneWhen: 'The debt shows its current APR in Money.',
      intentKey: `verify.debt_rate.${blocker.recordId || 'primary'}`, priorityKey: 'kill_debt',
    },
    debt_minimum: {
      text: blocker.title,
      doneWhen: 'The debt shows its required minimum monthly payment in Money.',
      intentKey: `verify.debt_minimum.${blocker.recordId || 'primary'}`, priorityKey: 'kill_debt',
    },
    debt_payment_gap: {
      text: blocker.title,
      doneWhen: 'The Monthly Plan includes every required debt payment.',
      intentKey: 'budget.record_debt_minimums', priorityKey: 'deficit',
    },
    balances: {
      text: 'Add your checking and savings balances',
      doneWhen: 'Money shows at least one current cash-account balance.',
      intentKey: 'verify.cash_balances', priorityKey: 'starter_ef',
    },
    income: {
      text: blocker.title,
      doneWhen: 'The Monthly Plan shows typical take-home income.',
      intentKey: 'verify.monthly_income', priorityKey: 'deficit',
    },
    expenses: {
      text: blocker.title,
      doneWhen: 'The Monthly Plan shows typical monthly spending.',
      intentKey: 'verify.monthly_expenses', priorityKey: 'deficit',
    },
  }
  const values = map[blocker.id]
  if (!values) return null
  return stepBase(route, index, {
    key: blocker.id, ...values, detail: blocker.detail,
    outcome: { kind: 'information_only' },
    basis: { recordType: blocker.sheet || 'money', recordId: blocker.recordId || null },
  })
}

function allocationStep(route, allocation, index) {
  if (!allocation) return null
  const amount = roundMoney(allocation.amount)
  const basis = {
    recordType: allocation.destinationType,
    recordId: allocation.destinationId || null,
    monthlyCapacity: route.availableMonthlyAmount,
  }
  if (allocation.key === 'repair_budget' || allocation.key === 'repair_allocations') {
    const target = roundMoney(allocation.targetAmount)
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: 'Money left to assign is $0 or more in the Monthly Plan.',
      intentKey: allocation.key === 'repair_budget' ? 'budget.close_deficit.total' : 'budget.fix_allocations.total',
      priorityKey: allocation.key === 'repair_budget' ? 'deficit' : 'overcommitted',
      impact: `Repairs a ${money(target)}/mo gap`, basis,
    })
  }
  if (allocation.key === 'choose_health_coverage') {
    return stepBase(route, index, {
      key: allocation.key, text: 'Choose a health plan with a recorded monthly premium', detail: allocation.reason,
      doneWhen: 'A specific plan, monthly premium, and coverage start date are selected.',
      intentKey: 'choose.health_insurance', priorityKey: 'insurance', outcome: { kind: 'information_only' }, basis,
    })
  }
  if (allocation.key === 'capture_employer_match') {
    const percent = allocation.label.match(/to ([\d.]+)%/)?.[1]
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: `The workplace account contribution setting shows ${percent || 'the full matched'}%.`,
      intentKey: `capture.employer_match.${allocation.destinationId || 'workplace'}`, priorityKey: 'capture_match',
      outcome: { kind: 'recurring_setup', amount: amount || null, destinationAccountId: allocation.destinationId || null, contributionPercent: percent ? Number(percent) : null },
      basis,
    })
  }
  if (allocation.key === 'open_investment_account') {
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: 'The investment account appears in Money with its institution and current balance.',
      intentKey: 'open.investment_account', priorityKey: 'roth', outcome: { kind: 'account_opening' }, basis,
    })
  }
  if (amount <= 0 || ['unassigned', 'hold_for_coverage'].includes(allocation.key)) return null

  const isDebt = allocation.destinationType === 'debt'
  const isGoal = allocation.destinationType === 'goal'
  const isReserve = ['starter_emergency', 'full_emergency'].includes(allocation.key)
  const intentKey = isDebt
    ? `pay.debt.${allocation.destinationId || 'highest_apr'}`
    : isGoal
      ? `fund.goal.${allocation.destinationId || 'primary'}`
      : isReserve
        ? 'fund.emergency_reserve'
        : `fund.investment.${allocation.destinationId || 'primary'}`
  const outcome = {
    kind: isDebt ? 'debt_payment' : isGoal || !isReserve ? 'contribution' : 'transfer',
    amount, recurrence: 'monthly', stateFingerprint: route.fingerprint,
    sourceAccountId: allocation.sourceAccountId || null,
  }
  if (isDebt) outcome.debtId = allocation.destinationId || null
  if (isGoal) outcome.goalId = allocation.destinationId || null
  if (!isDebt && !isGoal) outcome.destinationAccountId = allocation.destinationId || null
  // outcome.recurrence above is unconditionally 'monthly' — every allocation
  // step is an ongoing commitment. Without "/mo" here, this step ("Pay
  // $1,240 to Visa Card") sits directly above buildInitialPlan's automation
  // step ("Schedule $1,240 monthly toward Visa Card") and reads as a second,
  // separate $1,240 outflow rather than the same recurring amount described
  // two ways — the automation step exists to set up autopay FOR this one.
  return stepBase(route, index, {
    key: allocation.key,
    text: `${isDebt ? 'Pay' : 'Move'} ${money(amount)}/mo ${isDebt ? 'to' : 'toward'} ${allocation.label.replace(/^Pay extra toward |^Build the |^Grow |^Fund |^Increase investing in /, '')}`,
    detail: allocation.reason,
    doneWhen: `${money(amount)} is ${isDebt ? 'paid and the debt balance is updated' : 'transferred and the destination record reflects it'}.`,
    impact: isDebt ? `Directs ${money(amount)}/mo to the highest verified debt cost` : `Assigns ${money(amount)}/mo to this priority`,
    intentKey, completionPolicy: 'repeatable',
    priorityKey: isDebt ? 'kill_debt' : isGoal ? 'goal' : isReserve ? (allocation.key === 'starter_emergency' ? 'starter_ef' : 'build_ef') : 'invest',
    outcome, basis,
  })
}

/** Convert an approved route into no more than three focused, deduplicable steps. */
export function buildInitialPlan(route) {
  if (!route) return []
  const steps = []
  const blocker = blockerStep(route, route.blockers?.[0], steps.length)
  if (blocker) steps.push(blocker)
  const actionable = (route.allocations || []).filter(item => (
    !['unassigned', 'hold_for_coverage'].includes(item.key)
    && (item.amount > 0 || ['repair_budget', 'repair_allocations', 'choose_health_coverage', 'capture_employer_match', 'open_investment_account'].includes(item.key))
  ))
  const primary = allocationStep(route, actionable[0], steps.length)
  if (primary && !steps.some(step => step.intentKey === primary.intentKey)) steps.push(primary)

  if (primary?.outcome?.amount > 0 && ['transfer', 'contribution', 'debt_payment'].includes(primary.outcome.kind) && steps.length < 3) {
    const destination = actionable[0]?.label || 'the current priority'
    steps.push(stepBase(route, steps.length, {
      key: `automate.${actionable[0]?.key || 'primary'}`,
      text: `Schedule ${money(primary.outcome.amount)} monthly toward ${destination.replace(/^Pay extra toward |^Fund |^Build the |^Grow /, '')}`,
      detail: 'Automation keeps the approved route moving without relying on memory.',
      doneWhen: 'The recurring payment or transfer is scheduled and its first date is confirmed.',
      intentKey: `setup.${primary.intentKey}`,
      priorityKey: primary.priorityKey,
      outcome: {
        kind: 'recurring_setup', amount: primary.outcome.amount, recurrence: 'monthly',
        destinationAccountId: primary.outcome.destinationAccountId || null,
        debtId: primary.outcome.debtId || null, goalId: primary.outcome.goalId || null,
        stateFingerprint: route.fingerprint,
      },
      basis: primary.basis,
    }))
  }

  if (steps.length < 3 && actionable[1]) {
    const next = allocationStep(route, actionable[1], steps.length)
    if (next && !steps.some(step => step.intentKey === next.intentKey)) steps.push(next)
  }
  return steps.slice(0, 3).map((step, index) => ({ ...step, chapterOrder: index + 1 }))
}

export function formatMoneyRouteForAdvisor(route) {
  if (!route) return ''
  const lines = route.allocations.map(item => (
    `- ${item.amount > 0 ? `${money(item.amount)}/month: ` : ''}${item.label} (${item.reason})`
  ))
  const blockers = route.blockers.map(item => `- ${item.title}: ${item.detail}`)
  return [
    'AUTHORITATIVE MONEY ROUTE — RULES CALCULATED, NOT MODEL GENERATED',
    `Chapter: ${route.chapter}`,
    `Money left to assign: ${money(route.availableMonthlyAmount)}/month`,
    `Status: ${route.provisional ? 'provisional because a material fact is missing' : 'based on complete recorded inputs'}`,
    'Current route:', ...lines,
    ...(route.nextDestination ? [`After the current priority: ${route.nextDestination}`] : []),
    ...(blockers.length ? ['Missing facts that may refine the route:', ...blockers] : []),
    'Never contradict this route or invent a different allocation. Explain it in plain language. If structured facts change, say the route must be recalculated.',
  ].join('\n')
}
