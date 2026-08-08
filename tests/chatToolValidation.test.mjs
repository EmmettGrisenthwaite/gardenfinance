import test from 'node:test'
import assert from 'node:assert/strict'

import { isCompleteToolResult, retryInstruction, sanitizeToolResult } from '../supabase/functions/chat/toolValidation.js'

const planStep = (index) => ({
  text: `Step ${index}`,
  detail: `Reason ${index}`,
  intentKey: `test.step_${index}`,
  completionPolicy: 'once',
})

test('action plans require three to five complete steps', () => {
  assert.equal(isCompleteToolResult('action_plan', {
    title: 'Plan',
    steps: [planStep(1), planStep(2), planStep(3)],
  }), true)
  assert.equal(isCompleteToolResult('action_plan', { title: 'Plan', steps: [planStep(1)] }), false)
  assert.equal(isCompleteToolResult('action_plan', {
    title: 'Plan',
    steps: [planStep(1), planStep(2), { text: 'Incomplete' }],
  }), false)
})

test('focused plans require one to three complete wording-only steps', () => {
  const step = { candidateKey: 'debt.card.1', text: 'Pay $200 to Card', detail: 'It has the highest APR.', doneWhen: 'The $200 payment is confirmed.', impact: '' }
  assert.equal(isCompleteToolResult('focus_plan', { steps: [step] }), true)
  assert.equal(isCompleteToolResult('focus_plan', { steps: [step, step, step] }), true)
  assert.equal(isCompleteToolResult('focus_plan', { steps: [] }), false)
  assert.equal(isCompleteToolResult('focus_plan', { steps: [{ candidateKey: 'missing-fields' }] }), false)
  assert.match(retryInstruction('focus_plan'), /candidateKey/)
})

// Guide steps are saved straight into the Plan (AIAdvisor's savePlan with
// source: 'guide'), where steps are deduped by intentKey and tracked by
// completionPolicy. A step without them is a step the Plan cannot follow, so
// the tool schema requires both and validation refuses the result.
const guideStep = (text, intentKey) => ({ text, intentKey, completionPolicy: 'once' })

test('conditional tool results require their useful fields', () => {
  assert.equal(isCompleteToolResult('guide', { should_guide: false }), true)
  assert.equal(isCompleteToolResult('guide', {
    should_guide: true,
    title: 'Open an IRA',
    summary: 'Do it today.',
    steps: [
      guideStep('Choose a provider', 'open.roth_ira.choose_provider'),
      guideStep('Open the account', 'open.roth_ira'),
      guideStep('Fund it', 'fund.roth_ira'),
    ],
  }), true)
  assert.equal(isCompleteToolResult('suggest_goal', {
    should_suggest: true,
    goal_type: 'savings',
    target_amount: 5000,
  }), false)
  assert.match(retryInstruction('action_plan'), /3 to 5/)
})

test('a guide step without a trackable identity is rejected', () => {
  const complete = {
    should_guide: true,
    title: 'Open an IRA',
    summary: 'Do it today.',
    steps: [
      guideStep('Choose a provider', 'open.roth_ira.choose_provider'),
      guideStep('Open the account', 'open.roth_ira'),
      guideStep('Fund it', 'fund.roth_ira'),
    ],
  }
  assert.equal(isCompleteToolResult('guide', complete), true)

  // Bare text was the old contract. It produced Plan steps that could not be
  // deduped or marked done, so it is no longer a complete result.
  const bareText = { ...complete, steps: complete.steps.map(({ text }) => ({ text })) }
  assert.equal(isCompleteToolResult('guide', bareText), false)

  const noIntentKey = { ...complete, steps: [{ text: 'Fund it', completionPolicy: 'once' }, ...complete.steps.slice(1)] }
  assert.equal(isCompleteToolResult('guide', noIntentKey), false)

  const noPolicy = { ...complete, steps: [{ text: 'Fund it', intentKey: 'fund.roth_ira' }, ...complete.steps.slice(1)] }
  assert.equal(isCompleteToolResult('guide', noPolicy), false)

  const badPolicy = { ...complete, steps: [guideStep('Fund it', 'fund.roth_ira'), ...complete.steps.slice(1)] }
  badPolicy.steps[0] = { ...badPolicy.steps[0], completionPolicy: 'sometimes' }
  assert.equal(isCompleteToolResult('guide', badPolicy), false)

  // The model has to be told what was missing, or it retries the same shape.
  assert.match(retryInstruction('guide'), /intentKey/)
  assert.match(retryInstruction('guide'), /completionPolicy/)
})

test('memory and fast-guide outputs reject truncated payloads', () => {
  assert.equal(isCompleteToolResult('extract_memories', { memories: [] }), true)
  assert.equal(isCompleteToolResult('extract_memories', {
    memories: [{ fact: 'Has a pension', category: 'income', memory_key: 'income.context', subject_key: 'pension' }],
  }), true)
  assert.equal(isCompleteToolResult('how_to', { steps: ['One', 'Two'] }), false)
})

test('guide results keep at most three unique secure links', () => {
  const result = sanitizeToolResult('guide', {
    steps: [
      { resources: [{ url: 'https://one.example' }, { url: 'http://unsafe.example' }] },
      { resources: [
        { url: 'https://two.example' },
        { url: 'https://one.example' },
        { url: 'https://three.example' },
        { url: 'https://four.example' },
      ] },
    ],
  })
  assert.deepEqual(result.steps.flatMap(step => step.resources).map(resource => resource.url), [
    'https://one.example',
    'https://two.example',
    'https://three.example',
  ])
})
