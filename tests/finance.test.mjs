import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot, debtFreedom, payoffMonths } from '../src/lib/finance.js'
import {
  debtFreedomWithExtra,
  getProjection,
  netWorthTrajectory,
} from '../src/lib/financeArtifacts.js'

test('computeSnapshot derives live assets, debt, runway, and net worth', () => {
  const snapshot = computeSnapshot({
    profile: { monthly_income: 3000, monthly_expenses: 2000 },
    accounts: [
      { type: 'checking', balance: 1000 },
      { type: 'brokerage', balance: 2000 },
    ],
    debts: [{ name: 'Card', balance: 500, interest_rate: 24 }],
  })

  assert.equal(snapshot.assets, 3000)
  assert.equal(snapshot.totalDebt, 500)
  assert.equal(snapshot.netWorth, 2500)
  assert.equal(snapshot.liquid, 1000)
  assert.equal(snapshot.savingsRate, 1 / 3)
  assert.equal(snapshot.avalanche[0].apr, 24)
})

test('debt payoff calculation reaches zero balance at zero interest', () => {
  const result = debtFreedom([{ balance: 1000, interest_rate: 0 }], 100)
  assert.equal(result.months, 10)
  assert.equal(result.totalInterest, 0)
})

test('debt artifact reports a chosen total payment honestly', () => {
  const result = debtFreedomWithExtra([{ balance: 1000, interest_rate: 0 }], 100)
  assert.equal(result.monthsToFreedom, 10)
  assert.equal(result.stuck, false)
  assert.equal(result.totalInterest, 0)
  assert.equal('monthsSaved' in result, false)
})

test('investment projections include the configured return', () => {
  const result = getProjection(
    { target_amount: 1005, current_amount: 0, goal_type: 'investment' },
    100,
  )
  assert.equal(result.monthsToGoal, 10)
})

test('net worth trajectory preserves negative starting net worth', () => {
  const result = netWorthTrajectory(0, 20000, 500, 1, 0)
  assert.equal(result.currentNetWorth, -20000)
  assert.equal(result.year1.netWorth, -14000)
})

test('payoffMonths charges interest instead of dividing', () => {
  // Division flatters the plan, and the error grows where it hurts most.
  assert.equal(payoffMonths(5000, 22, 150), 52)   // division says 34
  assert.equal(payoffMonths(5000, 24, 110), 122)  // division says 46
  assert.equal(payoffMonths(900, 26.99, 250), 4)  // small balance, barely differs

  // A balance already clear costs nothing; 0% is plain division.
  assert.equal(payoffMonths(0, 24, 100), 0)
  assert.equal(payoffMonths(1200, 0, 100), 12)
})

test('a payment that cannot outrun the interest returns no estimate', () => {
  // $5,000 at 24% accrues $100/mo. Paying $100 never clears it, and a
  // confident "about 50 months" would be the worst possible answer.
  assert.equal(payoffMonths(5000, 24, 100), null)
  assert.equal(payoffMonths(5000, 24, 99), null)
  assert.equal(payoffMonths(5000, 24, 0), null)
  assert.equal(payoffMonths(5000, 24, -50), null)
})
