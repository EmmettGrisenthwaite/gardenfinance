import test from 'node:test'
import assert from 'node:assert/strict'

import { computeSnapshot, financialPriorities, nextDollar } from '../src/lib/finance.js'
import {
  buildFocusCandidates,
  buildPlanModel,
  focusPlanFingerprint,
  mergeFocusWording,
  orderFocusSteps,
  staleStepReason,
  validateFocusPlanResult,
} from '../src/lib/focusedPlan.js'

function snapshot(overrides = {}) {
  return computeSnapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3200, health_insurance: 'employer', investment_types: ['401k'] },
    accounts: [
      { id: 'checking', name: 'Checking', type: 'checking', subtype: 'checking', balance: 3500 },
      { id: 'savings', name: 'Emergency Savings', type: 'savings', subtype: 'hysa', balance: 12000, interest_rate: 4 },
      { id: '401k', name: 'Work 401(k)', type: 'investment', subtype: '401k', balance: 20000, contribution_percent: 5 },
    ],
    debts: [],
    goals: [],
    ...overrides,
  })
}

test('financial priorities preserve the ladder and nextDollar compatibility', () => {
  const state = snapshot({
    profile: { monthly_income: 4000, monthly_expenses: 4500, health_insurance: 'none', investment_types: [] },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', balance: 200 }],
    debts: [{ id: 'card', name: 'Card', balance: 2000, interest_rate: 24, minimum_payment: 75 }],
  })
  const keys = financialPriorities(state).map(priority => priority.key)
  assert.deepEqual(keys.slice(0, 4), ['deficit', 'insurance', 'starter_ef', 'kill_debt'])
  assert.deepEqual(nextDollar(state), financialPriorities(state)[0])
})

test('a spending deficit and excessive allocations are distinguished', () => {
  const deficit = snapshot({ profile: { monthly_income: 3000, monthly_expenses: 3400, health_insurance: 'employer' } })
  assert.equal(financialPriorities(deficit)[0].key, 'deficit')

  const overcommitted = snapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3000, health_insurance: 'employer' },
    cashFlowItems: [
      { kind: 'income', amount: 5000, monthly_amount: 5000 },
      { kind: 'expense', group_key: 'needs', amount: 3000, monthly_amount: 3000 },
      { kind: 'allocation', group_key: 'future', amount: 2500, monthly_amount: 2500 },
    ],
  })
  assert.equal(financialPriorities(overcommitted)[0].key, 'overcommitted')
})

test('every verified financial-priority branch keeps its intended order', () => {
  const insured = { monthly_income: 5000, monthly_expenses: 1000, health_insurance: 'employer', investment_types: ['401k'] }
  const ampleCash = [{ id: 'cash', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 10000 }]

  assert.equal(financialPriorities(snapshot({
    profile: { ...insured, health_insurance: 'none' }, accounts: ampleCash,
  }))[0].key, 'insurance')
  assert.equal(financialPriorities(snapshot({
    profile: insured, accounts: [{ id: 'cash', name: 'Checking', type: 'checking', balance: 200 }],
  }))[0].key, 'starter_ef')
  assert.equal(financialPriorities(snapshot({
    profile: insured,
    accounts: [...ampleCash, { id: 'work', name: '401(k)', type: 'investment', subtype: '401k', balance: 10000, employer_match_percent: 100, employer_match_limit_percent: 5, contribution_percent: 2 }],
  }))[0].key, 'capture_match')
  assert.equal(financialPriorities(snapshot({
    profile: insured, accounts: ampleCash,
    debts: [{ id: 'card', name: 'Card', balance: 1000, interest_rate: 22, minimum_payment: 50 }],
  }))[0].key, 'kill_debt')
  assert.equal(financialPriorities(snapshot({
    profile: insured, accounts: [{ id: 'cash', name: 'Savings', type: 'savings', balance: 1500 }],
  }))[0].key, 'build_ef')
  assert.equal(financialPriorities(snapshot({
    profile: insured, accounts: ampleCash,
    goals: [{ id: 'goal', name: 'Home', target_amount: 20000, current_amount: 1000 }],
  }))[0].key, 'goal')
  assert.equal(financialPriorities(snapshot({
    profile: { ...insured, investment_types: [] }, accounts: ampleCash,
  }))[0].key, 'roth')

  const growing = financialPriorities(snapshot({
    profile: insured,
    accounts: [...ampleCash, { id: 'invest', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 1000 }],
  })).map(priority => priority.key)
  assert.deepEqual(growing.slice(0, 2), ['invest', 'assign_cash'])

  const balanced = snapshot({
    profile: { ...insured, monthly_income: 1000, monthly_expenses: 1000 },
    accounts: [...ampleCash, { id: 'invest', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', balance: 1000 }],
  })
  assert.equal(financialPriorities(balanced)[0].key, 'grow')
})

test('the shared model gives Plan and Home one prerequisite before generating new positions', () => {
  const state = snapshot()
  const model = buildPlanModel({
    snapshot: state,
    setupState: { next: { id: 'debt_rate', label: 'Add debt APRs', cta: 'Add rates', sheet: 'debts' } },
    plan: { steps: [{ id: 'manual', text: 'Cancel unused gym membership', source: 'user', done: false }] },
    now: new Date('2026-07-17T12:00:00Z'),
  })
  assert.equal(model.prerequisite.sheet, 'debts')
  assert.equal(model.focus.length, 1)
  assert.equal(model.focus[0].id, 'manual')
  assert.equal(model.candidates.length, 0)
})

test('existing work fills focus first and every extra step is preserved in Later', () => {
  const steps = [1, 2, 3, 4, 5].map(index => ({
    id: `s${index}`,
    text: `Complete concrete task ${index}`,
    source: index === 5 ? 'user' : 'advisor',
    done: false,
    addedAt: `2026-07-0${index}T12:00:00Z`,
  }))
  const model = buildPlanModel({ snapshot: snapshot(), plan: { steps } })
  assert.equal(model.focus.length, 3)
  assert.deepEqual(model.later.map(step => step.id), ['s4', 's5'])
  assert.equal(model.focus.some(step => step.proposed), false)
})

test('Make next pins a step ahead of deadlines and ranking', () => {
  const ordered = orderFocusSteps([
    { id: 'debt', text: 'Pay the card', priorityKey: 'kill_debt', due: '2026-07-18' },
    { id: 'manual', text: 'Call my accountant', source: 'user', pinnedAt: '2026-07-17T12:00:00Z' },
  ])
  assert.equal(ordered[0].id, 'manual')
})

test('candidate briefs create a measurable 90-day sprint without vague filler', () => {
  const state = snapshot({
    goals: [{ id: 'house', name: 'House fund', target_amount: 20000, current_amount: 5000, monthly_contribution: 400 }],
  })
  const candidates = buildFocusCandidates({
    snapshot: state,
    plan: { steps: [] },
    now: new Date('2026-07-17T12:00:00Z'),
    fingerprint: 'focus-test',
  })
  assert.equal(candidates.length >= 3, true)
  assert.deepEqual(candidates.slice(0, 3).map(step => step.due), ['2026-08-17', '2026-09-17', '2026-10-17'])
  for (const step of candidates.slice(0, 3)) {
    assert.match(step.text, /\$400/)
    assert.ok(step.doneWhen)
    assert.doesNotMatch(step.text, /learn about|consider|look into/i)
  }
})

test('active reminders suppress only a duplicate recurring setup proposal', () => {
  const state = snapshot({
    goals: [{ id: 'house', name: 'House fund', target_amount: 20000, current_amount: 5000, monthly_contribution: 400 }],
  })
  const reminders = [{ status: 'active', metadata: { intent_key: 'setup.goal.first_contribution' } }]
  const candidates = buildFocusCandidates({
    snapshot: state, plan: { steps: [] }, reminders,
    now: new Date('2026-07-17T12:00:00Z'), fingerprint: 'focus-test',
  })
  assert.equal(candidates.some(step => step.intentKey === 'setup.goal.first_contribution'), false)
  assert.equal(candidates.some(step => step.outcome?.kind === 'contribution'), true)
})

test('reminder timing and wording do not change Plan fingerprints', () => {
  const state = snapshot()
  const first = focusPlanFingerprint({
    snapshot: state,
    reminders: [{ status: 'active', title: 'First wording', next_due_on: '2026-07-20', metadata: { intent_key: 'setup.goal.first_contribution' } }],
  })
  const second = focusPlanFingerprint({
    snapshot: state,
    reminders: [{ status: 'active', title: 'Different wording', next_due_on: '2027-01-01', metadata: { intent_key: 'setup.goal.first_contribution' } }],
  })
  assert.equal(first, second)
})

test('mixed chapters fill remaining slots from the next verified priority', () => {
  const state = snapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3200, health_insurance: 'none', investment_types: ['401k'] },
  })
  const candidates = buildFocusCandidates({
    snapshot: state, plan: { steps: [] }, now: new Date('2026-07-17T12:00:00Z'), fingerprint: 'focus-test',
  })
  assert.deepEqual(candidates.slice(0, 3).map(step => step.priorityKey), ['insurance', 'insurance', 'invest'])
})

test('new recurring commitments never exceed available monthly cash', () => {
  const noRoom = snapshot({
    profile: { monthly_income: 3200, monthly_expenses: 3200, health_insurance: 'employer', investment_types: [] },
    accounts: [{ id: 'cash', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 12000 }],
  })
  const candidates = buildFocusCandidates({ snapshot: noRoom, plan: { steps: [] }, fingerprint: 'focus-test' })
  assert.equal(candidates.some(step => step.intentKey === 'fund.roth_ira'), false)
  for (const step of candidates) {
    if (step.outcome?.recurrence && step.outcome?.amount) assert.ok(step.outcome.amount <= noRoom.unallocated)
  }
})

test('completed permanent intents and matching applied activities are never proposed again', () => {
  const state = snapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3200, health_insurance: 'employer', investment_types: [] },
    accounts: [{ id: 'checking', name: 'Checking', type: 'checking', balance: 6000 }],
  })
  const candidates = buildFocusCandidates({
    snapshot: state,
    plan: { steps: [{ text: 'Open a Roth IRA', done: true, intentKey: 'open.roth_ira', completionPolicy: 'once' }] },
    activities: [{ intent_key: 'fund.roth_ira', status: 'applied' }],
    fingerprint: 'focus-test',
  })
  assert.equal(candidates.some(step => step.intentKey === 'open.roth_ira'), false)
  assert.equal(candidates.some(step => step.intentKey === 'fund.roth_ira'), false)
})

test('legacy active work blocks a semantically identical financial priority', () => {
  const state = snapshot({
    debts: [{ id: 'card', name: 'Credit card', balance: 3400, interest_rate: 24, minimum_payment: 85 }],
  })
  const candidates = buildFocusCandidates({
    snapshot: state,
    plan: { steps: [{ id: 'legacy', text: 'Wipe out your $3,400 credit card debt ASAP', done: false, source: 'advisor' }] },
    fingerprint: 'focus-test',
  })
  assert.equal(candidates.some(step => step.priorityKey === 'kill_debt'), false)
})

test('generated account, insurance, debt, match, reserve, and goal work becomes stale from structured facts', () => {
  const current = snapshot({
    profile: { monthly_income: 5000, monthly_expenses: 3200, health_insurance: 'employer', investment_types: ['401k'] },
    accounts: [
      { id: 'roth', name: 'Roth IRA', type: 'investment', subtype: 'roth_ira', balance: 1000 },
      { id: 'work', name: 'Work 401(k)', type: 'investment', subtype: '401k', balance: 10000, contribution_percent: 5, employer_match_limit_percent: 5, employer_match_percent: 100 },
      { id: 'cash', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 10000 },
    ],
    debts: [],
    goals: [{ id: 'g', name: 'Trip', target_amount: 1000, current_amount: 1000 }],
  })
  const fp = focusPlanFingerprint({ snapshot: current, plan: { steps: [] } })
  const cases = [
    { source: 'focus', intentKey: 'open.roth_ira', priorityKey: 'roth', generatedForFingerprint: 'old' },
    { source: 'focus', intentKey: 'enroll.health_insurance', priorityKey: 'insurance', generatedForFingerprint: 'old' },
    { source: 'focus', intentKey: 'pay.debt.card', priorityKey: 'kill_debt', basis: { recordType: 'debt', recordId: 'card', recordName: 'Card', balance: 2000 } },
    { source: 'focus', intentKey: 'capture.employer_match.work', priorityKey: 'capture_match', basis: { recordType: 'account', recordId: 'work' } },
    { source: 'focus', intentKey: 'fund.emergency_reserve', priorityKey: 'starter_ef', generatedForFingerprint: 'old' },
    { source: 'focus', intentKey: 'fund.goal.g', priorityKey: 'goal', basis: { recordType: 'goal', recordId: 'g', recordName: 'Trip', target: 1000 } },
  ]
  for (const step of cases) assert.ok(staleStepReason(step, current, [], fp), step.intentKey)
})

test('manual work is never marked stale and Keep lasts only for the current fingerprint', () => {
  const current = snapshot()
  const plan = { steps: [] }
  const fp = focusPlanFingerprint({ snapshot: current, plan })
  assert.equal(staleStepReason({ source: 'user', text: 'Open another Roth IRA', intentKey: 'open.roth_ira' }, current, [], fp), null)
  assert.equal(staleStepReason({
    source: 'focus', priorityKey: 'starter_ef', generatedForFingerprint: 'old', reviewOverrideFingerprint: fp,
  }, current, [], fp), null)
  assert.ok(staleStepReason({
    source: 'focus', priorityKey: 'starter_ef', generatedForFingerprint: 'old', reviewOverrideFingerprint: fp,
  }, current, [], 'focus-v1-changed'))
})

test('changed rates, applied setups, and unaffordable commitments trigger one review', () => {
  const current = snapshot({
    profile: { monthly_income: 4000, monthly_expenses: 3900, health_insurance: 'employer', investment_types: ['401k'] },
    debts: [{ id: 'card', name: 'Card', balance: 1800, interest_rate: 18, minimum_payment: 60 }],
  })
  const fp = focusPlanFingerprint({ snapshot: current, plan: { steps: [] } })
  assert.match(staleStepReason({
    source: 'focus', priorityKey: 'kill_debt', intentKey: 'pay.debt.card',
    basis: { recordType: 'debt', recordId: 'card', recordName: 'Card', balance: 2000, rate: 24, monthlyCapacity: 100 },
  }, current, [], fp), /APR changed/)
  assert.match(staleStepReason({
    source: 'focus', priorityKey: 'invest', intentKey: 'setup.recurring_investment', completionPolicy: 'once',
    generatedForFingerprint: 'old',
  }, current, [{ intent_key: 'setup.recurring_investment', status: 'applied' }], fp), /already completed/)
  assert.match(staleStepReason({
    source: 'focus', priorityKey: 'invest', intentKey: 'fund.investment.401k', completionPolicy: 'repeatable',
    outcome: { amount: 500, recurrence: 'monthly' }, basis: { monthlyCapacity: 800 },
  }, current, [], fp), /no longer supports/)
})

test('focus wording accepts only allowed, measurable, grounded candidates', () => {
  const candidate = {
    candidateKey: 'goal.house.2026-08-17',
    text: 'Move $400 toward House fund by 2026-08-17',
    detail: 'The goal needs $15,000 more.',
    doneWhen: '$400 is transferred and the destination balance reflects it.',
    impact: 'Moves $400 closer to the target',
    basis: { recordName: 'House fund', target: 20000, current: 5000 },
    outcome: { amount: 400 },
  }
  const valid = validateFocusPlanResult({ steps: [{
    candidateKey: candidate.candidateKey,
    text: 'Move $400 to House fund by 2026-08-17',
    detail: 'This closes part of the $15,000 remaining gap.',
    doneWhen: '$400 is transferred and the destination balance reflects it.',
    impact: 'Moves $400 closer to the target',
  }] }, [candidate])
  assert.equal(valid.accepted.length, 1)

  const invalid = validateFocusPlanResult({ steps: [{
    candidateKey: candidate.candidateKey,
    text: 'Consider investing $900',
    detail: 'This may help.',
    doneWhen: 'You understand investing.',
  }] }, [candidate])
  assert.equal(invalid.accepted.length, 0)
  assert.equal(invalid.rejected.length, 1)
})

test('invalid AI wording falls back to deterministic candidate language', () => {
  const candidates = [{ candidateKey: 'one', text: 'Pay $100 to Card', detail: 'Saves interest.', doneWhen: '$100 is paid and confirmed.' }]
  const merged = mergeFocusWording(candidates, { steps: [{
    candidateKey: 'one', text: 'Learn about debt', detail: 'Maybe useful.', doneWhen: 'You understand it.',
  }] })
  assert.equal(merged[0].text, 'Pay $100 to Card')
})

test('replacement review identifies only one highest-priority stale generated step', () => {
  const state = snapshot()
  const model = buildPlanModel({
    snapshot: state,
    plan: { steps: [
      { id: 'insurance', text: 'Enroll in insurance', source: 'focus', priorityKey: 'insurance', generatedForFingerprint: 'old' },
      { id: 'reserve', text: 'Build a starter reserve', source: 'focus', priorityKey: 'starter_ef', generatedForFingerprint: 'old' },
    ] },
  })
  assert.equal(model.review.step.id, 'insurance')
  assert.ok(model.review.reason)
})
