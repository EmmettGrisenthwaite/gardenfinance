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

test('an unknown employer match refines the plan rather than withholding it', () => {
  const input = state({
    profile: { monthly_income: 5000, monthly_expenses: 4100, health_insurance: 'employer', employer_401k: 'unsure' },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const route = buildMoneyRoute(input)
  // "Unsure" is still an answer, so the plan stands. Finding out becomes a
  // real step ranked above the debt payoff — a match beats any interest rate,
  // so it must not be demoted to fine print just because the % is unknown.
  assert.equal(route.ready, true)
  const keys = route.allocations.map(item => item.key)
  assert.equal(keys[0], 'confirm_employer_match')
  assert.ok(keys.some(key => key.startsWith('debt.')))
  assert.ok(keys.indexOf('confirm_employer_match') < keys.findIndex(key => key.startsWith('debt.')))
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
  assert.equal(route.refinements.some(item => item.id === 'employer_match_unknown'), false)
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
  assert.equal(route.refinements[0].id, 'debt_payment_gap')
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

test('the plan is withheld until every required input exists', () => {
  // A plan built on half the picture confidently routes money past whatever
  // it was never told about, so it is not shown at all until setup is done.
  const noBalances = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'no_match', onboarding_complete: true },
    accounts: [],
    debts: [],
  }))
  assert.equal(noBalances.ready, false)
  assert.equal(noBalances.missingInputs.some(item => item.id === 'balances'), true)

  const neverAskedAboutDebt = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'no_match' },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 600 }],
    debts: [],
  }))
  assert.equal(neverAskedAboutDebt.ready, false)
  assert.equal(neverAskedAboutDebt.missingInputs.some(item => item.id === 'debts'), true)

  const noCoverageAnswer = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, employer_401k: 'no_match', onboarding_complete: true },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 600 }],
    debts: [],
  }))
  assert.equal(noCoverageAnswer.ready, false)
  assert.equal(noCoverageAnswer.missingInputs.some(item => item.id === 'coverage'), true)
})

test('finishing setup is enough to make the plan ready, with or without debt', () => {
  // onboarding_complete is what distinguishes "no debt" from "never entered",
  // so a genuinely debt-free user who finished setup gets a full plan.
  const debtFree = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'no_match', onboarding_complete: true },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 600 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 1200 },
    ],
    debts: [],
  }))
  assert.equal(debtFree.ready, true)
  assert.deepEqual(debtFree.missingInputs, [])

  const withDebt = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'no_match', onboarding_complete: true },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1800 }],
    debts: [{ id: 'card', name: 'Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  }))
  assert.equal(withDebt.ready, true)
})

test('a ready plan carries no hedging fields at all', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 4500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'no_match', onboarding_complete: true },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1800 }],
    debts: [{ id: 'card', name: 'Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  }))
  assert.equal(route.ready, true)
  assert.equal('chapter' in route, false)
  assert.equal('provisional' in route, false)
  assert.equal('primaryMoveConfident' in route, false)
})

test('the top debt payoff acknowledges an already-covered starter reserve', () => {
  const input = state({
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1800 }],
    debts: [{ id: 'card', name: 'Card', balance: 2400, interest_rate: 24, minimum_payment: 60 }],
  })
  const route = buildMoneyRoute(input)
  assert.match(route.allocations[0].reason, /already have \$1,000 set aside for emergencies/)
})

test('a claimed employer match leads the plan even before the percentage is known', () => {
  // Regression: found via a live blind-test walkthrough. The user answered
  // "yes, my employer matches" in setup, but because the exact percentages
  // were missing the plan sent every dollar to a 26% card and demoted the
  // match to an "Optional:" footnote — while the same card's footer claimed
  // free money outranks debt. Claiming a match is the single highest-return
  // action available, so "go find out and claim it" is itself step one.
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
  const keys = route.allocations.map(item => item.key)
  assert.equal(keys[0], 'capture_employer_match', 'the match must lead the plan')
  assert.ok(keys.indexOf('capture_employer_match') < keys.findIndex(key => key.startsWith('debt.')))
  // It is a real step, not fine print.
  const steps = buildInitialPlan(route)
  assert.equal(steps[0].intentKey.startsWith('capture.employer_match'), true)
  assert.match(steps[0].text, /employer match/i)
})

test('the plan is several real money moves, not one suggestion', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 6000, monthly_expenses: 3500, health_insurance: 'employer', employer_401k: 'no_match', onboarding_complete: true },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 300 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 200 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
    goals: [{ id: 'trip', name: 'Japan trip', target_amount: 5000, current_amount: 0 }],
  }))
  const steps = buildInitialPlan(route)
  // Every funded priority becomes its own step, so this reads as a plan.
  assert.ok(steps.length >= 3, `expected several steps, got ${steps.length}`)
  assert.ok(steps.length <= 5)
  // Money moves come from the calculated waterfall, in ladder order.
  assert.equal(steps[0].intentKey, 'fund.emergency_reserve')
  assert.equal(steps[1].intentKey, 'pay.debt.card')
  // Automating the biggest recurring move earns a place in the plan.
  assert.ok(steps.some(step => step.outcome?.kind === 'recurring_setup'))
  // No duplicate work.
  assert.equal(new Set(steps.map(step => step.intentKey)).size, steps.length)
  for (const step of steps) {
    assert.ok(step.doneWhen)
    assert.equal(step.generatedForFingerprint, route.fingerprint)
  }
})
