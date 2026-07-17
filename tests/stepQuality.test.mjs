import test from 'node:test'
import assert from 'node:assert/strict'
import { doneWhenForStep } from '../src/lib/stepQuality.js'

test('preserves a supplied observable completion condition', () => {
  assert.equal(doneWhenForStep({ doneWhen: 'The account appears in Money.' }), 'The account appears in Money.')
})

test('adds specific completion conditions to common legacy financial steps', () => {
  assert.match(doneWhenForStep({ text: 'Check if your employer matches your 401k contributions' }), /match rate/i)
  assert.match(doneWhenForStep({ text: 'Roll old 401ks into a single IRA' }), /rollover is complete/i)
  assert.match(doneWhenForStep({ text: 'Wipe out your credit card debt' }), /debt balance/i)
  assert.match(doneWhenForStep({ text: 'Set up an automatic monthly payment' }), /scheduled/i)
})

test('manual steps receive a neutral observable fallback without changing their text', () => {
  assert.equal(
    doneWhenForStep({ text: 'Call my accountant' }),
    'The action is finished and its result is recorded in the app.',
  )
})
