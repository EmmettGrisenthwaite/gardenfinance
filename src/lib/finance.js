// ─── The deterministic finance engine ──────────────────────────────────────────
// Single source of truth for every financial constant and calculation in the
// app. The advisor, SmartSuggestions, and the Money page all read from here so
// they can never disagree — and the LLM is handed computed numbers instead of
// being trusted to do arithmetic.

// IRS limits — update once a year, in one place (source: irs.gov, Nov 2025
// announcement of 2026 limits).
export const LIMITS = {
  year: 2026,
  rothIra: 7500,
  k401: 24500,
  rothPhaseOutSingle: [153000, 168000],
  rothPhaseOutMarried: [242000, 252000],
}

export const THRESHOLDS = {
  highApr: 7,             // above this, paying debt beats investing
  crisisApr: 20,          // credit-card territory — treat as an emergency
  starterEmergency: 1000, // the "stop small emergencies becoming debt" buffer
  autoTransferMin: 100,   // surplus worth automating
  investReturn: 0.06,     // conservative annual return used in projections
}

export const LIQUID_TYPES = ['checking', 'savings', 'emergency', 'money_market']

const num = (v) => Number(v) || 0

// Freelance and gig income is lumpy — carry a bigger cushion.
export function efTargetMonths(profile) {
  const t = profile?.employment_type
  return t === 'freelance' || t === 'other' ? 6 : 3
}

// Avalanche amortization: every month interest accrues on each debt, then the
// whole `monthlyPayment` goes at the highest-APR balance first. Returns
// { months, totalInterest, debtFreeLabel } or { stuck: true } when the payment
// can't outrun the interest.
export function debtFreedom(debts, monthlyPayment) {
  const live = debts
    .map(d => ({ balance: num(d.balance), apr: num(d.interest_rate) }))
    .filter(d => d.balance > 0)
  if (!live.length) return { months: 0, totalInterest: 0 }
  if (monthlyPayment <= 0) return { stuck: true }

  let months = 0, totalInterest = 0
  while (live.some(d => d.balance > 0)) {
    months++
    if (months > 600) return { stuck: true } // >50 years — payment loses to interest
    let interestThisMonth = 0
    for (const d of live) {
      const i = d.balance * (d.apr / 100 / 12)
      d.balance += i
      interestThisMonth += i
    }
    totalInterest += interestThisMonth
    if (monthlyPayment <= interestThisMonth && months === 1) return { stuck: true }
    let pay = monthlyPayment
    live.sort((a, b) => b.apr - a.apr)
    for (const d of live) {
      if (pay <= 0) break
      const applied = Math.min(pay, d.balance)
      d.balance -= applied
      pay -= applied
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

// Where should the next spare dollar go? The classic priority ladder, computed
// from real data instead of eyeballed. Returns { key, title, why, urgent }.
export function nextDollar(s) {
  if (s.income > 0 && s.surplus < 0) return {
    key: 'deficit', urgent: true, title: 'Fix your cash flow',
    why: `You're spending $${Math.abs(s.surplus).toLocaleString()}/mo more than you earn — nothing else works until this does.`,
  }
  if (s.profile?.health_insurance === 'none') return {
    key: 'insurance', urgent: true, title: 'Get health insurance',
    why: 'One medical emergency without coverage can wipe out everything else you build.',
  }
  if (s.expenses > 0 && s.liquid < THRESHOLDS.starterEmergency) return {
    key: 'starter_ef', urgent: false, title: `Build a $${THRESHOLDS.starterEmergency.toLocaleString()} starter emergency fund`,
    why: 'A small cash buffer stops surprises from becoming credit-card debt.',
  }
  const investTypes = s.profile?.investment_types ?? []
  if (s.profile?.employer_401k === 'match' && !investTypes.includes('401k')) return {
    key: 'capture_match', urgent: false, title: 'Capture your 401(k) match',
    why: 'An employer match is a 50–100% instant return — free money before anything else.',
  }
  const worst = s.avalanche[0]
  if (worst && worst.apr > THRESHOLDS.highApr) return {
    key: 'kill_debt', urgent: worst.apr >= THRESHOLDS.crisisApr, title: `Pay down ${worst.name} (${worst.apr}% APR)`,
    why: `It costs you ~$${Math.round(worst.monthlyInterest).toLocaleString()}/mo in interest — paying it off is a guaranteed ${worst.apr}% return.`,
  }
  if (s.expenses > 0 && s.efMonths < s.efTargetMonths) return {
    key: 'build_ef', urgent: false, title: `Grow your emergency fund to ${s.efTargetMonths} months`,
    why: `You have ${s.efMonths.toFixed(1)} months of expenses saved — target $${s.efTargetAmount.toLocaleString()}${s.efTargetMonths === 6 ? ' (6 months, since your income varies)' : ''}.`,
  }
  if (investTypes.length === 0 || investTypes.includes('none')) return {
    key: 'roth', urgent: false, title: 'Start investing — open a Roth IRA',
    why: `Tax-free growth, up to $${LIMITS.rothIra.toLocaleString()}/year (${LIMITS.year}). Time in the market is your biggest asset.`,
  }
  return {
    key: 'grow', urgent: false, title: 'Invest your surplus toward your goals',
    why: 'Foundations look solid — put spare cash to work in your goals and retirement accounts.',
  }
}

// One call → everything the app needs to reason about a user's money.
export function computeSnapshot({ profile, accounts = [], debts = [], goals = [] }) {
  const income   = num(profile?.monthly_income)
  const expenses = num(profile?.monthly_expenses)
  const surplus  = income - expenses

  const byType = (t) => accounts.filter(a => a.type === t).reduce((s, a) => s + num(a.balance), 0)
  const liquid   = LIQUID_TYPES.reduce((s, t) => s + byType(t), 0)
  const invested = byType('brokerage')
  const assets   = accounts.reduce((s, a) => s + num(a.balance), 0)
  const totalDebt = debts.reduce((s, d) => s + num(d.balance), 0)

  const avalanche = [...debts]
    .filter(d => num(d.balance) > 0)
    .sort((a, b) => num(b.interest_rate) - num(a.interest_rate))
    .map(d => ({
      name: d.name, balance: num(d.balance), apr: num(d.interest_rate),
      monthlyInterest: num(d.balance) * (num(d.interest_rate) / 100 / 12),
    }))

  const efTarget = efTargetMonths(profile)
  const snap = {
    profile, goals,
    income, expenses, surplus,
    savingsRate: income > 0 ? surplus / income : 0,
    liquid, invested, assets, totalDebt,
    netWorth: assets - totalDebt,
    efMonths: expenses > 0 ? liquid / expenses : 0,
    efTargetMonths: efTarget,
    efTargetAmount: Math.round(expenses * efTarget),
    avalanche,
    debtMonthlyInterest: avalanche.reduce((s, d) => s + d.monthlyInterest, 0),
    debtFree: totalDebt > 0 && surplus > 0 ? debtFreedom(debts, surplus) : null,
  }
  snap.next = nextDollar(snap)
  return snap
}
