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

export function nextDollar(snapshot) {
  if (snapshot.income > 0 && snapshot.cashFlowMargin < 0) return {
    key: 'deficit', urgent: true, title: 'Close the monthly gap',
    why: `Your typical spending is $${Math.abs(Math.round(snapshot.cashFlowMargin)).toLocaleString()}/mo above income. Start there before assigning money elsewhere.`,
  }
  if (snapshot.income > 0 && snapshot.unallocated < 0) return {
    key: 'overcommitted', urgent: true, title: 'Reduce planned allocations',
    why: `You have assigned $${Math.abs(Math.round(snapshot.unallocated)).toLocaleString()}/mo more than your cash-flow margin can support.`,
  }
  if (snapshot.profile?.health_insurance === 'none') return {
    key: 'insurance', urgent: true, title: 'Get health insurance',
    why: 'One medical emergency without coverage can undo the progress you are building.',
  }
  if (snapshot.expenses > 0 && snapshot.liquid < THRESHOLDS.starterEmergency) return {
    key: 'starter_ef', urgent: false, title: `Build a $${THRESHOLDS.starterEmergency.toLocaleString()} starter reserve`,
    why: 'A small liquid buffer keeps everyday surprises from turning into debt.',
  }
  const missedMatch = snapshot.accounts.find(account => {
    if (!isWorkplaceAccount(account) || num(account.employer_match_percent) <= 0) return false
    const matchLimit = num(account.employer_match_limit_percent)
    return matchLimit > 0 && num(account.contribution_percent) < matchLimit
  })
  if (missedMatch) return {
    key: 'capture_match', urgent: false, title: `Capture the full match in ${missedMatch.name}`,
    why: `Your contribution is ${num(missedMatch.contribution_percent)}% and the match applies up to ${num(missedMatch.employer_match_limit_percent)}%.`,
  }
  const worst = snapshot.avalanche[0]
  if (worst && worst.apr > THRESHOLDS.highApr) return {
    key: 'kill_debt', urgent: worst.apr >= THRESHOLDS.crisisApr,
    title: `Pay down ${worst.name} (${worst.apr}% APR)`,
    why: `It costs about $${Math.round(worst.monthlyInterest).toLocaleString()}/mo in interest; paying it down is a guaranteed return.`,
  }
  if (snapshot.expenses > 0 && snapshot.efMonths < snapshot.efTargetMonths) return {
    key: 'build_ef', urgent: false, title: `Grow cash reserves to ${snapshot.efTargetMonths} months`,
    why: `You have ${snapshot.efMonths.toFixed(1)} months available now; your target is $${snapshot.efTargetAmount.toLocaleString()}.`,
  }
  const profileInvesting = (snapshot.profile?.investment_types || []).some(type => type !== 'none')
  if (!snapshot.hasInvestmentAccount && !profileInvesting) return {
    key: 'roth', urgent: false, title: 'Open your first investment account',
    why: `A Roth IRA can provide tax-free growth, up to $${LIMITS.rothIra.toLocaleString()}/year in ${LIMITS.year}.`,
  }
  if (snapshot.unallocated >= THRESHOLDS.autoTransferMin) return {
    key: 'assign_cash', urgent: false, title: 'Give the remaining cash a job',
    why: `$${Math.round(snapshot.unallocated).toLocaleString()}/mo is still unassigned. Direct it to your highest-priority goal.`,
  }
  return {
    key: 'grow', urgent: false, title: 'Keep your plan balanced',
    why: 'Your current plan is assigned without an obvious gap. Refresh balances and details as they change.',
  }
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
