import {
  accountFamily,
  cashFlowTotals,
  inferLiquidity,
  isWorkplaceAccount,
} from './moneyModel.js'

export const LIMITS = {
  year: 2026,
  rothIra: 7500,
  k401: 24500,
  rothPhaseOutSingle: [153000, 168000],
  rothPhaseOutMarried: [242000, 252000],
}

export const THRESHOLDS = {
  highApr: 7,
  crisisApr: 20,
  starterEmergency: 1000,
  autoTransferMin: 100,
  investReturn: 0.06,
}

export const LIQUID_TYPES = ['checking', 'savings', 'emergency', 'money_market']

const num = value => Number(value) || 0
const known = value => value !== null && value !== undefined && value !== ''

export function efTargetMonths(profile) {
  const type = profile?.employment_type
  return type === 'freelance' || type === 'other' ? 6 : 3
}

/**
 * One sentence explaining a negative net worth, or null.
 *
 * A 20-year-old with $570 saved and a normal student loan opens the app to
 * "−$9,830" in the largest type on the screen. The number is correct and it is
 * the wrong thing to lead with silently: it is not actionable, it is dominated
 * by one balance, and for a low-rate loan it reflects a decision the plan made
 * on purpose. Naming the cause turns a verdict into a fact.
 *
 * Deliberately does not hide or soften the figure — it explains it.
 */
export function netWorthExplanation({ netWorth, debts = [] } = {}) {
  if (!(num(netWorth) < 0)) return null
  const live = debts.filter(debt => num(debt.balance) > 0)
  if (!live.length) return null

  const total = live.reduce((sum, debt) => sum + num(debt.balance), 0)
  const largest = live.reduce((top, debt) => (num(debt.balance) > num(top.balance) ? debt : top))
  // Only speak up when one balance genuinely drives the number; "most of this"
  // has to be true or the sentence is worse than silence.
  if (!(num(largest.balance) / total >= 0.5)) return null

  const name = largest.name || 'your largest balance'
  const rate = known(largest.interest_rate) ? num(largest.interest_rate) : null
  if (rate !== null && rate <= THRESHOLDS.highApr) {
    return `Most of this is ${name} at ${rate}%. Your plan leaves it on minimum payments on purpose — your money earns more everywhere above it.`
  }
  if (rate !== null) {
    return `Most of this is ${name} at ${rate}%, which is exactly what your plan is aimed at.`
  }
  return `Most of this is ${name}. Add its interest rate and the plan can place it.`
}

/**
 * Months to clear one balance at a fixed monthly payment, with interest.
 *
 * Dividing the balance by the payment is wrong in the direction that flatters
 * the plan, and the error grows exactly where it hurts most: $5,000 at 22% paid
 * at $150/mo is 52 months, not the 34 that division promises. At $110/mo it is
 * 122 months, not 46. These are the balances this app exists to help with, so
 * the arithmetic has to be real.
 *
 * Returns null when the payment cannot outrun the interest — that balance never
 * clears, and inventing a number for it would be the worst answer available.
 */
export function payoffMonths(balance, apr, monthlyPayment) {
  let remaining = num(balance)
  const payment = num(monthlyPayment)
  const monthlyRate = num(apr) / 100 / 12
  if (remaining <= 0) return 0
  if (payment <= 0) return null
  if (monthlyRate > 0 && payment <= remaining * monthlyRate) return null

  let months = 0
  while (remaining > 0) {
    remaining = remaining * (1 + monthlyRate) - payment
    months++
    if (months > 600) return null
  }
  return months
}

// Compatibility forecast retained for existing callers and comparisons.
export function debtFreedom(debts, monthlyPayment) {
  const live = debts
    .map(debt => ({ balance: num(debt.balance), apr: num(debt.interest_rate) }))
    .filter(debt => debt.balance > 0)
  if (!live.length) return { months: 0, totalInterest: 0 }
  if (monthlyPayment <= 0) return { stuck: true }

  let months = 0
  let totalInterest = 0
  while (live.some(debt => debt.balance > 0)) {
    months++
    if (months > 600) return { stuck: true }
    let interestThisMonth = 0
    for (const debt of live) {
      const interest = debt.balance * (debt.apr / 100 / 12)
      debt.balance += interest
      interestThisMonth += interest
    }
    totalInterest += interestThisMonth
    if (monthlyPayment <= interestThisMonth && months === 1) return { stuck: true }
    let available = monthlyPayment
    live.sort((left, right) => right.apr - left.apr)
    for (const debt of live) {
      if (available <= 0) break
      const applied = Math.min(available, debt.balance)
      debt.balance -= applied
      available -= applied
    }
  }
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return {
    months,
    totalInterest: Math.round(totalInterest),
    debtFreeLabel: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  }
}

// Uses every minimum payment first, then rolls the planned payment pool toward
// the highest APR. It intentionally refuses to guess when a rate or minimum is
// missing, so the UI never presents a dishonest debt-free date.
export function debtFreedomWithMinimums(debts = []) {
  const active = debts.filter(debt => num(debt.balance) > 0)
  if (!active.length) return { months: 0, totalInterest: 0 }
  if (active.some(debt => !known(debt.interest_rate) || !known(debt.minimum_payment) || num(debt.minimum_payment) <= 0)) {
    return null
  }

  const live = active.map(debt => ({
    balance: num(debt.balance),
    apr: num(debt.interest_rate),
    minimum: num(debt.minimum_payment),
    planned: Math.max(num(debt.planned_payment), num(debt.minimum_payment)),
  }))
  const monthlyBudget = live.reduce((sum, debt) => sum + debt.planned, 0)
  let months = 0
  let totalInterest = 0

  while (live.some(debt => debt.balance > 0)) {
    months++
    if (months > 600) return { stuck: true }
    let interestThisMonth = 0
    for (const debt of live) {
      if (debt.balance <= 0) continue
      const interest = debt.balance * (debt.apr / 100 / 12)
      debt.balance += interest
      interestThisMonth += interest
    }
    totalInterest += interestThisMonth

    let remaining = monthlyBudget
    for (const debt of live) {
      if (debt.balance <= 0) continue
      const payment = Math.min(debt.minimum, debt.balance, remaining)
      debt.balance -= payment
      remaining -= payment
    }
    for (const debt of [...live].sort((left, right) => right.apr - left.apr)) {
      if (remaining <= 0) break
      const payment = Math.min(debt.balance, remaining)
      debt.balance -= payment
      remaining -= payment
    }
    if (months === 1 && monthlyBudget <= interestThisMonth) return { stuck: true }
  }

  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return {
    months,
    totalInterest: Math.round(totalInterest),
    debtFreeLabel: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  }
}

// The planning ladder is deterministic. Every surface can consume the full
// ordered list, while legacy callers keep using `nextDollar()` for the first
// applicable move. AI is deliberately not involved in this ranking.
export function financialPriorities(snapshot) {
  const priorities = []
  const add = priority => priorities.push(priority)

  if (snapshot.income > 0 && snapshot.cashFlowMargin < 0) {
    add({
      key: 'deficit', urgent: true, title: 'Close the monthly gap',
      why: `Your typical spending is $${Math.abs(Math.round(snapshot.cashFlowMargin)).toLocaleString()}/mo above income. Start there before assigning money elsewhere.`,
      amount: Math.abs(Math.round(snapshot.cashFlowMargin)),
    })
  } else if (snapshot.income > 0 && snapshot.unallocated < 0) {
    // This is intentionally mutually exclusive with a spending deficit: the
    // spending plan works, but future allocations exceed the remaining cash.
    add({
      key: 'overcommitted', urgent: true, title: 'Reduce planned allocations',
      why: `You have assigned $${Math.abs(Math.round(snapshot.unallocated)).toLocaleString()}/mo more than your cash-flow margin can support.`,
      amount: Math.abs(Math.round(snapshot.unallocated)),
    })
  }

  if (snapshot.profile?.health_insurance === 'none') {
    add({
      key: 'insurance', urgent: true, title: 'Get health insurance',
      why: 'One medical emergency without coverage can undo the progress you are building.',
    })
  }

  if (snapshot.expenses > 0 && snapshot.liquid < THRESHOLDS.starterEmergency) {
    add({
      key: 'starter_ef', urgent: false, title: `Build a $${THRESHOLDS.starterEmergency.toLocaleString()} starter reserve`,
      why: 'A small liquid buffer keeps everyday surprises from turning into debt.',
      amount: Math.max(0, THRESHOLDS.starterEmergency - Math.round(snapshot.liquid)),
    })
  }

  const missedMatch = (snapshot.accounts || []).find(account => {
    if (!isWorkplaceAccount(account) || num(account.employer_match_percent) <= 0) return false
    const matchLimit = num(account.employer_match_limit_percent)
    return matchLimit > 0 && num(account.contribution_percent) < matchLimit
  })
  if (missedMatch) {
    add({
      key: 'capture_match', urgent: false, title: `Capture the full match in ${missedMatch.name}`,
      why: `Your contribution is ${num(missedMatch.contribution_percent)}% and the match applies up to ${num(missedMatch.employer_match_limit_percent)}%.`,
      recordId: missedMatch.id ?? null,
      account: missedMatch,
    })
  }

  const worst = snapshot.avalanche?.[0]
  if (worst && worst.apr > THRESHOLDS.highApr) {
    const debt = (snapshot.debts || []).find(item => item.name === worst.name) ?? null
    add({
      key: 'kill_debt', urgent: worst.apr >= THRESHOLDS.crisisApr,
      title: `Pay down ${worst.name} (${worst.apr}% APR)`,
      why: `It costs about $${Math.round(worst.monthlyInterest).toLocaleString()}/mo in interest; paying it down is a guaranteed return.`,
      recordId: debt?.id ?? null,
      debt,
    })
  }

  if (snapshot.expenses > 0 && snapshot.efMonths < snapshot.efTargetMonths) {
    add({
      key: 'build_ef', urgent: false, title: `Grow cash reserves to ${snapshot.efTargetMonths} months`,
      why: `You have ${snapshot.efMonths.toFixed(1)} months available now; your target is $${snapshot.efTargetAmount.toLocaleString()}.`,
      amount: Math.max(0, snapshot.efTargetAmount - Math.round(snapshot.liquid)),
    })
  }

  const activeGoal = [...(snapshot.goals || [])]
    .filter(goal => num(goal.target_amount) > num(goal.current_amount))
    .sort((left, right) => {
      if (left.deadline && right.deadline) return left.deadline.localeCompare(right.deadline)
      if (left.deadline) return -1
      if (right.deadline) return 1
      return String(left.created_at || left.id || '').localeCompare(String(right.created_at || right.id || ''))
    })[0]
  const profileInvesting = (snapshot.profile?.investment_types || []).some(type => type !== 'none')
  if (activeGoal) {
    add({
      key: 'goal', urgent: false, title: `Move ${activeGoal.name} forward`,
      why: `$${Math.max(0, num(activeGoal.target_amount) - num(activeGoal.current_amount)).toLocaleString()} remains toward this goal.`,
      recordId: activeGoal.id ?? null,
      goal: activeGoal,
    })
  } else if (!snapshot.hasInvestmentAccount && !profileInvesting) {
    add({
      key: 'roth', urgent: false, title: 'Open your first investment account',
      why: `A Roth IRA can provide tax-free growth, up to $${LIMITS.rothIra.toLocaleString()}/year in ${LIMITS.year}.`,
    })
  } else if (snapshot.unallocated > 0 && snapshot.hasInvestmentAccount) {
    const account = snapshot.investmentAccounts?.[0]
    add({
      key: 'invest', urgent: false, title: `Increase investing in ${account.name || 'your investment account'}`,
      why: 'Your core protections are in place, so a sustainable contribution can support long-term growth.',
      recordId: account.id ?? null,
      account,
    })
  }

  if (snapshot.unallocated >= THRESHOLDS.autoTransferMin) {
    add({
      key: 'assign_cash', urgent: false, title: 'Give the remaining cash a job',
      why: `$${Math.round(snapshot.unallocated).toLocaleString()}/mo is still unassigned. Direct it to your highest-priority goal.`,
      amount: Math.round(snapshot.unallocated),
    })
  }

  if (!priorities.length) {
    add({
      key: 'grow', urgent: false, title: 'Keep your plan balanced',
      why: 'Your current plan is assigned without an obvious gap. Refresh balances and details as they change.',
    })
  }
  return priorities
}

export function nextDollar(snapshot) {
  return financialPriorities(snapshot)[0]
}

export function computeSnapshot({
  profile,
  accounts = [],
  debts = [],
  goals = [],
  cashFlowItems = [],
  budgetLimits = [],
}) {
  const detailedFlow = cashFlowItems.length > 0
  const flow = cashFlowTotals(cashFlowItems, budgetLimits)
  const income = detailedFlow ? flow.income : num(profile?.monthly_income)
  const expenses = detailedFlow ? flow.expenses : num(profile?.monthly_expenses)
  const futureAllocations = detailedFlow ? flow.allocations : 0
  const cashFlowMargin = income - expenses
  const unallocated = cashFlowMargin - futureAllocations

  const includedAccounts = accounts.filter(account => account.include_in_net_worth !== false)
  const includedDebts = debts.filter(debt => debt.include_in_net_worth !== false)
  const cashAccounts = accounts.filter(account => accountFamily(account) === 'cash')
  const investmentAccounts = accounts.filter(account => accountFamily(account) === 'investment')
  const liquid = cashAccounts.filter(inferLiquidity).reduce((sum, account) => sum + num(account.balance), 0)
  const invested = investmentAccounts.reduce((sum, account) => sum + num(account.balance), 0)
  const assets = includedAccounts.reduce((sum, account) => sum + num(account.balance), 0)
  const totalDebt = includedDebts.reduce((sum, debt) => sum + num(debt.balance), 0)

  const cashWithBalance = cashAccounts.filter(account => num(account.balance) > 0)
  const totalCash = cashWithBalance.reduce((sum, account) => sum + num(account.balance), 0)
  const weightedCashApy = totalCash > 0
    ? cashWithBalance.reduce((sum, account) => sum + num(account.balance) * num(account.interest_rate), 0) / totalCash
    : 0
  const annualCashInterest = cashWithBalance.reduce(
    (sum, account) => sum + num(account.balance) * num(account.interest_rate) / 100,
    0,
  )

  const activeDebts = debts.filter(debt => num(debt.balance) > 0)
  const avalanche = [...activeDebts]
    .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))
    .map(debt => ({
      name: debt.name,
      balance: num(debt.balance),
      apr: num(debt.interest_rate),
      monthlyInterest: num(debt.balance) * num(debt.interest_rate) / 100 / 12,
    }))
  const ratedDebtBalance = activeDebts.filter(debt => known(debt.interest_rate))
    .reduce((sum, debt) => sum + num(debt.balance), 0)
  const weightedDebtApr = ratedDebtBalance > 0
    ? activeDebts.reduce((sum, debt) => sum + num(debt.balance) * num(debt.interest_rate), 0) / ratedDebtBalance
    : 0
  const requiredDebtPayments = activeDebts.reduce((sum, debt) => sum + num(debt.minimum_payment), 0)
  const plannedDebtPayments = activeDebts.reduce(
    (sum, debt) => sum + Math.max(num(debt.planned_payment), num(debt.minimum_payment)),
    0,
  )
  const cardBalance = activeDebts.filter(debt => debt.type === 'credit_card')
    .reduce((sum, debt) => sum + num(debt.balance), 0)
  const cardLimit = activeDebts.filter(debt => debt.type === 'credit_card')
    .reduce((sum, debt) => sum + num(debt.credit_limit), 0)

  const efTarget = efTargetMonths(profile)
  const snapshot = {
    profile,
    accounts,
    debts,
    goals,
    cashFlowItems,
    budgetLimits,
    income,
    expenses,
    surplus: cashFlowMargin,
    cashFlowMargin,
    unallocated,
    futureAllocations,
    needs: flow.needs,
    wants: flow.wants,
    needsRatio: income > 0 ? flow.needs / income : 0,
    wantsRatio: income > 0 ? flow.wants / income : 0,
    futureRatio: income > 0 ? futureAllocations / income : 0,
    budgetStatus: flow,
    savingsRate: income > 0 ? cashFlowMargin / income : 0,
    cashAccounts,
    investmentAccounts,
    hasInvestmentAccount: investmentAccounts.length > 0,
    liquid,
    invested,
    assets,
    totalDebt,
    netWorth: assets - totalDebt,
    weightedCashApy,
    annualCashInterest,
    investmentMonthlyContributions: investmentAccounts.reduce((sum, account) => sum + num(account.monthly_contribution), 0),
    efMonths: expenses > 0 ? liquid / expenses : 0,
    efTargetMonths: efTarget,
    efTargetAmount: Math.round(expenses * efTarget),
    avalanche,
    weightedDebtApr,
    debtMonthlyInterest: avalanche.reduce((sum, debt) => sum + debt.monthlyInterest, 0),
    requiredDebtPayments,
    plannedDebtPayments,
    cardUtilization: cardLimit > 0 ? cardBalance / cardLimit : null,
    debtFree: debtFreedomWithMinimums(activeDebts),
  }
  snapshot.next = nextDollar(snapshot)
  return snapshot
}
