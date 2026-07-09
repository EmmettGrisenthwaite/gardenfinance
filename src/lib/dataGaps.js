// ─── Data gaps ──────────────────────────────────────────────────────────────────
// The onboarding quiz deliberately keeps first-run friction low (a lump income,
// a lump expense number, debts with no rate). But the advisor gives sharper
// advice with more — a debt's actual APR changes the payoff order, an
// investment balance changes whether "start investing" even applies. This is
// the single, deterministic list of what's still missing and worth asking for.
//
// Purely derived from live data — no "have we asked before" flag needed. Once
// the user fills a field, its gap disappears from this list on the next render,
// which is what makes every surface that reads it "stop asking" automatically.

const num = (v) => Number(v) || 0

// Ranked highest-value first: things that change what the advisor would say.
export function getDataGaps({ profile, accounts = [], debts = [], goals = [] }) {
  const gaps = []
  const p = profile || {}

  // 1) Debt without a rate — the avalanche order and "is this urgent" both
  // depend on it. Ask about the largest unrated debt by name.
  const unrated = debts.filter(d => num(d.balance) > 0 && (d.interest_rate === null || d.interest_rate === undefined))
  if (unrated.length > 0) {
    const worst = [...unrated].sort((a, b) => num(b.balance) - num(a.balance))[0]
    gaps.push({
      id: 'debt_rate',
      label: unrated.length === 1
        ? `What's the interest rate on ${worst.name}?`
        : `What are the interest rates on your debts? (${unrated.length} missing)`,
      sub: 'Changes the payoff order and how urgent it is.',
      cta: 'Add rate', href: '/money',
    })
  }

  // 2) Says they're investing, but no dollar amount is on record.
  const investTypes = Array.isArray(p.investment_types) ? p.investment_types : []
  const isInvesting = investTypes.length > 0 && !investTypes.includes('none')
  const investedTotal = accounts.filter(a => a.type === 'brokerage').reduce((s, a) => s + num(a.balance), 0)
  if (isInvesting && investedTotal === 0) {
    gaps.push({
      id: 'invest_amount',
      label: 'How much do you have invested so far?',
      sub: 'So your advisor stops suggesting you start from zero.',
      cta: 'Add amount', href: '/money',
    })
  }

  // 3) No income on record — almost nothing else can be computed without it.
  if (!num(p.monthly_income)) {
    gaps.push({
      id: 'income',
      label: 'What do you take home each month?',
      sub: 'Every recommendation starts from your real cash flow.',
      cta: 'Add income', href: '/money',
    })
  }

  // 4) No expenses on record.
  if (!num(p.monthly_expenses)) {
    gaps.push({
      id: 'expenses',
      label: "What's your monthly spending — rent, food, bills, subscriptions?",
      sub: 'Unlocks your savings rate and emergency-fund target.',
      cta: 'Add expenses', href: '/money',
    })
  }

  // 5) No savings goal at all — the plan has nothing to grow toward.
  if (goals.length === 0) {
    gaps.push({
      id: 'goal',
      label: 'What are you saving toward first?',
      sub: 'A trip, a house, a cushion — give your garden something to grow.',
      cta: 'Set a goal', href: '/plan#goals',
    })
  }

  return gaps
}
