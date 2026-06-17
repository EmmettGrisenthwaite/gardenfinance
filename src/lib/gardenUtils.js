// Treat null recurring as true (handles existing rows before migration)
const isRecurring = (b) => b.recurring !== false

// Garden health, 0–100. EVERY point is EARNED — an empty profile scores 0, so a
// brand-new garden starts barren (Stage 0) and greens as the user fills things in
// and builds good habits. No "free" default points.
//   Budget   0–30  · Goals 0–28 · Accounts 0–27 · Debt 0–15   (= 100)
export function computeScores(budgets = [], goals = [], debts = [], accounts = []) {
  const recurringIncome = budgets
    .filter(b => b.type === 'income' && isRecurring(b))
    .reduce((s, b) => s + Number(b.amount), 0)

  const recurringExpenses = budgets
    .filter(b => b.type === 'expense' && isRecurring(b))
    .reduce((s, b) => s + Number(b.amount), 0)

  const surplusRatio = recurringIncome > 0
    ? (recurringIncome - recurringExpenses) / recurringIncome
    : 0

  // ── Budget (0–30) — earned only once income is tracked ──────────────────────
  // Break-even ≈ 8, healthy surplus (≥20%) maxes out, deficit trends to 0.
  let budgetScore = 0
  if (recurringIncome > 0) {
    const r = Math.max(-1, Math.min(surplusRatio, 1))
    budgetScore = Math.max(0, Math.min(30, 8 + r * 40))
  }

  // ── Goals (0–28) — credit for setting a goal, more for funding it ───────────
  let goalsScore = 0
  if (goals.length > 0) {
    const avg = goals.reduce((s, g) => {
      const target = Number(g.target_amount)
      return target ? s + Math.min(Number(g.current_amount) / target, 1) : s
    }, 0) / goals.length
    goalsScore = 8 + avg * 20
  }

  // ── Accounts (0–27) — tracking balances + emergency fund + retirement ───────
  let accountsScore = 0
  if (accounts.length > 0) {
    const liquidTypes     = ['checking', 'savings', 'emergency', 'money_market']
    const retirementTypes = ['roth_ira', 'trad_ira', '401k', '403b', 'hsa', 'pension', 'brokerage', 'crypto']
    const liquidTotal = accounts
      .filter(a => liquidTypes.includes(a.type))
      .reduce((s, a) => s + Number(a.balance), 0)

    accountsScore = 7 // base for tracking real balances
    if (recurringExpenses > 0) {
      // up to 13 pts, full at 3 months of expenses covered
      accountsScore += Math.min(liquidTotal / (recurringExpenses * 3), 1) * 13
    } else if (liquidTotal > 0) {
      accountsScore += 5
    }
    if (accounts.some(a => retirementTypes.includes(a.type))) accountsScore += 7
  }

  // ── Debt (0–15) — evaluated once income is tracked; no debt = full ──────────
  let debtScore = 0
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance), 0)
  if (recurringIncome > 0) {
    if (totalDebt === 0) debtScore = 15
    else debtScore = (1 - Math.min(totalDebt / (recurringIncome * 12 * 1.5), 1)) * 15
  }

  const totalScore = Math.min(100, Math.round(budgetScore + goalsScore + accountsScore + debtScore))
  const hasDeficit = recurringIncome > 0 && surplusRatio < 0

  return {
    totalScore,
    budgetScore,
    goalsScore,
    debtScore,
    accountsBonus: accountsScore, // name kept for back-compat with callers
    recurringIncome,
    recurringExpenses,
    surplusRatio,
    hasDeficit,
    deficitSeverity: hasDeficit ? Math.min(Math.abs(surplusRatio), 1) : 0,
  }
}

export function getCloudStyle(surplusRatio) {
  if (surplusRatio >= 0.3)  return { count: 0, dark: false }
  if (surplusRatio >= 0.1)  return { count: 1, dark: false }
  if (surplusRatio >= 0)    return { count: 2, dark: false }
  return { count: Math.min(4, 2 + Math.round(Math.abs(surplusRatio) * 4)), dark: true }
}

export function hasRecentWindfall(budgets = []) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return budgets.some(b =>
    b.recurring === false &&
    b.type === 'income' &&
    b.created_at &&
    new Date(b.created_at).getTime() > sevenDaysAgo
  )
}
