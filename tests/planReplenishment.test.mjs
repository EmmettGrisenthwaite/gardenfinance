import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterFreshPlanSteps,
  isCurrentNextChapter,
  nextChapterFingerprint,
  shouldRequestNextChapter,
} from '../src/lib/planReplenishment.js'

const fingerprint = 'next-v1-current'

test('replenishment triggers with zero, one, or two unfinished steps but not three', () => {
  for (const activeCount of [0, 1, 2]) {
    assert.equal(shouldRequestNextChapter({ activeCount, fingerprint }), true)
  }
  assert.equal(shouldRequestNextChapter({ activeCount: 3, fingerprint }), false)
})

test('an unchanged state does not repeatedly generate after an attempt or dismissal', () => {
  assert.equal(shouldRequestNextChapter({
    activeCount: 1,
    fingerprint,
    attemptedFingerprint: fingerprint,
  }), false)
  assert.equal(shouldRequestNextChapter({
    activeCount: 1,
    fingerprint,
    dismissedFingerprint: fingerprint,
  }), false)
  assert.equal(shouldRequestNextChapter({
    activeCount: 1,
    fingerprint: 'next-v1-changed',
    attemptedFingerprint: fingerprint,
    dismissedFingerprint: fingerprint,
  }), true)
})

test('loading, saving, and a cached draft suppress duplicate requests', () => {
  assert.equal(shouldRequestNextChapter({ activeCount: 0, fingerprint, loading: true }), false)
  assert.equal(shouldRequestNextChapter({ activeCount: 0, fingerprint, busy: true }), false)
  assert.equal(shouldRequestNextChapter({ activeCount: 0, fingerprint, hasDraft: true }), false)
})

test('failed generation remains quiet until a manual retry resets the attempt', () => {
  assert.equal(shouldRequestNextChapter({
    activeCount: 2,
    fingerprint,
    attemptedFingerprint: fingerprint,
  }), false)
  assert.equal(shouldRequestNextChapter({
    activeCount: 2,
    fingerprint,
    attemptedFingerprint: null,
  }), true)
})

test('stale responses are rejected after the financial or plan state changes', () => {
  assert.equal(isCurrentNextChapter(fingerprint, fingerprint), true)
  assert.equal(isCurrentNextChapter(fingerprint, 'next-v1-new-state'), false)
})

test('fingerprints are stable across record order and change after completion', () => {
  const base = {
    userId: 'user-1',
    profile: { monthly_income: 5000, monthly_expenses: 3200, investment_types: ['401k'] },
    steps: [
      { id: 'a', text: 'Review emergency fund', done: false },
      { id: 'b', text: 'Pay card', done: false },
    ],
    goals: [{ id: 'g', name: 'Emergency fund', target_amount: 9000, current_amount: 3000 }],
    debts: [{ id: 'd', name: 'Card', balance: 1200, interest_rate: 21 }],
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', balance: 1800 }],
  }
  const first = nextChapterFingerprint(base)
  const reordered = nextChapterFingerprint({
    ...base,
    steps: [...base.steps].reverse(),
  })
  const completed = nextChapterFingerprint({
    ...base,
    steps: base.steps.map(step => step.id === 'a' ? { ...step, done: true, completedAt: '2026-07-14T12:00:00.000Z' } : step),
  })

  assert.equal(reordered, first)
  assert.notEqual(completed, first)
})

test('approval filtering deduplicates active steps and duplicates within a draft', () => {
  const { fresh, skipped } = filterFreshPlanSteps(
    [{ text: 'Pay off the credit card balance', done: false }],
    [
      { text: 'Pay off the credit card balance this month' },
      { text: 'Automate a monthly transfer to savings' },
      { text: 'Automate a monthly transfer to savings' },
      { text: '   ' },
    ],
  )
  assert.deepEqual(fresh.map(step => step.text), ['Automate a monthly transfer to savings'])
  assert.equal(skipped, 3)
})

test('completed insurance and investment work is excluded from replenishment', () => {
  const existing = [
    { text: 'Enroll in health insurance through the ACA marketplace', done: true },
    { text: 'Open and fund a Roth IRA investment account', done: true },
  ]
  const incoming = [
    { text: 'Enroll in health insurance through the ACA marketplace this week' },
    { text: 'Open and fund a Roth IRA investment account' },
    { text: 'Review beneficiary designations on every account' },
  ]

  const normalAppend = filterFreshPlanSteps(existing, incoming)
  assert.equal(normalAppend.fresh.length, 3)

  const replenishment = filterFreshPlanSteps(existing, incoming, { dedupeCompleted: true })
  assert.deepEqual(replenishment.fresh.map(step => step.text), [
    'Review beneficiary designations on every account',
  ])
  assert.equal(replenishment.skipped, 2)
})
