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

test('conditional tool results require their useful fields', () => {
  assert.equal(isCompleteToolResult('guide', { should_guide: false }), true)
  assert.equal(isCompleteToolResult('guide', {
    should_guide: true,
    title: 'Open an IRA',
    summary: 'Do it today.',
    steps: [{ text: 'Choose a provider' }, { text: 'Open the account' }, { text: 'Fund it' }],
  }), true)
  assert.equal(isCompleteToolResult('suggest_goal', {
    should_suggest: true,
    goal_type: 'savings',
    target_amount: 5000,
  }), false)
  assert.match(retryInstruction('action_plan'), /3 to 5/)
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
