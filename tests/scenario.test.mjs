import test from 'node:test'
import assert from 'node:assert/strict'

import { computeSnapshot } from '../src/lib/finance.js'
import { deriveScenario, scenarioFromAnswers } from '../src/lib/scenario.js'

function snapshotFor(overrides = {}) {
  return computeSnapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3200, health_insurance: 'employer', investment_types: ['401k'] },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 12000, interest_rate: 4 },
    ],
    debts: [],
    goals: [],
    ...overrides,
  })
}

test('the scenario names the top priority with the user’s own numbers', () => {
  const deficit = deriveScenario(snapshotFor({
    profile: { monthly_income: 3000, monthly_expenses: 3400, health_insurance: 'employer' },
  }))
  assert.equal(deficit.id, 'deficit')
  assert.equal(deficit.chapter, 'Stabilize')
  assert.match(deficit.because.join(' '), /\$400/)

  const uninsured = deriveScenario(snapshotFor({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'none' },
  }))
  assert.equal(uninsured.id, 'insurance')
  assert.equal(uninsured.chapter, 'Protect')
})

test('debt and match chapters carry the specific record evidence', () => {
  const debt = deriveScenario(snapshotFor({
    debts: [{ id: 'visa', name: 'Visa', balance: 4000, interest_rate: 24, minimum_payment: 80 }],
  }))
  assert.equal(debt.id, 'kill_debt')
  assert.equal(debt.chapter, 'Extinguish')
  assert.match(debt.because.join(' '), /Visa/)
  assert.match(debt.because.join(' '), /24% APR/)

  const match = deriveScenario(snapshotFor({
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', balance: 5000 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 12000 },
      { id: '401k', name: 'Work 401(k)', type: 'brokerage', subtype: '401k', balance: 9000, contribution_percent: 2, employer_match_percent: 50, employer_match_limit_percent: 6 },
    ],
  }))
  assert.equal(match.id, 'capture_match')
  assert.match(match.because.join(' '), /2%.*6%/)
})

test('an empty picture resolves to the organize chapter', () => {
  const empty = deriveScenario(computeSnapshot({ profile: {}, accounts: [], debts: [], goals: [] }))
  assert.equal(empty.id, 'organize')
  assert.equal(empty.chapter, 'Map it out')
})

test('quiz-stage scenarios skip balance-dependent chapters and honor urgency order', () => {
  // Deficit outranks everything, even a claimed match.
  const deficit = scenarioFromAnswers({
    monthly_income: 3000, monthly_expenses: 3500, employer_401k: 'match',
    health_insurance: 'employer', investment_types: ['none'],
  })
  assert.equal(deficit.id, 'deficit')

  // No coverage outranks the match.
  const uninsured = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'match',
    health_insurance: 'none', investment_types: ['none'],
  })
  assert.equal(uninsured.id, 'insurance')

  // A confirmed match leads once the basics are covered.
  const match = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'match',
    health_insurance: 'employer', investment_types: ['none'],
  })
  assert.equal(match.id, 'capture_match_quiz')
  assert.equal(match.chapter, 'Free money')

  // High-APR quiz debt gets the extinguish chapter with its own name.
  const debt = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'no_match',
    health_insurance: 'employer', investment_types: ['none'],
    debts: [{ name: 'Card', balance: 3000, interest_rate: 22 }],
  })
  assert.equal(debt.id, 'kill_debt')
  assert.match(debt.because.join(' '), /Card/)

  // Debt without an APR still surfaces as the debt chapter, asking for rates.
  const vagueDebt = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'no_match',
    health_insurance: 'employer', investment_types: ['401k'],
    debts: [{ name: 'Loan', balance: 8000 }],
  })
  assert.equal(vagueDebt.id, 'debts_quiz')
  assert.match(vagueDebt.because.join(' '), /\$8,000/)

  // Not investing yet, everything else clear → launch.
  const launch = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'no_match',
    health_insurance: 'employer', investment_types: ['none'],
  })
  assert.equal(launch.id, 'roth')

  // Already investing with a surplus → the surplus gets named.
  const surplus = scenarioFromAnswers({
    monthly_income: 5000, monthly_expenses: 3000, employer_401k: 'no_match',
    health_insurance: 'employer', investment_types: ['401k'],
  })
  assert.equal(surplus.id, 'foothold_quiz')
  assert.match(surplus.because.join(' '), /\$2,000/)

  // Nothing entered at all → organize.
  const empty = scenarioFromAnswers({ investment_types: ['401k'], health_insurance: 'employer', employer_401k: 'no_match' })
  assert.equal(empty.id, 'organize')
})

test('every scenario ships a title, evidence, and first moves', () => {
  const cases = [
    deriveScenario(snapshotFor()),
    scenarioFromAnswers({ monthly_income: 4000, monthly_expenses: 4200, health_insurance: 'none', investment_types: ['none'] }),
    scenarioFromAnswers({}),
  ]
  for (const scenario of cases) {
    assert.ok(scenario.chapter.length > 1)
    assert.ok(scenario.title.length > 5)
    assert.ok(scenario.because.length >= 1)
    assert.ok(scenario.firstMoves.length >= 1)
    assert.ok(['this week', 'this month', 'this quarter'].includes(scenario.horizon))
  }
})
