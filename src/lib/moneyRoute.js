import { LIMITS, THRESHOLDS, payoffMonths } from './finance.js'
import { accountFamily, isWorkplaceAccount } from './moneyModel.js'
import { PLAN_MAX, PLAN_MIN, composePlan, eligibleBackfill } from './planComposition.js'

// Accounts with a shared annual contribution ceiling. A taxable brokerage has
// none, which is what makes it the right home for anything above the cap.
const IRA_SUBTYPES = ['roth_ira', 'traditional_ira']
// Cash that is meant to sit still, as opposed to the account you spend from.
const SAVINGS_SUBTYPES = ['standard_savings', 'savings', 'hysa', 'money_market', 'emergency']

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
// Only rungs that fill a fixed amount can be dated. Raising a contribution
// percentage or "start investing" has no finish line, and guessing one would be
// worse than staying quiet.
const FINITE_FILL = key => key === 'starter_emergency' || key === 'full_emergency'
  || key.startsWith('debt.') || key.startsWith('goal.')

/**
 * Puts months on the ladder. An ordered list answers "what first"; a 20-year-old
 * also needs "and when" — "pay off the card" only becomes a plan once it reads
 * "about 2 months from now".
 *
 * Savings rungs divide: money in is money there. Debt does not — interest eats
 * part of every payment, so those amortize instead (see payoffMonths). The
 * payment used is the money this plan sends plus the recorded minimum, because
 * that is what actually lands on the balance each month.
 *
 * A rung whose length cannot be known — including a balance whose interest
 * outruns the payment — stops the chain rather than letting a guess propagate
 * into every later start date.
 */
function rungMonths(item, monthlyAmount, target) {
  if (!(monthlyAmount > 0) || !(target > 0)) return null
  if (!item.key.startsWith('debt.')) return Math.max(1, Math.ceil(target / monthlyAmount))
  const months = payoffMonths(target, num(item.apr), monthlyAmount + num(item.minimumPayment))
  return months == null ? null : Math.max(1, months)
}

function scheduleRungs({ allocations, upcoming, availableMonthlyAmount }) {
  let offset = 0
  let chainIntact = true

  for (const item of allocations) {
    if (!(num(item.amount) > 0) || !FINITE_FILL(item.key)) continue
    const months = rungMonths(item, num(item.amount), num(item.maxAmount))
    if (months == null) continue
    item.etaMonths = months
    offset += months
  }

  for (const item of upcoming) {
    item.startsInMonths = chainIntact && offset > 0 ? offset : null
    const months = chainIntact && FINITE_FILL(item.key)
      ? rungMonths(item, availableMonthlyAmount, num(item.target))
      : null
    if (months == null) {
      chainIntact = false
    } else {
      item.etaMonths = months
      offset += months
    }
  }
}

function upcomingPriorities({ snapshot, goals, allocations }) {
  const fundedKeys = new Set(allocations.filter(item => item.amount > 0).map(item => item.key))
  const activeDebts = (snapshot.debts || []).filter(debt => num(debt.balance) > 0
    && known(debt.interest_rate) && num(debt.interest_rate) > THRESHOLDS.highApr)
  const upcoming = []

  // Debts that exist but are not the one being paid down this month.
  for (const debt of activeDebts) {
    const key = `debt.${debt.id || debt.name}`
    if (fundedKeys.has(key)) continue
    // Why this debt is waiting depends on what took the money. Saying "once
    // the higher-rate balance is clear" when there is no other debt sends the
    // reader hunting for a balance that does not exist.
    const anotherDebtFunded = [...fundedKeys].some(funded => funded.startsWith('debt.'))
    upcoming.push({
      key, label: `Pay off ${debt.name}`,
      target: num(debt.balance),
      apr: num(debt.interest_rate), minimumPayment: num(debt.minimum_payment),
      reason: anotherDebtFunded
        ? `At ${num(debt.interest_rate)}%, next in line after the pricier balance above.`
        : `At ${num(debt.interest_rate)}%, this is the most expensive money you owe — it is next once the cushion above is set.`,
    })
  }

  const efTargetAmount = num(snapshot.efTargetAmount)
  const reserveShort = efTargetAmount > 0 && num(snapshot.liquid) < efTargetAmount
  if (reserveShort && !fundedKeys.has('full_emergency')) {
    upcoming.push({
      key: 'full_emergency',
      label: `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`,
      target: Math.max(0, efTargetAmount - num(snapshot.liquid)),
      reason: `Builds up to ${money(efTargetAmount)} — enough to cover you if income stops.`,
    })
  }

  const goal = activeGoals(goals)[0]
  const age = num(snapshot.profile?.age)
  const alreadyInvesting = (snapshot.investmentAccounts || []).length > 0
  // Investing already has this month's money, so listing it as what comes
  // "then" would repeat a rung the user can see funded directly above.
  const investingFunded = [...fundedKeys].some(key => key === 'open_investment_account'
    || key === 'open_taxable_brokerage' || key.startsWith('investment.'))
  if (goal && !fundedKeys.has(`goal.${goal.id || goal.name}`)) {
    upcoming.push({
      key: `goal.${goal.id || goal.name}`, label: `Fund ${goal.name}`, destinationName: goal.name,
      target: Math.max(0, num(goal.target_amount) - num(goal.current_amount)),
      reason: 'Your closest goal, once your cushion and expensive debt are handled.',
    })
    // A goal that is fully funded this month used to end the list there, so the
    // plan simply stopped — no sense of what the money does once the trip is
    // paid for. Investing is what the same ladder reaches next.
  } else if (!investingFunded) {
    // "Start investing" is vague, and vaguest exactly where it matters most.
    // Someone in their twenties has the one advantage nobody can buy later —
    // time — so name the account and say what it is worth.
    upcoming.push({
      key: 'invest_long_term',
      label: alreadyInvesting ? 'Put more into investing' : 'Open a Roth IRA and start investing',
      reason: !alreadyInvesting && age > 0 && age < 40
        ? `Money you invest at ${age} has decades to grow, and a Roth IRA lets it grow tax-free. You can put in up to ${money(LIMITS.rothIra)} a year.`
        : 'Your cushion and expensive debt are handled, so this money can start growing long term.',
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
  } else if (availableMonthlyAmount <= 0) {
    // Income and spending land exactly level. There is no deficit to repair, so
    // no rung above fires and the plan used to come out completely empty — a
    // blank screen for someone who is arguably in the most need of a first
    // move. Breaking even is a real position, and it has a real next step.
    allocations.push({
      key: 'find_margin', label: 'Free up your first $50 a month',
      amount: 0, targetAmount: 50, destinationType: 'monthly_plan', destinationId: null,
      reason: 'Everything you earn is already spoken for, so there is nothing to route yet. One recurring cost is usually enough — a subscription, a plan tier, one delivery a week — and $50 starts the cushion that keeps a surprise off a credit card.',
      confidence: 'verified', adjustable: false,
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
        key: 'starter_emergency', label: `Save your first ${money(THRESHOLDS.starterEmergency)}`, destinationName: 'your emergency fund',
        maxAmount: starterGap, destinationType: 'account', destinationId: emergency?.id || null,
        sourceAccountId: source?.id || null,
        // Someone with $570 banked is 57% of the way up this rung and the card
        // never said so — it read as a $1,000 hill starting from zero, which is
        // both discouraging and the reason the figure never reconciled with
        // Home's emergency-fund meter.
        reason: num(snapshot.liquid) > 0
          ? `You have ${money(snapshot.liquid)} of ${money(THRESHOLDS.starterEmergency)} — ${money(starterGap)} to go. A small cash cushion keeps a surprise bill from turning into new debt.`
          : 'A small cash cushion keeps a surprise bill from turning into new debt.',
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
        key: `debt.${debt.id || debt.name}`, label: `Pay extra toward ${debt.name}`, destinationName: debt.name,
        maxAmount: num(debt.balance), destinationType: 'debt', destinationId: debt.id || null,
        // Carried so the schedule can amortize rather than divide (see scheduleRungs).
        apr: num(debt.interest_rate), minimumPayment: num(debt.minimum_payment),
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
        key: 'full_emergency', label: `Grow emergency savings to ${snapshot.efTargetMonths || 3} months`, destinationName: 'your emergency fund',
        maxAmount: fullReserveGap, destinationType: 'account', destinationId: emergency?.id || null,
        sourceAccountId: source?.id || null,
        reason: `Enough cash to cover ${snapshot.efTargetMonths || 3} months of your spending — ${money(snapshot.efTargetAmount)}.`,
      }, remaining)
    }

    if (remaining > 0) {
      const goal = activeGoals(goals)[0]
      const investmentAccounts = accounts.filter(account => accountFamily(account) === 'investment')
      const investment = investmentAccounts.find(account => IRA_SUBTYPES.includes(account.subtype))
        || investmentAccounts[0] || null
      if (goal) {
        remaining = addAllocation(allocations, {
          key: `goal.${goal.id || goal.name}`, label: `Fund ${goal.name}`, destinationName: goal.name,
          maxAmount: Math.max(0, num(goal.target_amount) - num(goal.current_amount)),
          destinationType: 'goal', destinationId: goal.id || null,
          reason: 'Your cushion and expensive debt are handled, so your closest goal is next.',
        }, remaining)
      } else if (investment) {
        // An IRA has an annual ceiling. Routing the whole surplus into one
        // would have told a $2,000/mo saver to contribute $24,000 a year to an
        // account that legally takes $7,500 — so cap it and let the rest
        // overflow to a taxable account, which has no limit.
        const iraCap = IRA_SUBTYPES.includes(investment.subtype) ? Math.floor(LIMITS.rothIra / 12) : null
        remaining = addAllocation(allocations, {
          key: `investment.${investment.id || investment.name}`, label: `Increase investing in ${investment.name}`, destinationName: investment.name,
          ...(iraCap == null ? {} : { maxAmount: iraCap }),
          destinationType: 'account', destinationId: investment.id || null,
          reason: iraCap == null
            ? 'The essentials are handled, so this money can start growing long term.'
            : `The essentials are handled. ${money(LIMITS.rothIra)} a year is the most an IRA can take, which is ${money(iraCap)} a month.`,
        }, remaining)

        if (remaining > 0) {
          const taxable = accounts.find(account => accountFamily(account) === 'investment'
            && !IRA_SUBTYPES.includes(account.subtype) && account.id !== investment.id)
          remaining = taxable
            ? addAllocation(allocations, {
              key: `investment.${taxable.id || taxable.name}`, label: `Increase investing in ${taxable.name}`, destinationName: taxable.name,
              destinationType: 'account', destinationId: taxable.id || null,
              reason: 'This is above the IRA limit, so it goes to your account with no cap.',
            }, remaining)
            : addAllocation(allocations, {
              key: 'open_taxable_brokerage', label: 'Open a brokerage account for the rest',
              openLabel: 'Open a brokerage account', destinationName: 'your brokerage account',
              destinationType: 'account_opening', destinationId: null,
              reason: 'This is more than an IRA can take in a year. A regular brokerage account has no limit.',
            }, remaining)
        }
      } else {
        // No investment account on file. This used to push a $0 note and let
        // every spare dollar fall through to "unassigned", so someone with a
        // real surplus got a one-line plan that never said where the money
        // goes. Not having opened the account yet does not make the
        // destination unknown — it is the first rung, and it has an amount.
        const rothMonthly = Math.floor(LIMITS.rothIra / 12)
        remaining = addAllocation(allocations, {
          key: 'open_investment_account', label: 'Open a Roth IRA and start investing',
          openLabel: 'Open a Roth IRA', destinationName: 'your Roth IRA', maxAmount: rothMonthly,
          destinationType: 'account_opening', destinationId: null,
          reason: `A Roth IRA grows tax-free, and ${money(LIMITS.rothIra)} a year is the most you can put in — ${money(rothMonthly)} a month fills it.`,
        }, remaining)

        // Above the IRA ceiling the money still needs somewhere to be, and a
        // taxable brokerage has no cap.
        if (remaining > 0) {
          remaining = addAllocation(allocations, {
            key: 'open_taxable_brokerage', label: 'Open a brokerage account for the rest',
            openLabel: 'Open a brokerage account', destinationName: 'your brokerage account',
            destinationType: 'account_opening', destinationId: null,
            reason: `This is more than a Roth IRA can take in a year. A regular brokerage account has no limit.`,
          }, remaining)
        }
      }

      // Nothing named to save for used to add a rung here telling the user to
      // go and name one. A plan is a list of things to do with money, not a
      // list of fields to fill in — the interview asks what is coming instead,
      // and a real goal earns a rung the normal way once it exists.
    }
    // ── Setup that makes the moves above actually happen ────────────────────
    //
    // One priority usually absorbs the whole surplus, which left the plan at a
    // single move plus its automation — two lines, for a month of someone's
    // money. These are the rest of the job: not padding, and not future rungs,
    // but the work that decides whether the transfer above survives contact
    // with real life. Each is gated on something true of this user's accounts,
    // so nobody is told to open a savings account they already have.
    const cashAccounts = accounts.filter(account => accountFamily(account) === 'cash')
    const savingsAccounts = cashAccounts.filter(account => account.id !== source?.id
      && SAVINGS_SUBTYPES.includes(String(account.subtype || '').toLowerCase()))

    // A cushion living in the account you spend from is a cushion you will
    // spend. This is the most common reason a starter fund never gets built.
    if (cashAccounts.length && !savingsAccounts.length) {
      allocations.push({
        key: 'separate_cushion_account', label: 'Open a savings account to keep your cushion in',
        amount: 0, destinationType: 'account_opening', destinationId: null,
        reason: 'Right now the money above would land in the account you spend from, where it quietly disappears. A separate account is the difference between saving and meaning to.',
        adjustable: false,
      })
    } else {
      // Held somewhere that pays nothing, on purpose, for years.
      const idle = savingsAccounts.find(account => String(account.subtype).toLowerCase() === 'standard_savings')
      if (idle && num(idle.balance) + availableMonthlyAmount >= THRESHOLDS.starterEmergency) {
        allocations.push({
          key: 'upgrade_savings_rate', label: `Move ${idle.name} to a high-yield savings account`,
          amount: 0, destinationType: 'account', destinationId: idle.id || null,
          reason: 'A standard savings account pays close to nothing while a high-yield one pays real interest on the same balance, with the same access and the same protection. It is the only step here that costs you nothing at all.',
          adjustable: false,
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

  // Outside the branch chain on purpose. A missed minimum costs more in one
  // late fee and credit-score damage than this plan earns in months, and the
  // people most at risk of missing one are exactly those on the paths above —
  // spending more than they earn, or breaking even with nothing spare.
  if (activeDebts.length) {
    allocations.push({
      key: 'autopay_minimums', label: 'Put every minimum payment on autopay',
      amount: 0, destinationType: 'debt', destinationId: null,
      reason: `One missed payment on ${activeDebts.length === 1 ? activeDebts[0].name : 'any of these'} costs more in fees and credit damage than this plan earns in months. Autopay the minimums, then let the plan handle everything on top.`,
      adjustable: false,
    })
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

  // A debt with no rate on file is ranked by nothing, so it lands in neither
  // the ladder nor the low-rate note above — it simply disappears. Silence
  // about a balance the user typed in is the worst of both: it looks like the
  // plan lost it, and they never learn the one fact that would place it.
  const unratedDebts = activeDebts.filter(debt => !known(debt.interest_rate))
  if (unratedDebts.length) {
    const names = unratedDebts.map(debt => debt.name).join(' and ')
    const one = unratedDebts.length === 1
    notes.push(`${names} ${one ? 'has' : 'have'} no interest rate on file, so ${one ? 'it is' : 'they are'} not ranked here yet. Keep paying the minimum, and add the rate — it decides whether ${one ? 'it belongs' : 'they belong'} above or below everything on this list.`)
  }

  const upcoming = upcomingPriorities({ snapshot, goals, allocations: finalAllocations })
  scheduleRungs({ allocations: finalAllocations, upcoming, availableMonthlyAmount })

  return {
    availableMonthlyAmount,
    reservedAmount,
    reconciliation,
    allocations: finalAllocations,
    upcoming,
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
    // The few facts the practice bank needs to know whether a general habit
    // already applies — carried on the route so building a plan never needs a
    // second read of the user's records.
    planContext: {
      expenses: roundMoney(snapshot.expenses),
      debts: activeDebts.map(debt => ({ balance: num(debt.balance) })),
    },
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
      doneWhen: 'Your monthly spending no longer exceeds what you bring in.',
      intentKey: allocation.key === 'repair_budget' ? 'budget.close_deficit.total' : 'budget.fix_allocations.total',
      priorityKey: allocation.key === 'repair_budget' ? 'deficit' : 'overcommitted',
      impact: `Repairs a ${money(target)}/mo gap`, basis,
    })
  }
  if (allocation.key === 'find_margin') {
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: `You have cancelled or cut enough to leave ${money(allocation.targetAmount)} spare each month.`,
      intentKey: 'budget.find_first_margin', priorityKey: 'deficit',
      impact: `Turns a break-even month into ${money(allocation.targetAmount)} you can direct`, basis,
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
      doneWhen: 'You have an answer from HR or your benefits portal.',
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
  if (allocation.key === 'open_investment_account' || allocation.key === 'open_taxable_brokerage') {
    // The amount belongs in the step text: "open an account" is a chore,
    // "open one and put $625 a month in" is the actual move.
    const monthly = amount > 0 ? ` and set up ${money(amount)}/mo` : ''
    return stepBase(route, index, {
      key: allocation.key, text: `${allocation.openLabel || allocation.label}${monthly}`, detail: allocation.reason,
      doneWhen: `The account is open at the provider${amount > 0 ? ` and ${money(amount)}/mo is scheduled into it` : ''}.`,
      intentKey: allocation.key === 'open_investment_account' ? 'open.investment_account' : 'open.taxable_brokerage',
      priorityKey: 'roth',
      outcome: { kind: 'account_opening', amount: amount || null },
      basis,
    })
  }
  if (allocation.key === 'separate_cushion_account') {
    return stepBase(route, index, {
      key: allocation.key, text: 'Open a savings account for your cushion', detail: allocation.reason,
      doneWhen: 'The savings account is open at your bank, separate from the one you spend from.',
      intentKey: 'open.cushion_savings', priorityKey: 'starter_ef',
      impact: 'Keeps the money above out of your spending account',
      outcome: { kind: 'account_opening', accountSubtypeHint: 'hysa' }, basis,
    })
  }
  if (allocation.key === 'upgrade_savings_rate') {
    return stepBase(route, index, {
      key: allocation.key, text: allocation.label, detail: allocation.reason,
      doneWhen: 'The balance has been transferred and is earning the higher rate.',
      intentKey: `move.savings_to_hysa.${allocation.destinationId || 'primary'}`, priorityKey: 'build_ef',
      impact: 'Earns real interest on money you were already saving',
      outcome: { kind: 'account_opening', accountSubtypeHint: 'hysa' }, basis,
    })
  }
  if (allocation.key === 'autopay_minimums') {
    return stepBase(route, index, {
      key: allocation.key, text: 'Put every debt minimum on autopay', detail: allocation.reason,
      doneWhen: 'Every debt has autopay set to at least the minimum.',
      intentKey: 'setup.autopay_minimums', priorityKey: 'kill_debt',
      impact: 'Protects the plan from a single missed payment',
      outcome: { kind: 'recurring_setup', recurrence: 'monthly' }, basis,
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
    // A step reads "Move $250/mo toward your emergency fund", so it needs a
    // destination NOUN. Card labels are sentences ("Save your first $1,000"),
    // which cannot be spliced in after "toward" — hence destinationName.
    text: `${isDebt ? 'Pay' : 'Move'} ${money(amount)}/mo ${isDebt ? 'to' : 'toward'} ${allocation.destinationName || allocation.label.replace(/^Pay extra toward |^Build the |^Grow |^Fund |^Increase investing in /, '')}`,
    detail: allocation.reason,
    doneWhen: `${money(amount)} has actually ${isDebt ? 'been paid' : 'moved'}.`,
    // Says what the money DOES, in the words the user would use. "Directs
    // $250/mo to the highest verified debt cost" describes the algorithm.
    impact: isDebt
      ? `Cuts the balance charging you the most interest`
      : `Builds ${allocation.destinationName || 'this'} by ${money(amount)} every month`,
    intentKey, completionPolicy: 'repeatable',
    priorityKey: isDebt ? 'kill_debt' : isGoal ? 'goal' : isReserve ? (allocation.key === 'starter_emergency' ? 'starter_ef' : 'build_ef') : 'invest',
    outcome, basis,
  })
}

// Rungs that move no money this month but are still the work: opening the
// account, naming the goal, finding out whether there is a match. Without
// these the plan for someone with a surplus and no accounts is a blank page.
const ZERO_DOLLAR_STEPS = [
  'repair_budget', 'repair_allocations', 'find_margin', 'choose_health_coverage',
  'capture_employer_match', 'confirm_employer_match',
  'open_investment_account', 'open_taxable_brokerage',
  'separate_cushion_account', 'upgrade_savings_rate', 'autopay_minimums',
]

/**
 * How long a rung takes, in words a person pictures.
 *
 * Past two years "about 37 months" stops meaning anything, and a thin surplus
 * pushes late rungs into the hundreds — a $5/mo saver reaches investing in
 * 1,920 months, which is true, useless, and faintly insulting.
 */
export function formatDuration(months) {
  const value = Math.round(num(months))
  if (!(value > 0)) return null
  if (value === 1) return 'about a month'
  if (value < 24) return `about ${value} months`
  if (value > HORIZON_MONTHS) return 'over 10 years'
  return `about ${Math.round(value / 12)} years`
}

/** Beyond this, a *start* date stops being information and becomes discouragement. */
export const HORIZON_MONTHS = 120

const PLAN_SIZE = PLAN_MAX

/**
 * Money moves lead the plan. Steps with no dollar amount — claim your employer
 * match, open an account — are real work and stay in the plan, but a plan that
 * opens with "go find something out" is less actionable than one that opens
 * with "move $800". The allocation array keeps its ladder order for the
 * arithmetic; this is presentation only.
 */
export function orderForPresentation(allocations = []) {
  const funded = allocations.filter(item => num(item.amount) > 0)
  const unfunded = allocations.filter(item => !(num(item.amount) > 0))
  return [...funded, ...unfunded]
}

/**
 * Turn the calculated waterfall into a real plan: one step per funded
 * priority, plus an automation step for the largest recurring move. Earlier
 * versions returned a single allocation, which read as one suggestion rather
 * than a plan.
 */
export function buildInitialPlan(route) {
  if (!route) return []
  const actionable = orderForPresentation((route.allocations || []).filter(item => (
    !['unassigned', 'hold_for_coverage'].includes(item.key)
    && (item.amount > 0 || ZERO_DOLLAR_STEPS.includes(item.key))
  )))

  // Every rung the ladder produced, uncapped. Trimming here is what used to
  // hide the general-practice steps behind whichever priority happened to
  // absorb the money; composePlan does the choosing now, with the whole pool
  // in front of it.
  const pool = []
  for (const allocation of actionable) {
    const step = allocationStep(route, allocation, pool.length)
    if (step && !pool.some(existing => existing.intentKey === step.intentKey)) pool.push(step)
  }

  // Automating the biggest recurring transfer is what keeps the plan running
  // without relying on memory, so it earns a place once the priorities are in.
  // `find` took whichever came first, which meant a $2,000 plan automated its
  // $625 rung and left $1,375 to be remembered by hand every month.
  const primary = pool
    .filter(step => step.outcome?.amount > 0
      && ['transfer', 'contribution', 'debt_payment'].includes(step.outcome.kind))
    .sort((left, right) => right.outcome.amount - left.outcome.amount)[0]
  if (primary) {
    const target = actionable.find(item => allocationStep(route, item, 0)?.intentKey === primary.intentKey)
    // Appended, this landed after the setup chores — "move $250", "autopay your
    // minimums", "schedule $250" — separating the transfer from its own
    // automation. It belongs immediately after the move it automates.
    const afterPrimary = pool.findIndex(step => step.intentKey === primary.intentKey) + 1
    pool.splice(afterPrimary, 0, stepBase(route, afterPrimary, {
      key: `automate.${target?.key || 'primary'}`,
      text: `Schedule ${money(primary.outcome.amount)} monthly toward ${target?.destinationName || (target?.label || 'this priority').replace(/^Pay extra toward |^Fund |^Build the |^Grow |^Increase investing in /, '')}`,
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

  const taken = new Set(pool.map(step => step.intentKey))
  const backfill = eligibleBackfill(route.planContext, taken)
    .map((entry, index) => stepBase(route, pool.length + index, {
      key: entry.key,
      text: entry.text,
      detail: entry.detail,
      doneWhen: entry.doneWhen,
      impact: entry.impact,
      intentKey: entry.intentKey,
      priorityKey: entry.priorityKey,
      outcome: { kind: 'information_only' },
      basis: { recordType: 'habit', recordId: null, monthlyCapacity: route.availableMonthlyAmount },
    }))

  const { steps } = composePlan(pool, { backfill, min: PLAN_MIN, max: PLAN_SIZE })
  return steps.map((step, index) => ({ ...step, chapterOrder: index + 1 }))
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
