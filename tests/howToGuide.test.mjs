import test from 'node:test'
import assert from 'node:assert/strict'
import { formatHowToResult, HOW_TO_SLOW_MS, HOW_TO_TIMEOUT_MS } from '../src/lib/howToGuide.js'

test('fast how-to results become a clean numbered guide', () => {
  assert.equal(formatHowToResult({ steps: [
    '1. Call the old plan administrator.',
    'Open the receiving IRA.',
    '',
  ] }), '1. Call the old plan administrator.\n2. Open the receiving IRA.')
})

test('fast how-to timing advances before the request deadline', () => {
  assert.ok(HOW_TO_SLOW_MS > 0)
  assert.ok(HOW_TO_TIMEOUT_MS > HOW_TO_SLOW_MS)
  assert.equal(formatHowToResult({ steps: [] }), '')
})
