import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildInitialPlan, buildMoneyRoute } from '../src/lib/moneyRoute.js'
import { buildPlanModel, retireMove, staleStepReason } from '../src/lib/focusedPlan.js'
import { filterFreshPlanSteps } from '../src/lib/planReplenishment.js'

// A cushion being built from checking into an existing savings account.
function records({ income = 5000, expenses = 4000, savings = 1500, debts = [] } = {}) {
  return {
    profile: { monthly_income: income, monthly_expenses: expenses, health_insurance: 'employer', employer_401k: 'none', investment_types: ['none'], onboarding_complete: true },
    accounts: [
      { id: 'chk', name: 'Checking', type: 'checking', subtype: 'checking', balance: 800 },
      { id: 'sav', name: 'Ally Savings', type: 'savings', subtype: 'hysa', balance: savings, interest_rate: 4 },
    ],
    debts,
    goals: [],
    cashFlowItems: [],
  }
}

function model(state, plan, extra = {}) {
  const snapshot = computeSnapshot(state)
  const moneyRoute = buildMoneyRoute({ ...state, snapshot })
  return buildPlanModel({ snapshot, plan, moneyRoute, activities: [], now: new Date('2026-09-01T00:00:00Z'), ...extra })
}

// What approving the plan saves: the route's steps with ids of their own.
function approvedPlan(state, tweak = step => step) {
  const snapshot = computeSnapshot(state)
  const steps = buildInitialPlan(buildMoneyRoute({ ...state, snapshot }))
    .map((step, index) => tweak({ ...step, id: `s${index}`, proposed: undefined, done: false }))
  return { id: 'plan', steps }
}

function applyUpdate(plan, review) {
  const patches = new Map(review.updates.map(update => [update.id, update.patch]))
  return { ...plan, steps: plan.steps.map(step => patches.has(step.id) ? { ...step, ...patches.get(step.id) } : step) }
}

test('a raise resizes the saved move in place, with its standing order', () => {
  const plan = approvedPlan(records(), step => step.intentKey === 'fund.emergency_reserve' ? { ...step, due: '2026-10-01', pinnedAt: 'x' } : step)
  const move = plan.steps.find(step => step.intentKey === 'fund.emergency_reserve')
  assert.equal(move.outcome.amount, 1000)

  const review = model(records({ income: 5400 }), plan).review
  assert.equal(review.kind, 'amount_update')
  assert.equal(review.after, 1400)
  assert.equal(review.reason, 'You now have $1,400 a month to direct, up from $1,000, so this move can rise to $1,400/mo from $1,000.')

  const updated = applyUpdate(plan, review)
  const resized = updated.steps.find(step => step.id === move.id)
  assert.equal(resized.text, 'Move $1,400/mo from Checking to Ally Savings')
  assert.equal(resized.outcome.amount, 1400)
  // The user's own things survive the rewrite; the stale guide does not.
  assert.equal(resized.due, '2026-10-01')
  assert.equal(resized.pinnedAt, 'x')
  assert.equal(resized.guide, null)
  const schedule = updated.steps.find(step => step.intentKey === 'setup.fund.emergency_reserve')
  assert.equal(schedule.outcome.amount, 1400)
  assert.equal(updated.steps.length, plan.steps.length, 'resized, not duplicated')

  // Once applied, nothing else is asked, and nothing is proposed twice.
  const after = model(records({ income: 5400 }), updated)
  assert.equal(after.review, null)
  assert.ok(!after.routeCandidates.some(step => step.intentKey === 'fund.emergency_reserve'))
})

test('the arithmetic breathing does not send anyone back to their bank', () => {
  const plan = approvedPlan(records())
  // $1,000 → $1,080: under the 15% line.
  assert.equal(model(records({ income: 5080 }), plan).review, null)
})

test('a smaller surplus shrinks the move, and says why', () => {
  const plan = approvedPlan(records())
  const review = model(records({ income: 4700 }), plan).review
  assert.equal(review.kind, 'amount_update')
  assert.equal(review.reason, 'You now have $700 a month to direct, down from $1,000, so this move should drop to $700/mo from $1,000.')
})

test('higher spending moves both the target and the monthly amount, and says both', () => {
  const plan = approvedPlan(records())
  const review = model(records({ expenses: 4300 }), plan).review
  assert.equal(review.reason, 'Your spending went up, so your target is now $12,900 (was $12,000) and this move drops to $700/mo from $1,000.')
})

test('a standing order already set up at the bank comes back as "change it"', () => {
  const plan = approvedPlan(records(), step => step.intentKey === 'setup.fund.emergency_reserve' ? { ...step, done: true } : step)
  const review = model(records({ income: 5400 }), plan).review
  const change = review.updates.find(update => update.id !== review.step.id).patch
  assert.equal(change.text, 'Change your scheduled $1,000 monthly transfer to $1,400')
  assert.equal(change.done, false)
})

test('keeping the old amount is respected until something else changes', () => {
  const plan = approvedPlan(records())
  const first = model(records({ income: 5400 }), plan)
  const kept = { ...plan, steps: plan.steps.map(step => step.id === first.review.step.id ? { ...step, reviewOverrideFingerprint: first.fingerprint } : step) }
  const again = model(records({ income: 5400 }), kept)
  assert.ok(again.review === null || again.review.step.id !== first.review.step.id)
})

test('a step the user wrote is never resized', () => {
  const plan = approvedPlan(records(), step => ({ ...step, source: 'user' }))
  assert.equal(model(records({ income: 5400 }), plan).review, null)
})

test('reaching the first $1,000 moves the finish line instead of retiring the move', () => {
  const state = records({ savings: 100, expenses: 4000 })
  state.accounts[0].balance = 100
  const plan = approvedPlan(state)
  const move = plan.steps.find(step => step.intentKey === 'fund.emergency_reserve')
  assert.equal(move.outcome.targetAmount, 1000)

  const reached = records({ savings: 1100, expenses: 4000 })
  reached.accounts[0].balance = 100
  const review = model(reached, plan).review
  assert.equal(review.kind, 'amount_update')
  assert.match(review.reason, /^You reached \$1,000\. Next stop: \$12,000/)
})

test('the last month of a rung becomes a one-time finish that ends its standing order', () => {
  // $150 left on the card; the plan was paying $700 extra.
  const card = { id: 'card', name: 'Visa', balance: 3000, interest_rate: 26, minimum_payment: 60 }
  const plan = approvedPlan(records({ savings: 1500, debts: [card] }), step => (
    step.intentKey === 'setup.pay.debt.card' ? { ...step, done: true } : step
  ))
  const review = model(records({ savings: 1500, debts: [{ ...card, balance: 150 }] }), plan).review
  assert.equal(review.kind, 'amount_update')
  assert.equal(review.final, true)
  assert.match(review.reason, /^Only about \$150 is left, so you can clear Visa this month\.$/)
  const updated = applyUpdate(plan, review)
  const finish = updated.steps.find(step => step.intentKey === 'pay.debt.card')
  assert.equal(finish.text, 'Pay off the last $150 of Visa, then stop the $1,000 scheduled payment')
  assert.ok(updated.steps.find(step => step.intentKey === 'setup.pay.debt.card').supersededAt)
  // The freed money goes to the next rung, and the plan never directs more
  // than there is.
  const next = model(records({ savings: 1500, debts: [{ ...card, balance: 150 }] }), updated)
  const committed = [...updated.steps.filter(step => !step.done && !step.supersededAt), ...next.routeCandidates]
    .filter(step => ['transfer', 'contribution', 'debt_payment'].includes(step.outcome?.kind))
    .reduce((sum, step) => sum + step.outcome.amount, 0)
  assert.ok(committed <= 1000, `directs $${committed} of $1,000`)
})

test('a move that finishes this month is never offered a standing order', () => {
  const state = records({ savings: 1500, debts: [{ id: 'card', name: 'Visa', balance: 300, interest_rate: 26, minimum_payment: 25 }] })
  const intents = buildInitialPlan(buildMoneyRoute({ ...state, snapshot: computeSnapshot(state) })).map(step => step.intentKey)
  assert.ok(intents.includes('pay.debt.card'))
  assert.ok(!intents.includes('setup.pay.debt.card'))
})

test('a new expensive debt pauses the savings move instead of doubling the plan', () => {
  const plan = approvedPlan(records())
  const withLoan = records({ debts: [{ id: 'loan', name: 'Repair loan', balance: 2400, interest_rate: 18, minimum_payment: 110 }] })
  const review = model(withLoan, plan).review
  assert.equal(review.kind, 'replace')
  assert.equal(review.step.intentKey, 'fund.emergency_reserve')
  assert.equal(review.reason, 'Your plan now sends this money to Repair loan first, so this $1,000/mo move pauses for now.')
})

test('retiring a finished move retires or stops its standing order', () => {
  const plan = approvedPlan(records())
  const move = plan.steps.find(step => step.intentKey === 'fund.emergency_reserve')
  const now = '2026-09-01T00:00:00.000Z'

  const neverSetUp = retireMove(plan.steps, move.id, { now })
  assert.ok(neverSetUp.find(step => step.intentKey === 'setup.fund.emergency_reserve').supersededAt)
  assert.equal(neverSetUp.length, plan.steps.length)

  const running = plan.steps.map(step => step.intentKey === 'setup.fund.emergency_reserve' ? { ...step, done: true } : step)
  const stopped = retireMove(running, move.id, { now })
  const stop = stopped.find(step => step.intentKey === 'stop.setup.fund.emergency_reserve')
  assert.equal(stop.text, 'Stop the scheduled $1,000 monthly transfer to Ally Savings')
  assert.ok(stopped.find(step => step.intentKey === 'setup.fund.emergency_reserve').supersededAt)
  // It exists because the move is over; judging it by the same record would
  // flag it the moment it appeared.
  assert.equal(staleStepReason(stop, computeSnapshot(records({ savings: 20000 })), [], 'fp'), null)
})

test('a stopped standing order no longer counts as running', () => {
  const state = records()
  const snapshot = computeSnapshot(state)
  const activities = [
    { intent_key: 'setup.fund.emergency_reserve', status: 'applied', amount: 1000, applied_at: '2026-05-01T00:00:00Z' },
    { intent_key: 'stop.setup.fund.emergency_reserve', status: 'applied', applied_at: '2026-07-01T00:00:00Z' },
  ]
  const intents = buildInitialPlan(buildMoneyRoute({ ...state, snapshot, activities })).map(step => step.intentKey)
  assert.ok(intents.includes('setup.fund.emergency_reserve'), 'the next move gets a standing order of its own')
})

test('paying a debt down is progress, not a reason to review; a debt that grew is', () => {
  const card = { id: 'card', name: 'Visa', balance: 3000, interest_rate: 26, minimum_payment: 60 }
  const plan = approvedPlan(records({ savings: 1500, debts: [card] }))
  const step = plan.steps.find(item => item.intentKey === 'pay.debt.card')
  assert.equal(step.basis.balance, 3000)
  const paidDown = computeSnapshot(records({ savings: 1500, debts: [{ ...card, balance: 1500 }] }))
  assert.equal(staleStepReason(step, paidDown, [], 'fp'), null)
  const grew = computeSnapshot(records({ savings: 1500, debts: [{ ...card, balance: 4200 }] }))
  assert.equal(staleStepReason(step, grew, [], 'fp'), 'Visa grew since this step was set, so the amount and order need a fresh look.')
})

test('a replaced step does not block the same move returning under new numbers', () => {
  const existing = [{ text: 'Move $200/mo from Checking to Ally Savings', intentKey: 'fund.emergency_reserve', completionPolicy: 'repeatable', supersededAt: '2026-01-01', outcome: { stateFingerprint: 'a' } }]
  const incoming = [{ text: 'Move $650/mo from Checking to Ally Savings', intentKey: 'fund.emergency_reserve', completionPolicy: 'repeatable', outcome: { stateFingerprint: 'b' } }]
  assert.equal(filterFreshPlanSteps(existing, incoming, { dedupeCompleted: true }).fresh.length, 1)
})

test('two moves into different accounts are two moves, however alike they read', () => {
  const existing = [{ text: 'Move $625/mo from Checking into Roth IRA', intentKey: 'fund.investment.roth', completionPolicy: 'repeatable' }]
  const incoming = [{ text: 'Move $325/mo from Checking into Brokerage', intentKey: 'fund.investment.brk', completionPolicy: 'repeatable' }]
  assert.equal(filterFreshPlanSteps(existing, incoming).fresh.length, 1)
  // Different generators paraphrasing one move are still caught.
  const paraphrase = [{ text: 'Move $625/mo from Checking into your Roth IRA', intentKey: 'roth.contribute' }]
  assert.equal(filterFreshPlanSteps(existing, paraphrase).fresh.length, 0)
})

test('an active money-route move is one standing instruction, never two', () => {
  const existing = [{ text: 'Move $500/mo toward your emergency fund', intentKey: 'fund.emergency_reserve', completionPolicy: 'repeatable', outcome: { stateFingerprint: 'a' } }]
  const incoming = [{ text: 'Move $900/mo from Checking to Ally Savings', intentKey: 'fund.emergency_reserve', completionPolicy: 'repeatable', source: 'money-route', outcome: { stateFingerprint: 'b' } }]
  assert.equal(filterFreshPlanSteps(existing, incoming).fresh.length, 0)
})
