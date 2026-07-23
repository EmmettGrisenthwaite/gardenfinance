import test from 'node:test'
import assert from 'node:assert/strict'
import {
  selectAdvisorResponseAction,
  selectPendingAdvisorAttachment,
} from '../src/lib/advisorResponseAction.js'

test('requested answer options outrank attachments and Plan actions', () => {
  assert.equal(selectAdvisorResponseAction({
    isLast: true,
    answerCount: 2,
    artifactCount: 1,
    plannable: true,
  }), 'answers')
})

test('an attachment outranks Add to Plan', () => {
  assert.equal(selectAdvisorResponseAction({
    isLast: true,
    artifactCount: 1,
    plannable: true,
  }), 'attachment')
})

test('Add to Plan appears only for the latest actionable reply', () => {
  assert.equal(selectAdvisorResponseAction({ isLast: true, plannable: true }), 'add_to_plan')
  assert.equal(selectAdvisorResponseAction({ isLast: false, plannable: true }), null)
})

test('pending response attachments have one deterministic precedence', () => {
  assert.deepEqual(
    selectPendingAdvisorAttachment({ plan: { id: 1 }, guide: { id: 2 }, goal: { id: 3 } }),
    { kind: 'plan', value: { id: 1 } },
  )
  assert.deepEqual(
    selectPendingAdvisorAttachment({ guide: { id: 2 }, goal: { id: 3 } }),
    { kind: 'guide', value: { id: 2 } },
  )
})
