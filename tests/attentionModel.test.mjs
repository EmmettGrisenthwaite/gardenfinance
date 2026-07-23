import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAttentionModel } from '../src/lib/attentionModel.js'

const step = { id: 'step-1', text: 'Pay the card' }
const proposal = { id: 'proposal-1', text: 'Build savings', proposed: true }
const today = new Date('2026-07-23T12:00:00Z')

test('setup prerequisites outrank all other attention', () => {
  const model = buildAttentionModel({
    setupState: { next: { label: 'Add income', sheet: 'plan' } },
    planModel: { focus: [step] },
    reminderModel: { due: [{ id: 'r1', next_due_on: '2026-07-20', linked_record_type: 'account' }] },
    now: today,
  })
  assert.equal(model.primary.kind, 'setup')
})

test('overdue evidence reminders outrank a plan step', () => {
  const reminder = { id: 'r1', title: 'Refresh balances', next_due_on: '2026-07-20', linked_record_type: 'money_records' }
  const model = buildAttentionModel({
    planModel: { focus: [step] },
    reminderModel: { due: [reminder] },
    now: today,
  })
  assert.equal(model.primary.kind, 'reminder')
  assert.equal(model.primary.reason, 'stale-evidence')
})

test('plan steps outrank ordinary due reminders', () => {
  const model = buildAttentionModel({
    planModel: { focus: [step] },
    reminderModel: { due: [{ id: 'r1', next_due_on: '2026-07-23', linked_record_type: 'goal' }] },
    now: today,
  })
  assert.equal(model.primary.kind, 'plan-step')
})

test('ordinary reminders appear when there is no current step', () => {
  const model = buildAttentionModel({
    planModel: { focus: [] },
    reminderModel: { due: [{ id: 'r1', next_due_on: '2026-07-23', linked_record_type: 'goal' }] },
    now: today,
  })
  assert.equal(model.primary.kind, 'reminder')
})

test('proposals are selected only after setup, reminders, and active work', () => {
  const model = buildAttentionModel({
    planModel: { focus: [proposal] },
    reminderModel: { due: [] },
    now: today,
  })
  assert.equal(model.primary.kind, 'plan-proposal')
})
