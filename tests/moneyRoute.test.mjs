import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildInitialPlan, buildMoneyRoute } from '../src/lib/moneyRoute.js'

function state({
  profile = { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'none' },
  accounts = [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2000 }],
  debts = [],
  goals = [],
  cashFlowItems = [],
} = {}) {
  const snapshot = computeSnapshot({ profile, accounts, debts, goals, cashFlowItems })
  return { snapshot, profile, accounts, debts, goals }
}

test('the monthly waterfall assigns exactly the available amount', () => {
  const input = state({
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 0 },
      { id: 'savings', name: 'Emergency savings', type: 'savings', subtype: 'hysa', balance: 600 },
    ],
    debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.availableMonthlyAmount, 900)
  assert.equal(route.allocations.reduce((sum, item) => sum + item.amount, 0), 900)
  assert.equal(route.allocations[0].key, 'starter_emergency')
  assert.equal(route.allocations[0].amount, 400)
  assert.equal(route.allocations[1].key, 'debt.card')
  assert.equal(route.allocations[1].amount, 500)
})

test('an unknown employer match makes the route provisional without blocking known debt guidance', () => {
  const input = state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'unsure' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.provisional, true)
  assert.equal(route.primaryQuestion.key, 'employer_match')
  assert.equal(route.allocations.some(item => item.destinationType === 'debt' && item.amount === 900), true)
  assert.equal(route.conditionalChanges.length, 1)
})

test('known match details insert only the calculated match increase before debt', () => {
  const input = state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'match' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2000 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1500 },
      { id: 'work', name: 'Work 401(k)', type: 'brokerage', subtype: '401k', balance: 12000,
        contribution_percent: 2, employer_match_percent: 100, employer_match_limit_percent: 5, monthly_contribution: 200 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute(input)
  assert.deepEqual(route.allocations.slice(0, 2).map(item => [item.key, item.amount]), [
    ['capture_employer_match', 300],
    ['debt.card', 600],
  ])
})

test('detailed workplace account evidence overrides an unsure onboarding answer', () => {
  const input = state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'unsure' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2000 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1500 },
      { id: 'work', name: 'Work 401(k)', type: 'brokerage', subtype: '401k', balance: 12000,
        contribution_percent: 5, employer_match_percent: 100, employer_match_limit_percent: 5, monthly_contribution: 500 },
    ],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.blockers.some(item => item.id === 'employer_match_unknown'), false)
  assert.equal(route.primaryQuestion, null)
})

test('detailed debt minimums are reserved once when missing from the monthly plan', () => {
  const profile = { monthly_income: 5000, monthly_expenses: 0, health_insurance: 'employer', employer_401k: 'none' }
  const cashFlowItems = [
    { kind: 'income', group_key: 'income', category_key: 'paycheck', amount: 5000, monthly_amount: 5000 },
    { kind: 'expense', group_key: 'needs', category_key: 'housing', amount: 4000, monthly_amount: 4000 },
  ]
  const input = state({
    profile,
    cashFlowItems,
    accounts: [{ id: 'cash', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2000 }],
    debts: [{ id: 'card', name: 'Card', balance: 1000, interest_rate: 20, minimum_payment: 100 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.availableMonthlyAmount, 900)
  assert.equal(route.blockers[0].id, 'debt_payment_gap')
  assert.equal(route.allocations.reduce((sum, item) => sum + item.amount, 0), 900)
})

test('a deficit produces a repair action and never allocates unavailable money', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 3000, monthly_expenses: 3400, health_insurance: 'employer', employer_401k: 'none' },
  }))
  assert.equal(route.availableMonthlyAmount, 0)
  assert.equal(route.allocations[0].key, 'repair_budget')
  assert.equal(route.allocations[0].targetAmount, 400)
  assert.equal(route.allocations.reduce((sum, item) => sum + item.amount, 0), 0)
})

test('user adjustments cannot exceed the recorded monthly amount', () => {
  const input = state({
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 0 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 600 },
    ],
    debts: [{ id: 'card', name: 'Card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute({ ...input, adjustments: { starter_emergency: 800, 'debt.card': 800 } })
  assert.equal(route.allocations.reduce((sum, item) => sum + item.amount, 0), 900)
  assert.deepEqual(route.allocations.filter(item => item.adjustable).map(item => item.amount), [800, 100])
})

test('the route exposes a reconciliation that sums to the same figure Home shows', () => {
  // "Left over monthly" (Home, via moneyLanguage.js) and the route's
  // available amount must never be two silently different numbers — the
  // route reports every subtraction between them so the UI can show its own
  // total as a visible breakdown of the headline figure, not a second one.
  const cashFlowItems = [
    { kind: 'income', group_key: 'income', category_key: 'paycheck', amount: 4500, monthly_amount: 4500 },
    { kind: 'expense', group_key: 'needs', category_key: 'housing', amount: 3200, monthly_amount: 3200 },
  ]
  const input = state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'none' },
    cashFlowItems,
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1800 }],
    debts: [{ id: 'visa', name: 'Visa Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.reservedAmount, 60)
  const total = route.reconciliation.reduce((sum, line) => sum + line.amount, 0)
  assert.equal(Math.round(total), route.availableMonthlyAmount)
  assert.equal(route.reconciliation[0].label, 'Left over monthly')
  assert.equal(route.reconciliation[0].amount, 1300)
})

test('the top move is reported confident even while the route stays provisional', () => {
  const input = state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'unsure' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.provisional, true)
  assert.equal(route.primaryMoveConfident, true)
})

test('the top debt payoff acknowledges an already-covered starter reserve', () => {
  const input = state({
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1800 }],
    debts: [{ id: 'card', name: 'Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  })
  const route = buildMoneyRoute(input)
  assert.match(route.allocations[0].reason, /starter reserve is already covered/)
})

test('an unconfirmed employer match outranks a debt-bookkeeping reconciliation blocker', () => {
  // Regression: found via a live blind-test walkthrough. A user who told
  // onboarding "yes, my employer matches" but hasn't added the workplace
  // account yet, PLUS has a debt whose minimum isn't itemized in the Monthly
  // Plan, produces two blockers. MoneyRouteCard only ever headlines
  // blockers[0] — the higher-value "capture the match" fact must win that
  // slot over a low-stakes accounting nit that doesn't change any amount.
  const cashFlowItems = [
    { kind: 'income', group_key: 'income', category_key: 'paycheck', amount: 4500, monthly_amount: 4500 },
    { kind: 'expense', group_key: 'needs', category_key: 'housing', amount: 3200, monthly_amount: 3200 },
  ]
  const input = state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'match' },
    cashFlowItems,
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 1200 },
    ],
    debts: [{ id: 'visa', name: 'Visa Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  })
  const route = buildMoneyRoute(input)
  assert.equal(route.blockers.some(item => item.id === 'employer_match_details'), true)
  assert.equal(route.blockers.some(item => item.id === 'debt_payment_gap'), true)
  assert.equal(route.blockers[0].id, 'employer_match_details')
})

test('approval creates no more than three structured focused steps', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'unsure' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  }))
  const steps = buildInitialPlan(route)
  assert.equal(steps.length, 3)
  assert.equal(steps[0].intentKey, 'verify.employer_match')
  assert.equal(steps[1].intentKey, 'pay.debt.card')
  assert.equal(steps[2].outcome.kind, 'recurring_setup')
  for (const step of steps) {
    assert.ok(step.doneWhen)
    assert.equal(step.generatedForFingerprint, route.fingerprint)
  }
})
