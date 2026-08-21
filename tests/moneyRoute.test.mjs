import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot, LIMITS } from '../src/lib/finance.js'
import { HORIZON_MONTHS, buildInitialPlan, buildMoneyRoute, formatDuration } from '../src/lib/moneyRoute.js'

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
  // "Unsure" is still an answer, so the plan stands. Finding out is a real
  // step, not fine print — but the dollar move leads what the user reads.
  assert.equal(route.ready, true)
  const steps = buildInitialPlan(route)
  assert.equal(steps[0].intentKey, 'pay.debt.card')
  assert.ok(steps.some(step => step.intentKey === 'verify.employer_match'))
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

test('a claimed employer match is a real plan step, just behind the money moves', () => {
  // Regression: found via a live blind-test walkthrough. The user answered
  // "yes, my employer matches" in setup, but because the exact percentages
  // were missing the plan demoted it to an "Optional:" footnote — while the
  // same card's footer claimed free money outranks debt. It is a real step.
  // It sits behind the funded moves only because a plan that opens with "go
  // find something out" is less actionable than one that opens with "move $X".
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
  // The ladder still ranks the match above debt for the arithmetic…
  const keys = route.allocations.map(item => item.key)
  assert.ok(keys.indexOf('capture_employer_match') < keys.findIndex(key => key.startsWith('debt.')))
  // …but the plan a user reads opens with a dollar move, and the match is a
  // real step right behind it — never fine print.
  const steps = buildInitialPlan(route)
  assert.equal(steps[0].intentKey, 'pay.debt.visa')
  assert.ok(steps[0].outcome.amount > 0)
  const matchStep = steps.find(step => step.intentKey.startsWith('capture.employer_match'))
  assert.ok(matchStep, 'claiming the match must be a step in the plan')
  assert.match(matchStep.text, /employer match/i)
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

test('step text names a destination, never a whole sentence', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 1600, monthly_expenses: 1350, health_insurance: 'parent', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 300 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 100 },
    ],
    debts: [{ id: 'card', name: 'Credit card', balance: 600, interest_rate: 24, minimum_payment: 25 }],
  }))
  const steps = buildInitialPlan(route)
  const reserve = steps.find(step => step.intentKey === 'fund.emergency_reserve')
  assert.ok(reserve)
  // "Move $250/mo toward Save your first $1,000" is the failure mode: the card
  // label is a sentence and cannot be spliced in after "toward".
  assert.match(reserve.text, /^Move \$\d+\/mo toward your emergency fund$/)
  for (const step of steps) {
    assert.ok(!/toward (Save|Grow|Build|Pay|Fund|Increase) /.test(step.text), `doubled verb in: ${step.text}`)
    assert.ok(!/destination record/.test(step.doneWhen), `jargon in: ${step.doneWhen}`)
  }
})

test('the ladder carries months, so "next" has a date attached', () => {
  // $250/mo spare, $570 cash, a 26.99% card and a 6.5% loan — the 20-year-old
  // walkthrough profile.
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 1450, monthly_expenses: 1200, health_insurance: 'parents', employer_401k: 'na', age: 20, onboarding_complete: true },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 420 },
      { id: 'savings', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 150 },
    ],
    debts: [
      { id: 'card', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 26.99, minimum_payment: 25 },
      { id: 'loan', name: 'Student loan', balance: 9500, interest_rate: 6.5, minimum_payment: 90 },
    ],
  }))

  // $1,000 − $570 = $430 to go at $250/mo → 2 months.
  const starter = route.allocations.find(item => item.key === 'starter_emergency')
  assert.equal(starter.amount, 250)
  assert.equal(starter.etaMonths, 2)

  // The card waits those 2 months, then takes $900 / $250 = 4 more.
  const card = route.upcoming.find(item => item.key.startsWith('debt.'))
  assert.equal(card.startsInMonths, 2)
  assert.equal(card.etaMonths, 4)

  // The full emergency fund starts after both: 2 + 4 = 6.
  const fullEf = route.upcoming.find(item => item.key === 'full_emergency')
  assert.equal(fullEf.startsInMonths, 6)
})

test('rungs with no finish line are never given an invented date', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 4000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 30, onboarding_complete: true },
    accounts: [{ id: 'savings', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 20000 }],
  }))
  // Cushion is full and there is no debt, so investing leads — and investing has
  // no target, so it must carry neither a duration nor a start month.
  const investing = route.upcoming.find(item => item.key === 'invest_long_term')
  if (investing) {
    assert.equal(investing.etaMonths, undefined)
  }
  for (const item of route.allocations) {
    if (item.key === 'unassigned' || item.key.startsWith('capture_') || item.key.startsWith('confirm_')) {
      assert.equal(item.etaMonths, undefined, `${item.key} must not claim a finish date`)
    }
  }
})

test('a surplus with no accounts and no goals still gets a real, multi-step plan', () => {
  // The reported case: the plan was one line ("Open a long-term investment
  // account") while every spare dollar sat in "unassigned".
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
    ],
  }))

  // Every dollar is assigned — nothing falls through to "unassigned".
  assert.equal(route.allocations.some(item => item.key === 'unassigned'), false)
  assert.equal(route.allocations.reduce((sum, item) => sum + item.amount, 0), 2000)

  // The IRA takes its annual limit spread monthly; the rest has somewhere to go.
  const roth = route.allocations.find(item => item.key === 'open_investment_account')
  const brokerage = route.allocations.find(item => item.key === 'open_taxable_brokerage')
  assert.equal(roth.amount, Math.floor(LIMITS.rothIra / 12))
  assert.equal(brokerage.amount, 2000 - roth.amount)

  // No rung asks the user to go and name a goal. A plan is a list of things to
  // do with money, not a list of app fields to fill in.
  assert.equal(route.allocations.some(item => item.key === 'name_a_goal'), false)

  // Three steps, and the money moves are stated with their amounts.
  const steps = buildInitialPlan(route)
  assert.ok(steps.length >= 3, `expected a multi-step plan, got ${steps.length}`)
  assert.match(steps[0].text, /Open a Roth IRA and set up \$\d+\/mo/)
  // "Open a Roth IRA and start investing and set up $625/mo" — no doubled verb.
  for (const step of steps) assert.ok(!/ and .* and /.test(step.text), `clumsy text: ${step.text}`)
})

test('investing is not listed as upcoming when it is already funded', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
    ],
  }))
  assert.equal(route.upcoming.some(item => item.key === 'invest_long_term'), false)
})

test('investing still appears as upcoming while the cushion is being built', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 800 }],
  }))
  assert.ok(route.upcoming.some(item => item.key === 'invest_long_term'))
  assert.equal(route.allocations.some(item => item.key === 'name_a_goal'), false)
})

test('an IRA never receives more than its annual limit allows', () => {
  // Before this cap the plan told a $2,000/mo saver to put all of it into a
  // Roth IRA — $24,000 a year into an account that takes $7,500.
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
      { id: 'b', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 9100 },
      { id: 'r', name: 'Roth IRA', type: 'brokerage', subtype: 'roth_ira', balance: 4200 },
    ],
  }))
  const monthlyCap = Math.floor(LIMITS.rothIra / 12)
  const ira = route.allocations.find(item => item.key === 'investment.r')
  const taxable = route.allocations.find(item => item.key === 'investment.b')

  // Tax-advantaged first, but only up to the ceiling.
  assert.equal(route.allocations.findIndex(i => i.key === 'investment.r') <
               route.allocations.findIndex(i => i.key === 'investment.b'), true)
  assert.equal(ira.amount, monthlyCap)
  assert.ok(ira.amount * 12 <= LIMITS.rothIra)
  // The overflow still has a home; nothing is stranded.
  assert.equal(taxable.amount, 2000 - monthlyCap)
  assert.equal(route.allocations.some(item => item.key === 'unassigned'), false)
})

test('a taxable-only investor keeps taking the whole surplus', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
      { id: 'b', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 9100 },
    ],
  }))
  // No cap applies, so the uncapped account takes it all in one rung.
  assert.equal(route.allocations.find(item => item.key === 'investment.b').amount, 2000)
})

test('breaking even still gets a first move, not a blank plan', () => {
  // Income exactly equals spending: no deficit to repair, so no rung fired and
  // the plan came out completely empty for the person who needed one most.
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 3000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 500 }],
  }))
  assert.equal(route.availableMonthlyAmount, 0)
  const margin = route.allocations.find(item => item.key === 'find_margin')
  assert.ok(margin, 'breaking even must still produce a rung')

  const steps = buildInitialPlan(route)
  assert.ok(steps.length > 0, 'the plan must never be empty')
  assert.equal(steps[0].intentKey, 'budget.find_first_margin')
  assert.ok(steps[0].doneWhen)
})

test('a real deficit still asks to close the gap, not to find margin', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 2500, monthly_expenses: 3200, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 500 }],
  }))
  assert.ok(route.allocations.some(item => item.key === 'repair_budget'))
  assert.equal(route.allocations.some(item => item.key === 'find_margin'), false)
})

test('a debt with no rate is named rather than silently dropped', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 4000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 }],
    debts: [{ id: 'x', name: 'Old loan', type: 'other', balance: 4000, interest_rate: null, minimum_payment: 50 }],
  }))
  // It cannot be ranked, so it is in no rung — but it must not vanish.
  assert.equal(route.allocations.some(item => item.key.startsWith('debt.')), false)
  assert.ok(route.notes.some(note => note.includes('Old loan') && /no interest rate/.test(note)),
    `unrated debt missing from notes: ${JSON.stringify(route.notes)}`)
})

test('durations stay human at both ends of the scale', () => {
  assert.equal(formatDuration(0), null)
  assert.equal(formatDuration(null), null)
  assert.equal(formatDuration(1), 'about a month')
  assert.equal(formatDuration(2), 'about 2 months')
  assert.equal(formatDuration(23), 'about 23 months')
  assert.equal(formatDuration(24), 'about 2 years')
  assert.equal(formatDuration(30), 'about 3 years')
  assert.equal(formatDuration(120), 'about 10 years')
  // A $5/mo saver reaches investing in 1,920 months. True, and useless.
  assert.equal(formatDuration(1920), 'over 10 years')
  assert.equal(HORIZON_MONTHS, 120)
})

test('debt timelines charge interest and count the minimum payment', () => {
  // $5,000 at 24% with no recorded minimum: division says 34 months, but the
  // interest makes it 56. Being optimistic here is how people mis-plan years.
  const noMinimum = buildMoneyRoute(state({
    profile: { monthly_income: 3150, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 8000 }],
    debts: [{ id: 'a', name: 'Card', type: 'credit_card', balance: 5000, interest_rate: 24, minimum_payment: 0 }],
  }))
  const slow = noMinimum.allocations.find(item => item.key.startsWith('debt.'))
  assert.equal(slow.amount, 150)
  assert.ok(slow.etaMonths > 34, `interest ignored: ${slow.etaMonths}`)

  // The same balance with a $100 minimum clears sooner, because that money
  // lands on it too — dividing the surplus alone misses this entirely.
  const withMinimum = buildMoneyRoute(state({
    profile: { monthly_income: 3150, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 8000 }],
    debts: [{ id: 'a', name: 'Card', type: 'credit_card', balance: 5000, interest_rate: 22, minimum_payment: 100 }],
  }))
  const faster = withMinimum.allocations.find(item => item.key.startsWith('debt.'))
  assert.ok(faster.etaMonths < 34, `minimum payment ignored: ${faster.etaMonths}`)
})

test('the starter cushion says how far along you already are', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 1450, monthly_expenses: 1200, health_insurance: 'parents', employer_401k: 'na', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 420 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 150 },
    ],
  }))
  const starter = route.allocations.find(item => item.key === 'starter_emergency')
  assert.match(starter.reason, /\$570 of \$1,000/)
  assert.match(starter.reason, /\$430 to go/)

  // Starting from nothing, there is no progress worth claiming.
  const empty = buildMoneyRoute(state({
    profile: { monthly_income: 1450, monthly_expenses: 1200, health_insurance: 'parents', employer_401k: 'na', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 0 }],
  }))
  assert.ok(!/of \$1,000/.test(empty.allocations.find(item => item.key === 'starter_emergency').reason))
})

test('automation schedules the largest recurring move, not the first', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
      { id: 'r', name: 'Roth IRA', type: 'brokerage', subtype: 'roth_ira', balance: 4200 },
      { id: 'b', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 9100 },
    ],
  }))
  const automation = buildInitialPlan(route).find(step => step.outcome?.kind === 'recurring_setup')
  assert.ok(automation)
  // $1,375 to the brokerage beats the $625 IRA rung that comes first.
  assert.equal(automation.outcome.amount, 1375)
  assert.match(automation.text, /1,375/)
})

test('a fully funded goal still shows what the money does next', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 4000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 12000 },
    ],
    goals: [{ id: 'g', name: 'Japan trip', target_amount: 5000, current_amount: 500, deadline: '2027-06-01' }],
  }))
  assert.ok(route.allocations.some(item => item.key.startsWith('goal.')))
  assert.ok(route.upcoming.length > 0, 'the plan must not end at the goal')
  assert.ok(route.upcoming.some(item => item.key === 'invest_long_term'))
})

test('one priority absorbing the surplus still yields a plan, not a single move', () => {
  // The reported shape: one rung takes everything, so the plan was the money
  // move plus its automation and nothing else.
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 2600, monthly_expenses: 1500, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1500 }],
    debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 24, minimum_payment: 25 }],
  }))
  const steps = buildInitialPlan(route)
  assert.ok(steps.length >= 3, `expected 3+ steps, got ${steps.length}: ${steps.map(s => s.text).join(' | ')}`)
  assert.ok(steps.length <= 5)

  // The additions are real setup work, each earned by this user's records.
  const intents = steps.map(step => step.intentKey)
  // With nowhere to put the money, the transfer opens the account itself
  // rather than trailing a separate "open an account" step behind it.
  const reserve = steps.find(step => step.intentKey === 'fund.emergency_reserve')
  assert.match(reserve.text, /^Open a savings account and move \$[\d,]+ into it$/)
  assert.equal(intents.includes('open.cushion_savings'), false)
  assert.ok(intents.includes('setup.autopay_minimums'), 'having debt should prompt autopay')
})

test('the automation step sits with the move it automates', () => {
  const route = buildMoneyRoute(state({
    profile: { monthly_income: 2600, monthly_expenses: 1500, health_insurance: 'parents', employer_401k: 'na', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1500 }],
    debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 24, minimum_payment: 25 }],
  }))
  const steps = buildInitialPlan(route)
  const automation = steps.findIndex(step => step.outcome?.kind === 'recurring_setup' && /^Schedule /.test(step.text))
  assert.ok(automation > 0, 'the plan should automate its biggest recurring move')
  // Appended, it landed after the chores and read as unrelated to the transfer.
  assert.match(steps[automation - 1].text, /^Move |^Pay /)
})

test('setup steps are earned, never handed out to pad the list', () => {
  // Cushion already separate and high-yield, no debt: none of the three fire.
  const tidy = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
    ],
  }))
  const intents = buildInitialPlan(tidy).map(step => step.intentKey)
  assert.equal(intents.includes('open.cushion_savings'), false)
  assert.equal(intents.includes('setup.autopay_minimums'), false)
  assert.equal(intents.some(key => key.startsWith('move.savings_to_hysa')), false)

  // A plain savings account worth upgrading does fire — but only once the
  // balance is big enough for the rate to be worth the paperwork.
  const idle = buildMoneyRoute(state({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 15000 },
    ],
  }))
  assert.ok(buildInitialPlan(idle).some(step => step.intentKey.startsWith('move.savings_to_hysa')))

  const broke = buildMoneyRoute(state({
    profile: { monthly_income: 2000, monthly_expenses: 1500, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 0 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 0 },
    ],
  }))
  assert.equal(buildInitialPlan(broke).some(step => step.intentKey.startsWith('move.savings_to_hysa')), false,
    'chasing a rate on $0 is busywork')
})
