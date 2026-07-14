const number = value => Number(value) || 0

export const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly', factor: 52 / 12 },
  { value: 'biweekly', label: 'Every 2 weeks', factor: 26 / 12 },
  { value: 'twice_monthly', label: 'Twice monthly', factor: 2 },
  { value: 'monthly', label: 'Monthly', factor: 1 },
  { value: 'quarterly', label: 'Quarterly', factor: 1 / 3 },
  { value: 'annual', label: 'Annual', factor: 1 / 12 },
]

export const CASH_FLOW_CATEGORIES = [
  { kind: 'income', group: 'income', key: 'paycheck', label: 'Paycheck' },
  { kind: 'income', group: 'income', key: 'variable_income', label: 'Variable or side income' },
  { kind: 'income', group: 'income', key: 'benefits', label: 'Benefits' },
  { kind: 'income', group: 'income', key: 'other_income', label: 'Other income' },
  { kind: 'expense', group: 'needs', key: 'housing', label: 'Housing' },
  { kind: 'expense', group: 'needs', key: 'utilities', label: 'Utilities' },
  { kind: 'expense', group: 'needs', key: 'groceries', label: 'Groceries' },
  { kind: 'expense', group: 'needs', key: 'transportation', label: 'Transportation' },
  { kind: 'expense', group: 'needs', key: 'insurance', label: 'Insurance' },
  { kind: 'expense', group: 'needs', key: 'healthcare', label: 'Healthcare' },
  { kind: 'expense', group: 'needs', key: 'childcare', label: 'Childcare' },
  { kind: 'expense', group: 'needs', key: 'debt_payments', label: 'Debt payments' },
  { kind: 'expense', group: 'needs', key: 'taxes', label: 'Taxes' },
  { kind: 'expense', group: 'wants', key: 'dining', label: 'Dining' },
  { kind: 'expense', group: 'wants', key: 'entertainment', label: 'Entertainment' },
  { kind: 'expense', group: 'wants', key: 'shopping', label: 'Shopping' },
  { kind: 'expense', group: 'wants', key: 'travel', label: 'Travel' },
  { kind: 'expense', group: 'wants', key: 'subscriptions', label: 'Subscriptions' },
  { kind: 'expense', group: 'wants', key: 'personal', label: 'Personal' },
  { kind: 'expense', group: 'wants', key: 'other_spending', label: 'Other spending' },
  { kind: 'allocation', group: 'future', key: 'emergency_savings', label: 'Emergency savings' },
  { kind: 'allocation', group: 'future', key: 'goal_savings', label: 'Goal savings' },
  { kind: 'allocation', group: 'future', key: 'retirement', label: 'Retirement' },
  { kind: 'allocation', group: 'future', key: 'investing', label: 'Investing' },
  { kind: 'allocation', group: 'future', key: 'extra_debt_payments', label: 'Extra debt payments' },
]

export const CASH_SUBTYPES = [
  { value: 'checking', label: 'Checking', liquid: true },
  { value: 'standard_savings', label: 'Standard savings', liquid: true },
  { value: 'hysa', label: 'High-yield savings', liquid: true },
  { value: 'money_market', label: 'Money market', liquid: true },
  { value: 'cd', label: 'Certificate of deposit', liquid: false },
  { value: 'cash', label: 'Cash', liquid: true },
]

export const INVESTMENT_SUBTYPES = [
  { value: 'taxable_brokerage', label: 'Taxable brokerage', tax: 'Taxable' },
  { value: 'roth_ira', label: 'Roth IRA', tax: 'Tax-free qualified withdrawals' },
  { value: 'traditional_ira', label: 'Traditional IRA', tax: 'Tax-deferred' },
  { value: '401k', label: '401(k)', tax: 'Tax-deferred', workplace: true },
  { value: '403b', label: '403(b)', tax: 'Tax-deferred', workplace: true },
  { value: 'hsa', label: 'HSA', tax: 'Triple tax-advantaged' },
  { value: 'sep_ira', label: 'SEP IRA', tax: 'Tax-deferred' },
  { value: 'crypto', label: 'Crypto', tax: 'Taxable' },
  { value: 'other_investment', label: 'Other investment', tax: 'Varies' },
]

export const ASSET_SUBTYPES = [
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other_asset', label: 'Other asset' },
]

export const DEBT_TYPES = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto_loan', label: 'Auto loan' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'medical_debt', label: 'Medical debt' },
  { value: 'other', label: 'Other debt' },
]

export function monthlyAmount(amount, frequency = 'monthly') {
  const factor = FREQUENCIES.find(item => item.value === frequency)?.factor ?? 1
  return Math.round(number(amount) * factor * 100) / 100
}

export function itemMonthlyAmount(item) {
  if (item?.monthly_amount !== null && item?.monthly_amount !== undefined && item?.monthly_amount !== '') {
    return number(item.monthly_amount)
  }
  return monthlyAmount(item?.amount, item?.frequency)
}

export function cashFlowTotals(items = [], limits = []) {
  const totals = { income: 0, expenses: 0, allocations: 0, needs: 0, wants: 0, future: 0 }
  const byCategory = {}
  for (const item of items) {
    const value = itemMonthlyAmount(item)
    const key = item.category_key || 'custom'
    byCategory[key] = (byCategory[key] || 0) + value
    if (item.kind === 'income') totals.income += value
    if (item.kind === 'expense') {
      totals.expenses += value
      if (item.group_key === 'needs') totals.needs += value
      else totals.wants += value
    }
    if (item.kind === 'allocation') {
      totals.allocations += value
      totals.future += value
    }
  }
  const targets = Object.fromEntries((limits || []).map(limit => [limit.category, number(limit.monthly_limit)]))
  return { ...totals, byCategory, targets }
}

export function categoryMeta(key, fallback = null) {
  return CASH_FLOW_CATEGORIES.find(category => category.key === key) || fallback || {
    kind: 'expense', group: 'wants', key: key || 'custom', label: 'Custom category',
  }
}

export function accountFamily(account) {
  if (account?.type === 'checking' || account?.type === 'savings') return 'cash'
  if (account?.type === 'brokerage') return 'investment'
  if (['property', 'vehicle', 'other_asset'].includes(account?.type)) return 'asset'
  if (CASH_SUBTYPES.some(item => item.value === account?.subtype)) return 'cash'
  if (INVESTMENT_SUBTYPES.some(item => item.value === account?.subtype)) return 'investment'
  return 'asset'
}

export function defaultSubtype(type) {
  if (type === 'checking') return 'checking'
  if (type === 'savings') return 'standard_savings'
  if (type === 'brokerage') return 'taxable_brokerage'
  return type || 'other_asset'
}

export function subtypeLabel(account) {
  const subtype = account?.subtype || defaultSubtype(account?.type)
  return [...CASH_SUBTYPES, ...INVESTMENT_SUBTYPES, ...ASSET_SUBTYPES]
    .find(item => item.value === subtype)?.label || 'Other account'
}

export function inferLiquidity(account) {
  if (account?.is_liquid !== null && account?.is_liquid !== undefined) return Boolean(account.is_liquid)
  const subtype = account?.subtype || defaultSubtype(account?.type)
  return CASH_SUBTYPES.find(item => item.value === subtype)?.liquid ?? false
}

export function taxTreatment(account) {
  const subtype = account?.subtype || defaultSubtype(account?.type)
  return INVESTMENT_SUBTYPES.find(item => item.value === subtype)?.tax || null
}

export function isWorkplaceAccount(account) {
  const subtype = account?.subtype || defaultSubtype(account?.type)
  return Boolean(INVESTMENT_SUBTYPES.find(item => item.value === subtype)?.workplace)
}

export function daysSince(dateValue, now = new Date()) {
  if (!dateValue) return null
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000))
}
