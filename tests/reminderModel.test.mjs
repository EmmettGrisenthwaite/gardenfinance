import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addAnchoredMonths,
  advanceReminder,
  buildReminderModel,
  nextAnchoredOccurrence,
  previewOccurrences,
  reminderTemplates,
  suggestedAnchor,
} from '../src/lib/reminderModel.js'

const NOW = new Date('2026-07-21T16:00:00Z')

test('weekly recurrence remains anchored and skips an overdue backlog', () => {
  assert.equal(nextAnchoredOccurrence('2026-07-06', 'weekly', '2026-07-06'), '2026-07-13')
  assert.equal(nextAnchoredOccurrence('2026-07-06', 'weekly', '2026-07-21'), '2026-07-27')
  assert.equal(advanceReminder({ anchor_date: '2026-07-06', cadence: 'weekly' }, NOW), '2026-07-27')
  assert.deepEqual(previewOccurrences('2026-07-06', 'weekly'), [
    '2026-07-06', '2026-07-13', '2026-07-20',
  ])
})
test('quarterly recurrence clamps month ends without schedule drift', () => {
  assert.equal(addAnchoredMonths('2025-01-31', 3), '2025-04-30')
  assert.equal(addAnchoredMonths('2025-01-31', 6), '2025-07-31')
  assert.deepEqual(previewOccurrences('2025-01-31', 'quarterly', 4), [
    '2025-01-31', '2025-04-30', '2025-07-31', '2025-10-31',
  ])
  assert.equal(nextAnchoredOccurrence('2025-01-31', 'quarterly', '2025-04-30'), '2025-07-31')
})

test('leap-day quarterly reminders return to the original day when possible', () => {
  assert.deepEqual(previewOccurrences('2024-02-29', 'quarterly', 5), [
    '2024-02-29', '2024-05-29', '2024-08-29', '2024-11-29', '2025-02-28',
  ])
  assert.equal(addAnchoredMonths('2024-02-29', 48), '2028-02-29')
})

test('due state uses a current-occurrence snooze without shifting recurrence', () => {
  const reminder = {
    id: 'weekly-1', cadence: 'weekly', status: 'active', anchor_date: '2026-07-06',
    next_due_on: '2026-07-20', snoozed_until: '2026-07-24',
  }
  const before = buildReminderModel({ reminders: [reminder], now: NOW })
  assert.equal(before.counts.due, 0)
  const after = buildReminderModel({ reminders: [reminder], now: new Date('2026-07-24T12:00:00Z') })
  assert.equal(after.counts.due, 1)
  assert.equal(advanceReminder(reminder, new Date('2026-07-24T12:00:00Z')), '2026-07-27')
})

test('weekly suggestions prioritize a deficit over debt and goals', () => {
  const model = buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: -250, unallocated: -500 },
    debts: [{ id: 'debt-1', name: 'Card', balance: 3000, interest_rate: 24 }],
    goals: [{ id: 'goal-1', name: 'Trip', current_amount: 500, target_amount: 2000 }],
    now: NOW,
  })
  const weekly = model.suggestions.find(item => item.cadence === 'weekly')
  assert.equal(weekly.candidateKey, 'weekly.monthly_plan')
  assert.match(weekly.evidence, /\$250/)
})

test('weekly suggestions fall through to highest-rate debt then nearest goal', () => {
  const debts = [
    { id: 'low', name: 'Student loan', balance: 6000, interest_rate: 4 },
    { id: 'high', name: 'Card', balance: 1000, interest_rate: 19 },
  ]
  const debtModel = buildReminderModel({ snapshot: { income: 4000, cashFlowMargin: 500, unallocated: 200 }, debts, now: NOW })
  assert.equal(debtModel.suggestions.find(item => item.cadence === 'weekly').linkedRecordId, 'high')

  const goalModel = buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: 500, unallocated: 200 },
    goals: [
      { id: 'later', name: 'Home', current_amount: 1000, target_amount: 20000, deadline: '2028-01-01' },
      { id: 'near', name: 'Trip', current_amount: 500, target_amount: 2000, deadline: '2026-12-01' },
    ],
    now: NOW,
  })
  assert.equal(goalModel.suggestions.find(item => item.cadence === 'weekly').linkedRecordId, 'near')
})

test('weekly intelligence stays quiet without a meaningful action', () => {
  const model = buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: 500, unallocated: 200 },
    now: NOW,
  })
  assert.equal(model.suggestions.some(item => item.cadence === 'weekly'), false)
})

test('quarterly suggestions follow tax, freshness, workplace, and goal priority', () => {
  const common = {
    snapshot: { income: 5000, cashFlowMargin: 1000, unallocated: 500 },
    now: NOW,
  }
  const tax = buildReminderModel({ ...common, profile: { employment_type: 'freelance' } })
  assert.equal(tax.suggestions.find(item => item.cadence === 'quarterly').candidateKey, 'quarterly.estimated_tax')

  const refresh = buildReminderModel({
    ...common,
    accounts: [{ id: 'cash', name: 'Checking', subtype: 'checking', last_verified_at: null }],
  })
  assert.equal(refresh.suggestions.find(item => item.cadence === 'quarterly').candidateKey, 'quarterly.refresh_records')

  const workplace = buildReminderModel({
    ...common,
    accounts: [{ id: '401k', name: 'Work 401(k)', subtype: '401k', last_verified_at: '2026-07-01' }],
  })
  assert.equal(workplace.suggestions.find(item => item.cadence === 'quarterly').candidateKey, 'quarterly.workplace_match.401k')

  const goal = buildReminderModel({
    ...common,
    goals: [{ id: 'home', name: 'Home', current_amount: 5000, target_amount: 50000 }],
  })
  assert.equal(goal.suggestions.find(item => item.cadence === 'quarterly').candidateKey, 'quarterly.goal_pace.home')
})

test('approved and archived candidate keys deduplicate automatic suggestions', () => {
  const base = {
    snapshot: { income: 4000, cashFlowMargin: -100, unallocated: -100 },
    now: NOW,
  }
  const first = buildReminderModel(base)
  const suggestion = first.suggestions.find(item => item.cadence === 'weekly')
  for (const status of ['active', 'paused', 'archived']) {
    const model = buildReminderModel({
      ...base,
      reminders: [{ candidate_key: suggestion.candidateKey, source_fingerprint: suggestion.sourceFingerprint, status }],
    })
    assert.equal(model.suggestions.some(item => item.cadence === 'weekly'), false)
  }
})

test('dismissal lasts for one evidence fingerprint and returns after material change', () => {
  const initial = buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: -100, unallocated: -100 }, now: NOW,
  }).suggestions.find(item => item.cadence === 'weekly')
  const dismissed = {
    candidate_key: initial.candidateKey,
    source_fingerprint: initial.sourceFingerprint,
    status: 'dismissed',
  }
  assert.equal(buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: -100, unallocated: -100 }, reminders: [dismissed], now: NOW,
  }).suggestions.some(item => item.cadence === 'weekly'), false)
  assert.equal(buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: -275, unallocated: -275 }, reminders: [dismissed], now: NOW,
  }).suggestions.some(item => item.cadence === 'weekly'), true)
})

test('automatic reminders receive one review when their structured basis disappears', () => {
  const reminder = {
    id: 'r1', source: 'automatic', status: 'active', user_edited: false,
    linked_record_id: 'goal-1', metadata: { rule: 'weekly.goal_progress' },
  }
  const model = buildReminderModel({
    reminders: [reminder],
    goals: [{ id: 'goal-1', current_amount: 1000, target_amount: 1000 }],
    now: NOW,
  })
  assert.equal(model.review.reminder.id, 'r1')
  const suppressed = buildReminderModel({
    reminders: [{
      ...reminder,
      metadata: { ...reminder.metadata, review_suppressed_fingerprint: model.review.basisFingerprint },
    }],
    goals: [{ id: 'goal-1', current_amount: 1000, target_amount: 1000 }],
    now: NOW,
  })
  assert.equal(suppressed.review, null)
})

test('estimated-tax suggestions anchor to the next real IRS deadline', () => {
  const tax = buildReminderModel({ profile: { employment_type: 'freelance' }, now: NOW })
    .suggestions.find(item => item.cadence === 'quarterly')
  assert.equal(tax.candidateKey, 'quarterly.estimated_tax')
  assert.equal(tax.category, 'taxes')
  assert.equal(tax.metadata.deadline, '2026-09-15')
  assert.equal(tax.anchorDate, '2026-09-05') // a 10-day lead, still ahead of the deadline
})

test('an underfunded reserve with surplus suggests emergency-fund progress', () => {
  const weekly = buildReminderModel({
    snapshot: { income: 4000, cashFlowMargin: 600, unallocated: 400, expenses: 2500, efMonths: 0.8, efTargetMonths: 3, efTargetAmount: 7500 },
    now: NOW,
  }).suggestions.find(item => item.cadence === 'weekly')
  assert.equal(weekly.candidateKey, 'weekly.emergency_gap')
  assert.equal(weekly.category, 'savings')
})

test('a funded reserve with idle surplus suggests putting cash to work', () => {
  const weekly = buildReminderModel({
    snapshot: { income: 6000, cashFlowMargin: 1500, unallocated: 1200, expenses: 3000, efMonths: 6, efTargetMonths: 3, efTargetAmount: 9000 },
    now: NOW,
  }).suggestions.find(item => item.cadence === 'weekly')
  assert.equal(weekly.candidateKey, 'weekly.idle_surplus')
  assert.equal(weekly.category, 'budget')
})

test('high credit utilization surfaces once debt progress is already tracked', () => {
  const debts = [{ id: 'card', name: 'Visa', type: 'credit_card', balance: 2000, interest_rate: 22, credit_limit: 3000 }]
  const base = { snapshot: { income: 5000, cashFlowMargin: 800, unallocated: 500, cardUtilization: 0.66 }, debts, now: NOW }
  assert.equal(
    buildReminderModel(base).suggestions.find(item => item.cadence === 'weekly').candidateKey,
    'weekly.debt_progress.card',
  )
  const next = buildReminderModel({ ...base, reminders: [{ candidate_key: 'weekly.debt_progress.card', status: 'active' }] })
    .suggestions.find(item => item.cadence === 'weekly')
  assert.equal(next.candidateKey, 'weekly.card_utilization')
  assert.equal(next.category, 'debt')
})

test('quarterly suggestions cover savings rate, IRA room, and rebalancing', () => {
  const savings = buildReminderModel({ snapshot: { income: 5000, liquid: 8000, weightedCashApy: 0.5 }, now: NOW })
    .suggestions.find(item => item.cadence === 'quarterly')
  assert.equal(savings.candidateKey, 'quarterly.savings_rate')
  assert.equal(savings.category, 'accounts')

  const ira = buildReminderModel({
    accounts: [{ id: 'roth', name: 'Roth', type: 'brokerage', subtype: 'roth_ira', last_verified_at: '2026-07-10' }],
    now: NOW,
  }).suggestions.find(item => item.cadence === 'quarterly')
  assert.equal(ira.candidateKey, 'quarterly.contribution_room')
  assert.equal(ira.category, 'retirement')

  const rebalance = buildReminderModel({
    snapshot: { invested: 15000 },
    accounts: [{ id: 'brk', name: 'Brokerage', type: 'brokerage', subtype: 'taxable_brokerage', last_verified_at: '2026-07-10' }],
    now: NOW,
  }).suggestions.find(item => item.cadence === 'quarterly')
  assert.equal(rebalance.candidateKey, 'quarterly.rebalance')
  assert.equal(rebalance.category, 'investing')
})

test('manual quick-start templates and smart default anchors are provided per cadence', () => {
  const weekly = reminderTemplates('weekly')
  const quarterly = reminderTemplates('quarterly')
  assert.ok(weekly.length >= 3 && quarterly.length >= 3)
  assert.ok(weekly.every(template => template.title && template.detail && template.category))
  assert.ok(quarterly.some(template => template.category === 'taxes'))

  const mondayKey = suggestedAnchor('weekly', NOW)
  assert.equal(new Date(`${mondayKey}T00:00:00Z`).getUTCDay(), 1)
  assert.equal(suggestedAnchor('quarterly', NOW), '2026-10-01')
})

test('manual and user-edited reminders are never automatically reviewed', () => {
  const goals = [{ id: 'goal-1', current_amount: 1000, target_amount: 1000 }]
  const reminders = [
    { id: 'manual', source: 'manual', status: 'active', linked_record_id: 'goal-1', metadata: { rule: 'weekly.goal_progress' } },
    { id: 'edited', source: 'automatic', status: 'active', user_edited: true, linked_record_id: 'goal-1', metadata: { rule: 'weekly.goal_progress' } },
  ]
  assert.equal(buildReminderModel({ reminders, goals, now: NOW }).review, null)
})
