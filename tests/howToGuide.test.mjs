import test from 'node:test'
import assert from 'node:assert/strict'
import { formatHowToResult, guideEvidenceFingerprint, HOW_TO_SLOW_MS, HOW_TO_TIMEOUT_MS } from '../src/lib/howToGuide.js'

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

test('guide evidence fingerprints change only when the step or financial context changes', () => {
  const first = guideEvidenceFingerprint('Pay the card', 'Card $2,000 @ 20%.')
  assert.equal(first, guideEvidenceFingerprint('Pay the card', 'Card $2,000 @ 20%.'))
  assert.notEqual(first, guideEvidenceFingerprint('Pay the card', 'Card $1,000 @ 20%.'))
  assert.notEqual(first, guideEvidenceFingerprint('Pay a different card', 'Card $2,000 @ 20%.'))
})
