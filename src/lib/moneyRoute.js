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

// Everything the plan needs before it is worth showing at all. A plan built on
// half the picture is worse than no plan: it confidently routes money past
// whatever it was never told about. Onboarding now collects all of this, so a
// finished user should never see this list — it exists for people who skipped
// a step or cleared a record later.
function missingPlanInputs({ snapshot, profile, accounts, debts }) {
  const missing = []
  if (!(num(snapshot.income) > 0)) {
    missing.push({ id: 'income', label: 'Your monthly take-home income', sheet: 'plan' })
  }
  if (!(num(snapshot.expenses) > 0)) {
    missing.push({ id: 'expenses', label: 'Your typical monthly spending', sheet: 'plan' })
  }
  if (!accounts.length) {
    missing.push({ id: 'balances', label: "What's in checking and savings", sheet: 'cash' })
  }
  if (!profile?.health_insurance) {
    missing.push({ id: 'coverage', label: 'Whether you have health coverage', sheet: 'plan' })
  }
  // onboarding_complete is the signal that the debt question was actually
  // asked — it lets the plan tell "no debt" apart from "never entered"
  // without inventing a column for it.
  if (!debts.length && !profile?.onboarding_complete) {
    missing.push({ id: 'debts', label: 'Whether you carry any debt', sheet: 'debts' })
  }
  if (!profile?.employer_401k) {
    missing.push({ id: 'retirement', label: 'Whether your employer offers a retirement plan', sheet: 'investment' })
  }
  return missing
}

// What comes after this month's money is spoken for. When one priority
// absorbs the whole surplus — a 24% card usually does — the allocation list is
// a single line, which reads as one suggestion rather than a plan. These are
// the stages the same ladder reaches next, so the user can see the sequence
// they are actually signing up for.
function upcomingPriorities({ snapshot, goals, allocations }) {
  const fundedKeys = new Set(allocations.filter(item => item.amount > 0).map(item => item.key))
  const activeDebts = (snapshot.debts || []).filter(debt => num(debt.balance) > 0
    && known(debt.interest_rate) && num(debt.interest_rate) > THRESHOLDS.highApr)
  const upcoming = []

  // Debts that exist but are not the one being paid down this month.
  for (const debt of activeDebts) {
    const key = `debt.${debt.id || debt.name}`
    if (fundedKeys.has(key)) continue
    upcoming.push({
      key, label: `Pay off ${debt.name}`,
      reason: `${num(debt.interest_rate)}% APR — next once the higher-rate balance is clear.`,
    })
  }

  const efTargetAmount = num(snapshot.efTargetAmount)
  const reserveShort = efTargetAmount > 0 && num(snapshot.liquid) < efTargetAmount
  if (reserveShort && !fundedKeys.has('full_emergency')) {
    upcoming.push({
      key: 'full_emergency',
      label: `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`,
      reason: `Gets you to ${money(efTargetAmount)} in cash once the expensive debt is gone.`,
    })
  }

  const goal = activeGoals(goals)[0]
  if (goal && !fundedKeys.has(`goal.${goal.id || goal.name}`)) {
    upcoming.push({
      key: `goal.${goal.id || goal.name}`, label: `Fund ${goal.name}`,
      reason: 'Your nearest active goal, once protection and debt are handled.',
    })
  } else if (!goal) {
    upcoming.push({
      key: 'invest_long_term', label: 'Start investing the freed-up money',
      reason: 'With protection and debt handled, this money can work long term.',
    })
  }

  return upcoming
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
  // marginAmount is the SAME figure Home's "Left over monthly" tile shows
  // (moneyLanguage.js reads snapshot.cashFlowMargin directly) — every step
  // subtracted below is reported on the route so the UI can show its own
  // total as a visible reconciliation of that number, never a second,
  // unexplained figure sitting next to it.
  const marginAmount = num(snapshot.cashFlowMargin)
  const alreadyAllocatedAmount = detailedFlow ? Math.max(0, roundMoney(snapshot.futureAllocations)) : 0
  const rawAvailable = marginAmount - alreadyAllocatedAmount
  const debtMinimums = num(snapshot.requiredDebtPayments)
  const recordedDebtPayments = num(snapshot.budgetStatus?.byCategory?.debt_payments)
  const unrecordedDebtMinimums = detailedFlow ? Math.max(0, debtMinimums - recordedDebtPayments) : 0
  const reservedAmount = Math.max(0, roundMoney(unrecordedDebtMinimums))
  const availableMonthlyAmount = Math.max(0, Math.round(rawAvailable - unrecordedDebtMinimums))
  const reconciliation = [
    { label: 'Left over monthly', amount: roundMoney(marginAmount) },
    ...(alreadyAllocatedAmount > 0 ? [{ label: 'Already assigned elsewhere', amount: -alreadyAllocatedAmount }] : []),
    ...(reservedAmount > 0 ? [{ label: 'Reserved for required payments not yet in your Monthly Plan', amount: -reservedAmount }] : []),
  ]
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

  // A match is the highest-return money available — better than paying off
  // even a 26% card. Not knowing the exact percentage is no reason to demote
  // it to a footnote: "go find out and claim it" is itself the right next
  // action, so it becomes a real step in the plan (added at the match rung of
  // the ladder below) rather than optional fine print.
  if (matchUnknown) {
    conditionalChanges.push({
      key: 'employer_match_unknown',
      title: 'One fact could improve this plan',
      detail: 'If a match exists, put in just enough to claim all of it. The rest of the plan stays the same.',
    })
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
        reason: 'A small cash cushion keeps a surprise bill from turning into new debt.',
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
    } else if (matchExpected && matchDetailsMissing) {
      // They told us a match exists. Claiming it beats every other use of a
      // dollar here, so it leads the plan even before we know the percentage.
      allocations.push({
        key: 'capture_employer_match', label: 'Claim your full employer match',
        amount: 0, destinationType: 'account', destinationId: workplace?.id || null,
        reason: 'You said your employer matches contributions. Check a pay stub or your benefits page for the match rate, then put in at least that much — no other dollar here earns as fast.',
        adjustable: false,
      })
    } else if (matchUnknown) {
      allocations.push({
        key: 'confirm_employer_match', label: 'Find out if your employer matches',
        amount: 0, destinationType: 'profile', destinationId: null,
        reason: 'If there is a match, it beats everything else on this list. One message to HR or a look at your benefits page settles it.',
        adjustable: false,
      })
    }

    const highInterest = activeDebts.filter(debt => known(debt.interest_rate) && num(debt.interest_rate) > THRESHOLDS.highApr)
      .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))
    for (const debt of highInterest) {
      if (remaining <= 0) break
      // When this debt is the very first thing allocated, say so explicitly
      // if the starter reserve is already covered — otherwise directing the
      // full monthly amount at one debt can read as reckless rather than as
      // the deliberate, math-backed move it is.
      const isFirstMove = allocations.length === 0
      const reserveCovered = starterGap === 0 && num(snapshot.liquid) > 0
      remaining = addAllocation(allocations, {
        key: `debt.${debt.id || debt.name}`, label: `Pay extra toward ${debt.name}`,
        maxAmount: num(debt.balance), destinationType: 'debt', destinationId: debt.id || null,
        sourceAccountId: source?.id || null,
        reason: isFirstMove && reserveCovered
          ? `You already have ${money(THRESHOLDS.starterEmergency)} set aside for emergencies, so at ${num(debt.interest_rate)}% this is the most expensive money you owe.`
          : `At ${num(debt.interest_rate)}%, this is the most expensive debt you carry.`,
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
        reason: `Enough cash to cover ${snapshot.efTargetMonths || 3} months of your spending — ${money(snapshot.efTargetAmount)}.`,
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
          reason: 'Your cushion and expensive debt are handled, so your closest goal is next.',
        }, remaining)
      } else if (investment) {
        remaining = addAllocation(allocations, {
          key: `investment.${investment.id || investment.name}`, label: `Increase investing in ${investment.name}`,
          destinationType: 'account', destinationId: investment.id || null,
          reason: 'The essentials are handled, so this money can start growing long term.',
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
        reason: 'Not assigned yet — it stays available until you choose where it goes.', adjustable: false,
      }, remaining)
    }
  }

  const finalAllocations = applyAdjustments(allocations, availableMonthlyAmount, adjustments)
  const fingerprint = adjustments
    ? `${baseFingerprint}-${hashState(JSON.stringify(adjustments))}`
    : baseFingerprint
  // The plan is either ready or it is not. There is no half-confident middle
  // state to explain to the user: if something required is missing the app
  // asks for it, and once everything is in the recommendations stand on
  // their own without hedging language.
  const missingInputs = missingPlanInputs({ snapshot, profile, accounts, debts })
  const ready = missingInputs.length === 0

  // A debt the user typed in and then never sees again reads as lost data, so
  // say plainly that leaving it on minimums is the deliberate choice.
  const lowRateDebts = activeDebts.filter(debt => known(debt.interest_rate)
    && num(debt.interest_rate) <= THRESHOLDS.highApr)
  const notes = lowRateDebts.length
    ? [`${lowRateDebts.map(debt => debt.name).join(' and ')} ${lowRateDebts.length === 1 ? 'is' : 'are'} not in this plan on purpose — at ${lowRateDebts.map(debt => `${num(debt.interest_rate)}%`).join(' and ')}, paying ${lowRateDebts.length === 1 ? 'it' : 'them'} down early earns you less than the moves above. Keep paying the minimum.`]
    : []

  return {
    availableMonthlyAmount,
    reservedAmount,
    reconciliation,
    allocations: finalAllocations,
    upcoming: upcomingPriorities({ snapshot, goals, allocations: finalAllocations }),
    notes,
    alreadyCommitted,
    missingInputs,
    ready,
    // Refinements are optional details that sharpen an already-valid plan —
    // never a reason to withhold or hedge it.
    refinements: blockers,
    conditionalChanges,
    primaryQuestion: blockers.find(blocker => blocker.question)?.question || null,
    nextDestination: nextDestinationFor(finalAllocations, snapshot, goals),
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
    chapterId: 'recommended-plan',
    chapterOrder: index + 1,
    generatedForFingerprint: route.fingerprint,
    guideFingerprint: route.fingerprint,
    source: 'money-route',
    proposed: true,
  }
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
  if (allocation.key === 'confirm_employer_match') {
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: 'You know whether your employer matches, and it is saved here.',
      intentKey: 'verify.employer_match', priorityKey: 'capture_match',
      outcome: { kind: 'information_only' },
      basis: { recordType: 'profile', recordId: null },
    })
  }
  if (allocation.key === 'capture_employer_match') {
    const percent = allocation.label.match(/to ([\d.]+)%/)?.[1]
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: percent
        ? `The workplace account contribution setting shows ${percent}%.`
        : 'Your contribution is at least the percentage your employer matches.',
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

const PLAN_SIZE = 5

/**
 * Turn the calculated waterfall into a real plan: one step per funded
 * priority, plus an automation step for the largest recurring move. Earlier
 * versions returned a single allocation, which read as one suggestion rather
 * than a plan.
 */
export function buildInitialPlan(route) {
  if (!route) return []
  const steps = []
  const actionable = (route.allocations || []).filter(item => (
    !['unassigned', 'hold_for_coverage'].includes(item.key)
    && (item.amount > 0 || ['repair_budget', 'repair_allocations', 'choose_health_coverage', 'capture_employer_match', 'confirm_employer_match', 'open_investment_account'].includes(item.key))
  ))

  for (const allocation of actionable) {
    if (steps.length >= PLAN_SIZE) break
    const step = allocationStep(route, allocation, steps.length)
    if (step && !steps.some(existing => existing.intentKey === step.intentKey)) steps.push(step)
  }

  // Automating the biggest recurring transfer is what keeps the plan running
  // without relying on memory, so it earns a place once the priorities are in.
  const primary = steps.find(step => step.outcome?.amount > 0
    && ['transfer', 'contribution', 'debt_payment'].includes(step.outcome.kind))
  if (primary && steps.length < PLAN_SIZE) {
    const target = actionable.find(item => allocationStep(route, item, 0)?.intentKey === primary.intentKey)
    steps.push(stepBase(route, steps.length, {
      key: `automate.${target?.key || 'primary'}`,
      text: `Schedule ${money(primary.outcome.amount)} monthly toward ${(target?.label || 'this priority').replace(/^Pay extra toward |^Fund |^Build the |^Grow |^Increase investing in /, '')}`,
      detail: 'Automation keeps the plan moving without relying on memory.',
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

  return steps.slice(0, PLAN_SIZE).map((step, index) => ({ ...step, chapterOrder: index + 1 }))
}

export function formatMoneyRouteForAdvisor(route) {
  if (!route) return ''
  if (!route.ready) {
    return [
      'PLAN STATUS — NOT YET GENERATED',
      'The user has not finished setup, so no plan exists yet. Missing:',
      ...route.missingInputs.map(item => `- ${item.label}`),
      'Do not invent a plan or recommend allocations. Ask them to finish setup first.',
    ].join('\n')
  }
  const lines = route.allocations.map(item => (
    `- ${item.amount > 0 ? `${money(item.amount)}/month: ` : ''}${item.label} (${item.reason})`
  ))
  const refinements = (route.refinements || []).map(item => `- ${item.title}: ${item.detail}`)
  return [
    'AUTHORITATIVE PLAN — RULES CALCULATED, NOT MODEL GENERATED',
    `Money left to assign: ${money(route.availableMonthlyAmount)}/month`,
    'The plan:', ...lines,
    ...(route.nextDestination ? [`After these: ${route.nextDestination}`] : []),
    ...(refinements.length ? ['Optional details that would sharpen it:', ...refinements] : []),
    'Never contradict this plan or invent a different allocation. Explain it in plain language.',
    'Your job now is to REFINE it. Ask the questions a good financial planner would ask about',
    'what these numbers cannot show — job stability, upcoming large expenses, timelines, risk',
    'comfort, dependents, whether the emergency target fits their situation. One question at a',
    'time. Never re-ask anything already answered in the records above.',
  ].join('\n')
}
