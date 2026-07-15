import { getDataGaps } from './dataGaps.js'

export const MONEY_SETUP_PIECES = [
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Spending' },
  { id: 'balances', label: 'Balances' },
  { id: 'debts', label: 'Debt details' },
  { id: 'invest', label: 'Investments' },
]

export function getMoneySetupState({ profile, accounts = [], debts = [], goals = [], cashFlowItems = [] } = {}) {
  const gaps = getDataGaps({ profile, accounts, debts, goals, cashFlowItems })
  const byId = Object.fromEntries(gaps.map(gap => [gap.id, gap]))
  const investmentTypes = Array.isArray(profile?.investment_types) ? profile.investment_types : []
  const claimsInvesting = investmentTypes.length > 0 && !investmentTypes.includes('none')
  const applicable = MONEY_SETUP_PIECES.filter(piece => (
    piece.id === 'debts' ? debts.length > 0 : piece.id === 'invest' ? claimsInvesting : true
  ))
  const missing = applicable.map(piece => {
    if (piece.id === 'income') return byId.income ? { ...byId.income, sheet: byId.income.sheet || 'plan' } : null
    if (piece.id === 'expenses') return byId.expenses ? { ...byId.expenses, sheet: byId.expenses.sheet || 'plan' } : null
    if (piece.id === 'balances') return accounts.length === 0
      ? { id: 'balances', label: "Add what's in checking and savings", cta: 'Add balances', sheet: 'cash' }
      : null
    if (piece.id === 'debts') {
      const debtGap = byId.debt_rate ?? byId.debt_minimum ?? null
      return debtGap ? { ...debtGap, sheet: 'debts' } : null
    }
    if (piece.id === 'invest') return byId.invest_amount ? { ...byId.invest_amount, sheet: 'investment' } : null
    return null
  }).filter(Boolean)

  return {
    total: applicable.length,
    done: applicable.length - missing.length,
    next: missing[0] ?? null,
  }
}
