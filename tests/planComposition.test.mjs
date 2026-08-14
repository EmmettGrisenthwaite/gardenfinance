import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { registryLinksFor } from '../src/lib/providerLinks.js'
import { buildInitialPlan, buildMoneyRoute } from '../src/lib/moneyRoute.js'
import {
  MAX_PER_TOPIC,
  PLAN_MAX,
  PLAN_MIN,
  composePlan,
  eligibleBackfill,
  stepKind,
  stepTopic,
} from '../src/lib/planComposition.js'

function planFor(input) {
  const snapshot = computeSnapshot({ ...input, cashFlowItems: input.cashFlowItems || [] })
  const route = buildMoneyRoute({ snapshot, ...input })
  return { route, steps: buildInitialPlan(route) }
}

// ── Eight people the plan has to work for ────────────────────────────────────

const PEOPLE = {
  'a student who breaks even': {
    profile: { monthly_income: 1450, monthly_expenses: 1450, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 210 }],
    debts: [{ id: 'card', name: 'Store card', type: 'credit_card', balance: 640, interest_rate: 26.99, minimum_payment: 25 }],
  },

  'a young professional with a match and a card': {
    profile: { monthly_income: 4200, monthly_expenses: 3400, health_insurance: 'employer', employer_401k: 'match', age: 26, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 900 },
      { id: 'w', name: 'Work 401(k)', type: 'brokerage', subtype: '401k', balance: 8000, contribution_percent: 2, employer_match_percent: 100, employer_match_limit_percent: 5, monthly_contribution: 168 },
    ],
    debts: [{ id: 'visa', name: 'Visa Card', type: 'credit_card', balance: 4200, interest_rate: 23.9, minimum_payment: 110 }],
  },

  'a high earner with a big surplus and no accounts': {
    profile: { monthly_income: 9000, monthly_expenses: 4500, health_insurance: 'employer', employer_401k: 'no_match', age: 31, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 6000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 20000 },
    ],
    debts: [],
  },

  'a freelancer carrying a 0% promo balance': {
    profile: { monthly_income: 3800, monthly_expenses: 2900, health_insurance: 'marketplace', employer_401k: 'na', age: 29, employment_type: 'freelance', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1500 }],
    debts: [{ id: 'promo', name: 'Store card', type: 'credit_card', balance: 1800, interest_rate: 0, minimum_payment: 40 }],
  },

  'someone spending more than they earn': {
    profile: { monthly_income: 3000, monthly_expenses: 3400, health_insurance: 'employer', employer_401k: 'none', age: 34, employment_type: 'salaried', onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 300 }],
    debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 2200, interest_rate: 21, minimum_payment: 60 }],
  },

  'someone whose money is already sorted': {
    profile: { monthly_income: 7000, monthly_expenses: 4000, health_insurance: 'employer', employer_401k: 'no_match', age: 41, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 5000 },
      { id: 's', name: 'Emergency savings', type: 'savings', subtype: 'hysa', balance: 30000 },
      { id: 'r', name: 'Roth IRA', type: 'brokerage', subtype: 'roth_ira', balance: 45000, monthly_contribution: 583 },
      { id: 'b', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 60000 },
    ],
    debts: [],
    goals: [{ id: 'g', name: 'House deposit', target_amount: 60000, current_amount: 12000, monthly_contribution: 1200 }],
  },

  'someone with three credit cards': {
    profile: { monthly_income: 5200, monthly_expenses: 3600, health_insurance: 'employer', employer_401k: 'none', age: 33, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1200 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 2500 },
    ],
    debts: [
      { id: 'a', name: 'Amex', type: 'credit_card', balance: 3000, interest_rate: 25.9, minimum_payment: 80 },
      { id: 'b', name: 'Visa', type: 'credit_card', balance: 5500, interest_rate: 22.4, minimum_payment: 130 },
      { id: 'd', name: 'Store card', type: 'credit_card', balance: 900, interest_rate: 19.9, minimum_payment: 30 },
    ],
  },

  'someone with a goal and a deadline': {
    profile: { monthly_income: 4000, monthly_expenses: 3100, health_insurance: 'employer', employer_401k: 'none', age: 27, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 800 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
    ],
    debts: [],
    goals: [{ id: 'rent', name: 'Semester rent', target_amount: 4800, current_amount: 600, deadline: '2026-12-01' }],
  },
}

// ── The contract, checked against every one of them ──────────────────────────

for (const [who, input] of Object.entries(PEOPLE)) {
  test(`${who} gets a plan of ${PLAN_MIN} to ${PLAN_MAX} real steps`, () => {
    const { steps } = planFor(input)
    assert.ok(steps.length >= PLAN_MIN, `${who}: only ${steps.length} steps`)
    assert.ok(steps.length <= PLAN_MAX, `${who}: ${steps.length} steps is too many`)
    assert.equal(new Set(steps.map(step => step.intentKey)).size, steps.length, `${who}: duplicate work`)
    for (const step of steps) {
      assert.ok(step.text && step.text.length <= 140, `${who}: bad text "${step.text}"`)
      assert.ok(step.doneWhen, `${who}: "${step.text}" has no finish line`)
      assert.ok(step.detail, `${who}: "${step.text}" never says why`)
    }
  })

  test(`${who} gets both their own specifics and general good practice`, () => {
    const { steps } = planFor(input)
    const kinds = new Set(steps.map(stepKind))
    assert.ok(kinds.has('personal'), `${who}: nothing in this plan is about their actual money`)
    assert.ok(kinds.has('practice'), `${who}: no general guidance, just a calculator`)
  })

  test(`${who} does not get a plan about one thing five times`, () => {
    const { steps } = planFor(input)
    const counts = new Map()
    for (const step of steps) {
      // An automation step is the same move made durable, not a second opinion.
      if (String(step.intentKey).startsWith('setup.') && step.intentKey !== 'setup.autopay_minimums') continue
      const topic = stepTopic(step)
      counts.set(topic, (counts.get(topic) || 0) + 1)
    }
    for (const [topic, count] of counts) {
      assert.ok(count <= MAX_PER_TOPIC, `${who}: ${count} steps all about ${topic}`)
    }
    assert.ok(counts.size >= 2, `${who}: the whole plan is about ${[...counts.keys()][0]}`)
  })
}

// ── The cases that motivated the rules ───────────────────────────────────────

test('three cards do not crowd out the rest of the plan', () => {
  const { steps } = planFor(PEOPLE['someone with three credit cards'])
  const topics = steps.map(stepTopic)
  assert.ok(topics.filter(topic => topic === 'debt').length <= MAX_PER_TOPIC)
  assert.ok(new Set(topics).size >= 2, 'a three-card plan still has to look at the rest of their money')
})

test('a sorted user still gets a plan, from the practice bank', () => {
  const { steps } = planFor(PEOPLE['someone whose money is already sorted'])
  assert.ok(steps.length >= PLAN_MIN)
  assert.ok(steps.some(step => String(step.intentKey).startsWith('habit.')),
    'with nothing urgent left, general practice is what remains worth saying')
})

test('the leading step is still the money move the waterfall chose', () => {
  const { route, steps } = planFor(PEOPLE['a young professional with a match and a card'])
  // Composition decides what gets a slot. It never reorders the ladder, so the
  // first thing read is still the first thing the arithmetic picked — here the
  // $100 that tops up a starter cushion before the match or the card.
  const firstFunded = route.allocations.find(item => item.amount > 0)
  assert.equal(firstFunded.key, 'starter_emergency')
  assert.equal(steps[0].intentKey, 'fund.emergency_reserve')
  // And the ladder's own order survives inside the plan.
  const order = steps.map(step => step.intentKey)
  assert.ok(order.indexOf('capture.employer_match.w') < order.indexOf('pay.debt.visa'))
})

test('a break-even plan is a plan, not a single line', () => {
  const { steps } = planFor(PEOPLE['a student who breaks even'])
  assert.ok(steps.length >= PLAN_MIN)
  assert.ok(steps.some(step => step.intentKey === 'budget.find_first_margin'))
  assert.ok(steps.some(step => stepKind(step) === 'practice'))
})

test('a deficit plan leads with closing the gap', () => {
  const { steps } = planFor(PEOPLE['someone spending more than they earn'])
  assert.equal(stepTopic(steps[0]), 'budget')
  assert.ok(steps.length >= PLAN_MIN)
})

// ── The composer itself, away from the ladder ────────────────────────────────

const personal = (intentKey, priorityKey) => ({ intentKey, priorityKey, text: intentKey })
const practice = (intentKey, priorityKey = 'grow') => ({ intentKey, priorityKey, text: intentKey })

test('classification defaults to personal, so the spread rule cannot be gamed', () => {
  assert.equal(stepKind({ intentKey: 'pay.debt.visa' }), 'personal')
  assert.equal(stepKind({ intentKey: 'something.unrecognised' }), 'personal')
  assert.equal(stepKind({ intentKey: 'setup.autopay_minimums' }), 'practice')
  assert.equal(stepKind({ intentKey: 'habit.weekly_checkin' }), 'practice')
  assert.equal(stepKind({ intentKey: 'move.savings_to_hysa.s' }), 'practice')
})

test('an automation step never takes a slot its parent did not get', () => {
  const pool = [
    personal('pay.debt.a', 'kill_debt'),
    personal('setup.pay.debt.b', 'kill_debt'), // orphan — parent is not here
  ]
  const { steps } = composePlan(pool, { backfill: [], min: 1, max: 5 })
  assert.deepEqual(steps.map(step => step.intentKey), ['pay.debt.a'])
})

test('a rider does not count against its topic, so the move keeps its automation', () => {
  const pool = [
    personal('pay.debt.a', 'kill_debt'),
    personal('setup.pay.debt.a', 'kill_debt'),
    personal('pay.debt.b', 'kill_debt'),
    personal('pay.debt.c', 'kill_debt'),
    practice('setup.autopay_minimums', 'kill_debt'),
  ]
  const { steps } = composePlan(pool, { backfill: [], min: 3, max: 5 })
  assert.ok(steps.some(step => step.intentKey === 'setup.pay.debt.a'))
  assert.equal(steps.filter(step => step.intentKey.startsWith('pay.debt.')).length, MAX_PER_TOPIC)
})

test('a full plan of one kind gives up a slot to span both', () => {
  const pool = [
    personal('pay.debt.a', 'kill_debt'),
    personal('fund.emergency_reserve', 'starter_ef'),
    personal('fund.goal.x', 'goal'),
    personal('fund.investment.y', 'invest'),
    personal('capture.employer_match.z', 'capture_match'),
    practice('setup.autopay_minimums', 'kill_debt'),
  ]
  const result = composePlan(pool, { backfill: [], min: 3, max: 5 })
  assert.equal(result.steps.length, PLAN_MAX)
  assert.ok(result.kinds.practice >= 1, 'a five-step plan of pure arithmetic is the failure this rule exists for')
  assert.ok(result.kinds.personal >= 1)
})

test('a short plan is topped up rather than left as one line', () => {
  const pool = [personal('budget.find_first_margin', 'deficit')]
  const backfill = [practice('habit.weekly_checkin'), practice('habit.credit_report')]
  const { steps } = composePlan(pool, { backfill, min: 3, max: 5 })
  assert.equal(steps.length, 3)
  assert.equal(steps[0].intentKey, 'budget.find_first_margin')
})

test('a plan is left short rather than padded with something untrue', () => {
  const pool = [personal('budget.find_first_margin', 'deficit')]
  const { steps, unmetKind } = composePlan(pool, { backfill: [], min: 3, max: 5 })
  assert.equal(steps.length, 1)
  assert.equal(unmetKind, 'practice')
})

test('the practice bank only offers what is not already true of someone', () => {
  const withDebt = eligibleBackfill({ expenses: 2000, debts: [{ balance: 500 }] })
  assert.ok(!withDebt.some(entry => entry.intentKey === 'habit.autopay_bills'),
    'autopay-your-bills duplicates the funded autopay-your-minimums rung')

  const noDebt = eligibleBackfill({ expenses: 2000, debts: [] })
  assert.ok(noDebt.some(entry => entry.intentKey === 'habit.autopay_bills'))

  const noSpending = eligibleBackfill({ expenses: 0, debts: [] })
  assert.ok(!noSpending.some(entry => entry.intentKey === 'habit.subscription_audit'),
    'auditing subscriptions needs recorded spending to be worth saying')

  const already = eligibleBackfill({ expenses: 2000, debts: [] }, new Set(['habit.weekly_checkin']))
  assert.ok(!already.some(entry => entry.intentKey === 'habit.weekly_checkin'))
})

// ── Steps are things you do in the world, not things you type into this app ──

test('no plan step is app housekeeping', () => {
  // The reported plan contained "Name something you are saving for" and
  // "Work out your leanest realistic month" — one is data entry, the other is
  // homework. A plan is a list of things to do with money.
  const APP_CHORE = /\b(name (something|one thing)|record it here|save(d)? (it )?here|in your Plan\b|appears in Money|write (it )?down|work out your)\b/i
  const OUTCOME_IN_APP = /\b(is saved here|updated here|recorded in Money|in the Monthly Plan)\b/i

  const scenarios = [
    { name: 'surplus, no accounts', profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
      accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 }, { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 }], debts: [], goals: [] },
    { name: '20yo with a card', profile: { monthly_income: 1450, monthly_expenses: 1200, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
      accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 420 }],
      debts: [{ id: 'd', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 26.99, minimum_payment: 25 }], goals: [] },
    { name: 'breaking even', profile: { monthly_income: 3000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
      accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 500 }], debts: [], goals: [] },
    { name: 'idle savings', profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', onboarding_complete: true },
      accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 }, { id: 's', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 15000 }], debts: [], goals: [] },
  ]

  for (const scenario of scenarios) {
    const snapshot = computeSnapshot({ ...scenario, cashFlowItems: [] })
    const route = buildMoneyRoute({ snapshot, ...scenario })
    for (const step of buildInitialPlan(route)) {
      assert.ok(!APP_CHORE.test(step.text), `${scenario.name}: app chore as a step — "${step.text}"`)
      assert.ok(!OUTCOME_IN_APP.test(step.doneWhen || ''), `${scenario.name}: done-when is about this app — "${step.doneWhen}"`)
      // Every step names an action, and says how you know it is finished.
      assert.ok(step.doneWhen && step.doneWhen.length > 10, `${scenario.name}: no done-when on "${step.text}"`)
    }
  }
})

test('steps that need a provider carry real links', () => {
  const scenario = {
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 }, { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 }],
    debts: [], goals: [],
  }
  const snapshot = computeSnapshot({ ...scenario, cashFlowItems: [] })
  const steps = buildInitialPlan(buildMoneyRoute({ snapshot, ...scenario }))

  const opening = steps.find(step => /^Open a Roth IRA/.test(step.text))
  assert.ok(opening, 'this profile should be told to open a Roth IRA')
  const links = registryLinksFor(opening.text)
  assert.ok(links.length > 0, 'an account-opening step must carry somewhere to open it')
  for (const link of links) assert.match(link.url, /^https:\/\//)

  // And a step with nowhere to go gets no invented link.
  assert.deepEqual(registryLinksFor('Put every debt minimum on autopay'), [])
})
