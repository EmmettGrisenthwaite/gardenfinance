import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot, debtFreedom, netWorthExplanation, payoffMonths } from '../src/lib/finance.js'
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

test('a negative net worth is explained only when one balance really drives it', () => {
  const loan = { name: 'Student loan', balance: 9500, interest_rate: 5.5 }
  const card = { name: 'Credit card', balance: 900, interest_rate: 26.99 }

  // The 20-year-old from the walkthrough: -$9,830, 91% of it one loan.
  const note = netWorthExplanation({ netWorth: -9830, debts: [loan, card] })
  assert.match(note, /Most of this is Student loan at 5\.5%/)
  assert.match(note, /minimum payments on purpose/)

  // High-APR instead: the plan is already pointed at it, and should say so.
  const aimed = netWorthExplanation({ netWorth: -3000, debts: [{ name: 'Visa', balance: 3000, interest_rate: 24 }] })
  assert.match(aimed, /exactly what your plan is aimed at/)

  // No rate on file — ask for the one fact that would place it.
  const unrated = netWorthExplanation({ netWorth: -4000, debts: [{ name: 'Old loan', balance: 4000, interest_rate: null }] })
  assert.match(unrated, /Add its interest rate/)
})

test('the net-worth note stays silent rather than claiming something untrue', () => {
  // Positive net worth needs no explaining.
  assert.equal(netWorthExplanation({ netWorth: 5000, debts: [{ name: 'Visa', balance: 900, interest_rate: 24 }] }), null)
  assert.equal(netWorthExplanation({ netWorth: 0, debts: [] }), null)
  assert.equal(netWorthExplanation({ netWorth: -100, debts: [] }), null)
  assert.equal(netWorthExplanation(), null)

  // Three even balances: "most of this is X" would simply be false.
  const even = netWorthExplanation({
    netWorth: -3000,
    debts: [{ name: 'A', balance: 1000, interest_rate: 20 }, { name: 'B', balance: 1000, interest_rate: 20 }, { name: 'C', balance: 1000, interest_rate: 20 }],
  })
  assert.equal(even, null)

  // Settled balances do not count toward the share.
  const settled = netWorthExplanation({
    netWorth: -1000,
    debts: [{ name: 'Paid off', balance: 0, interest_rate: 24 }, { name: 'Live', balance: 1000, interest_rate: 5 }],
  })
  assert.match(settled, /Most of this is Live/)
})
