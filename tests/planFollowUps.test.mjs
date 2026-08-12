import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildMoneyRoute } from '../src/lib/moneyRoute.js'
import { planFollowUps, topFollowUps } from '../src/lib/planFollowUps.js'

function routeFor({ profile, accounts = [], debts = [], goals = [] }) {
  const snapshot = computeSnapshot({ profile, accounts, debts, goals, cashFlowItems: [] })
  return buildMoneyRoute({ snapshot, profile, accounts, debts, goals })
}

const STUDENT = {
  profile: { monthly_income: 1450, monthly_expenses: 1200, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
  accounts: [
    { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 420 },
    { id: 's', name: 'Savings', type: 'savings', subtype: 'standard_savings', balance: 150 },
  ],
  debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 26.99, minimum_payment: 25 }],
}

const ids = input => planFollowUps(input).map(item => item.id)

test('no plan means no follow-ups to ask about', () => {
  assert.deepEqual(planFollowUps({ route: { ready: false } }), [])
  assert.deepEqual(planFollowUps({}), [])
  assert.deepEqual(planFollowUps(), [])
})

test('every follow-up keeps the advisor asking one question at a time', () => {
  const route = routeFor(STUDENT)
  const items = planFollowUps({ route, ...STUDENT })
  assert.ok(items.length >= 3)
  for (const item of items) {
    assert.match(item.prompt, /one at a time/)
    assert.ok(item.label && item.question && item.why, `incomplete follow-up: ${item.id}`)
  }
  assert.equal(new Set(items.map(i => i.id)).size, items.length, 'ids must be unique')
})

test('nobody is asked about an employer match they do not have', () => {
  const route = routeFor(STUDENT)
  assert.ok(!ids({ route, ...STUDENT }).includes('match_details'))

  const employed = {
    ...STUDENT,
    profile: { ...STUDENT.profile, employment_type: 'salaried', employer_401k: 'match' },
  }
  assert.ok(ids({ route: routeFor(employed), ...employed }).includes('match_details'))
})

test('an expiring 0% balance is asked about first — it is the biggest swing', () => {
  const promo = {
    ...STUDENT,
    debts: [{ id: 'promo', name: 'Store card', type: 'credit_card', balance: 1200, interest_rate: 0, minimum_payment: 25 }],
  }
  const items = planFollowUps({ route: routeFor(promo), ...promo })
  assert.equal(items[0].id, 'debt_promo')
  assert.match(items[0].question, /Store card/)
})

test('the income question quotes the real monthly figure', () => {
  const route = routeFor(STUDENT)
  const income = planFollowUps({ route, ...STUDENT }).find(item => item.id === 'income_stability')
  assert.match(income.question, new RegExp(`\\$${route.availableMonthlyAmount}`))
  // A student's months are uneven by default, and the reason should say so.
  assert.match(income.why, /uneven/)
})

test('investing questions appear only once investing is actually funded', () => {
  assert.ok(!ids({ route: routeFor(STUDENT), ...STUDENT }).includes('investing_horizon'))

  const investor = {
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', age: 28, employment_type: 'salaried', onboarding_complete: true },
    accounts: [
      { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3000 },
      { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 15000 },
    ],
  }
  assert.ok(ids({ route: routeFor(investor), ...investor }).includes('investing_horizon'))
})

test('rate-cutting is raised for the priciest debt being paid down', () => {
  const route = routeFor(STUDENT)
  const item = planFollowUps({ route, ...STUDENT }).find(i => i.id === 'rate_reduction')
  // The student's $250 all goes to the cushion first, so no debt is funded yet.
  assert.equal(item, undefined)

  const payingDebt = {
    ...STUDENT,
    accounts: [{ id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 8000 }],
  }
  const found = planFollowUps({ route: routeFor(payingDebt), ...payingDebt }).find(i => i.id === 'rate_reduction')
  assert.ok(found, 'a funded high-APR debt should prompt a rate conversation')
  assert.match(found.question, /Credit card/)
  assert.match(found.why, /26\.99%/)
})

test('an undated goal is asked for a date, a dated one is left alone', () => {
  const withGoal = {
    ...STUDENT,
    goals: [{ id: 'g', name: 'Japan trip', target_amount: 3000, current_amount: 0 }],
  }
  const item = planFollowUps({ route: routeFor(withGoal), ...withGoal }).find(i => i.id === 'goal_deadline')
  assert.ok(item)
  assert.match(item.question, /Japan trip/)

  const dated = { ...withGoal, goals: [{ ...withGoal.goals[0], deadline: '2027-06-01' }] }
  assert.ok(!ids({ route: routeFor(dated), ...dated }).includes('goal_deadline'))
})

test('topFollowUps trims to what fits under the plan', () => {
  const route = routeFor(STUDENT)
  const top = topFollowUps({ route, ...STUDENT }, 3)
  assert.equal(top.length, 3)
  assert.deepEqual(top, planFollowUps({ route, ...STUDENT }).slice(0, 3))
})

test('breaking even is asked why, not asked whether $0 swings', () => {
  const evenProfile = {
    profile: { monthly_income: 3000, monthly_expenses: 3000, health_insurance: 'employer', employer_401k: 'none', employment_type: 'salaried', age: 26, onboarding_complete: true },
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 500 }],
  }
  const items = planFollowUps({ route: routeFor(evenProfile), ...evenProfile })
  const ids = items.map(i => i.id)
  assert.ok(ids.includes('break_even'))
  assert.equal(ids.includes('income_stability'), false)
  // No question may quote a $0 monthly figure.
  for (const item of items) assert.ok(!/\$0\b/.test(item.question), `quotes $0: ${item.question}`)
})

const NOW = new Date('2026-08-09').getTime()
const RENTER = {
  profile: { monthly_income: 2600, monthly_expenses: 1500, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
  accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1500 }],
}

test('follow-ups never cover the same ground twice', () => {
  // Five questions fired for a renter, three of them variations of "what might
  // you have to pay for?" — which read as one question asked three ways.
  const input = { ...RENTER, goals: [{ id: 'g', name: 'Semester Rent Payment', target_amount: 4400, current_amount: 0 }] }
  const items = planFollowUps({ route: routeFor(input), ...input, now: NOW })
  const topics = items.map(i => i.topic)
  assert.equal(new Set(topics).size, topics.length, `repeated topics: ${topics.join(', ')}`)
  for (const item of items) assert.ok(item.topic, `${item.id} has no topic`)
})

test('a named goal stops the app asking whether anything big is coming', () => {
  const withGoal = { ...RENTER, goals: [{ id: 'g', name: 'Semester Rent Payment', target_amount: 4400, current_amount: 0 }] }
  assert.equal(ids({ route: routeFor(withGoal), ...withGoal, now: NOW }).includes('upcoming_cost'), false)

  // Nobody has named anything, so the question is worth asking.
  const noGoal = { ...RENTER }
  assert.ok(ids({ route: routeFor(noGoal), ...noGoal, now: NOW }).includes('upcoming_cost'))
})

test('a deadline the plan will miss is raised, with both real dates', () => {
  // Rent due in 4 months; the ladder funds the cushion first and arrives in 7.
  const input = {
    ...RENTER,
    goals: [{ id: 'g', name: 'Semester Rent Payment', target_amount: 4400, current_amount: 0, deadline: '2026-12-01' }],
  }
  const item = planFollowUps({ route: routeFor(input), ...input, now: NOW }).find(i => i.id === 'goal_at_risk')
  assert.ok(item, 'a missed deadline must be surfaced')
  assert.match(item.question, /due in about 4 months/)
  assert.match(item.question, /reaches it in about 7 months/)
  // It asks rather than silently reordering — the tradeoff is the user's.
  assert.match(item.question, /jump the queue/)
})

test('a deadline the plan comfortably meets is left alone', () => {
  const input = {
    ...RENTER,
    goals: [{ id: 'g', name: 'Semester Rent Payment', target_amount: 4400, current_amount: 0, deadline: '2029-01-01' }],
  }
  const list = ids({ route: routeFor(input), ...input, now: NOW })
  assert.equal(list.includes('goal_at_risk'), false)
})

test('a goal with no deadline never invents a deadline problem', () => {
  const input = { ...RENTER, goals: [{ id: 'g', name: 'Semester Rent Payment', target_amount: 4400, current_amount: 0 }] }
  const list = ids({ route: routeFor(input), ...input, now: NOW })
  assert.equal(list.includes('goal_at_risk'), false)
  assert.ok(list.includes('goal_deadline'), 'it should ask for the date instead')
})
