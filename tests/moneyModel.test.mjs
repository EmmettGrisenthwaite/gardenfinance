import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot, debtFreedomWithMinimums } from '../src/lib/finance.js'
import { cashFlowTotals, monthlyAmount } from '../src/lib/moneyModel.js'

test('normalizes supported cash-flow frequencies into typical monthly amounts', () => {
  assert.equal(monthlyAmount(100, 'weekly'), 433.33)
  assert.equal(monthlyAmount(100, 'biweekly'), 216.67)
  assert.equal(monthlyAmount(100, 'twice_monthly'), 200)
  assert.equal(monthlyAmount(300, 'quarterly'), 100)
  assert.equal(monthlyAmount(1200, 'annual'), 100)
})

test('category totals separate needs, wants, and future allocations', () => {
  const result = cashFlowTotals([
    { kind: 'income', group_key: 'income', category_key: 'paycheck', amount: 5000, frequency: 'monthly' },
    { kind: 'expense', group_key: 'needs', category_key: 'housing', amount: 1800, frequency: 'monthly' },
    { kind: 'expense', group_key: 'wants', category_key: 'dining', amount: 100, frequency: 'weekly' },
    { kind: 'allocation', group_key: 'future', category_key: 'retirement', amount: 500, frequency: 'monthly' },
  ], [{ category: 'dining', monthly_limit: 400 }])
  assert.equal(result.income, 5000)
  assert.equal(result.needs, 1800)
  assert.equal(result.wants, 433.33)
  assert.equal(result.allocations, 500)
  assert.equal(result.targets.dining, 400)
})

test('detailed snapshot calculates margin, allocations, weighted rates, and utilization', () => {
  const snapshot = computeSnapshot({
    profile: { monthly_income: 1, monthly_expenses: 1 },
    cashFlowItems: [
      { kind: 'income', group_key: 'income', amount: 6000, frequency: 'monthly' },
      { kind: 'expense', group_key: 'needs', category_key: 'debt_payments', amount: 300, frequency: 'monthly' },
      { kind: 'expense', group_key: 'wants', amount: 3200, frequency: 'monthly' },
      { kind: 'allocation', group_key: 'future', amount: 1000, frequency: 'monthly' },
    ],
    accounts: [
      { type: 'savings', subtype: 'hysa', balance: 10000, interest_rate: 4 },
      { type: 'checking', subtype: 'checking', balance: 5000, interest_rate: 1 },
      { type: 'brokerage', subtype: 'roth_ira', balance: 2000, monthly_contribution: 250 },
    ],
    debts: [{
      name: 'Card', type: 'credit_card', balance: 2000, interest_rate: 18,
      minimum_payment: 75, planned_payment: 300, credit_limit: 10000,
    }],
  })
  assert.equal(snapshot.income, 6000)
  assert.equal(snapshot.cashFlowMargin, 2500)
  assert.equal(snapshot.unallocated, 1500)
  assert.equal(snapshot.requiredDebtPayments, 75)
  assert.equal(snapshot.plannedDebtPayments, 300)
  assert.equal(snapshot.cardUtilization, 0.2)
  assert.equal(Math.round(snapshot.weightedCashApy * 100) / 100, 3)
  assert.equal(snapshot.annualCashInterest, 450)
  assert.equal(snapshot.investmentMonthlyContributions, 250)
  assert.equal(snapshot.next.key, 'kill_debt')
})

test('planned debt payments are informational and never double-counted in unallocated cash', () => {
  const snapshot = computeSnapshot({
    profile: {},
    cashFlowItems: [
      { kind: 'income', group_key: 'income', amount: 4000 },
      { kind: 'expense', group_key: 'needs', category_key: 'debt_payments', amount: 500 },
      { kind: 'expense', group_key: 'needs', category_key: 'housing', amount: 2000 },
    ],
    debts: [{ name: 'Loan', balance: 10000, interest_rate: 5, minimum_payment: 300, planned_payment: 500 }],
  })
  assert.equal(snapshot.unallocated, 1500)
})

test('minimum-aware payoff refuses incomplete data and rolls payments by APR', () => {
  assert.equal(debtFreedomWithMinimums([{ balance: 1000, interest_rate: null, minimum_payment: 100 }]), null)
  const result = debtFreedomWithMinimums([
    { balance: 1000, interest_rate: 0, minimum_payment: 100, planned_payment: 200 },
    { balance: 500, interest_rate: 0, minimum_payment: 50, planned_payment: 50 },
  ])
  assert.equal(result.months, 6)
  assert.equal(result.totalInterest, 0)
})

test('next-dollar logic distinguishes spending deficits from overcommitted allocations', () => {
  const deficit = computeSnapshot({
    profile: {},
    cashFlowItems: [
      { kind: 'income', group_key: 'income', amount: 3000 },
      { kind: 'expense', group_key: 'needs', amount: 3200 },
    ],
  })
  assert.equal(deficit.next.key, 'deficit')

  const overcommitted = computeSnapshot({
    profile: {},
    cashFlowItems: [
      { kind: 'income', group_key: 'income', amount: 3000 },
      { kind: 'expense', group_key: 'needs', amount: 2500 },
      { kind: 'allocation', group_key: 'future', amount: 800 },
    ],
  })
  assert.equal(overcommitted.next.key, 'overcommitted')
})

test('a detailed investment account prevents first-investment recommendations', () => {
  const snapshot = computeSnapshot({
    profile: { health_insurance: 'employer' },
    accounts: [{ type: 'brokerage', subtype: 'roth_ira', balance: 0 }],
  })
  assert.notEqual(snapshot.next.key, 'roth')
})
