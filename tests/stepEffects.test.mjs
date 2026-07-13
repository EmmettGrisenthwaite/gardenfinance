import test from 'node:test'
import assert from 'node:assert/strict'
import {
  profilePatchForCompletedStep,
  profilePatchForCompletedSteps,
  suggestionAlreadyInPlan,
} from '../src/lib/stepEffects.js'

test('completing health-insurance work replaces the uninsured profile fact', () => {
  assert.deepEqual(
    profilePatchForCompletedStep('Enroll through Healthcare.gov for health insurance', {
      employment_type: 'w2',
      health_insurance: 'none',
      investment_types: ['none'],
    }),
    { health_insurance: 'marketplace' },
  )
})

test('generic insurance completion records coverage without overwriting existing coverage', () => {
  assert.deepEqual(
    profilePatchForCompletedStep('Get health insurance', {
      employment_type: 'w2',
      health_insurance: 'none',
      investment_types: [],
    }),
    { health_insurance: 'employer' },
  )
  assert.equal(
    profilePatchForCompletedStep('Get health insurance', {
      employment_type: 'w2',
      health_insurance: 'parents',
      investment_types: [],
    }),
    null,
  )
})

test('completed investment steps add the account and remove the none answer', () => {
  assert.deepEqual(
    profilePatchForCompletedStep('Contribute enough to my 401(k) to capture the full employer match', {
      investment_types: ['none'],
    }),
    { investment_types: ['401k'] },
  )
  assert.deepEqual(
    profilePatchForCompletedStep('Open a Roth IRA', {
      investment_types: ['brokerage'],
    }),
    { investment_types: ['brokerage', 'roth_ira'] },
  )
})

test('old completed steps reconcile all durable profile facts in one pass', () => {
  assert.deepEqual(
    profilePatchForCompletedSteps([
      'Get health insurance',
      'Open a Roth IRA',
      'Capture the full employer match in my 401(k)',
    ], {
      employment_type: 'w2',
      health_insurance: 'none',
      investment_types: ['none'],
    }),
    {
      health_insurance: 'employer',
      investment_types: ['roth_ira', '401k'],
    },
  )
})

test('researching insurance does not falsely claim the user got covered', () => {
  assert.equal(
    profilePatchForCompletedStep('Compare health insurance options and prices', {
      employment_type: 'w2',
      health_insurance: 'none',
      investment_types: [],
    }),
    null,
  )
})

test('suggestions stay hidden when matching work is anywhere in the plan', () => {
  const plans = [{
    steps: [
      { text: 'Get health insurance through the ACA marketplace', done: true },
      { text: 'Open a Roth IRA and automate contributions', done: false },
    ],
  }]

  assert.equal(suggestionAlreadyInPlan({ id: 'insurance' }, plans), true)
  assert.equal(suggestionAlreadyInPlan({ id: 'roth' }, plans), true)
  assert.equal(suggestionAlreadyInPlan({ id: 'efund' }, plans), false)
})

test('task suggestions are deduped against paraphrased plan steps', () => {
  const suggestion = {
    id: 'custom',
    action: { kind: 'task', text: 'Set up an automatic $400/mo transfer to savings on payday' },
  }
  const plans = [{ steps: [{ text: 'Automatically transfer $350 to savings every payday' }] }]
  assert.equal(suggestionAlreadyInPlan(suggestion, plans), true)
})
