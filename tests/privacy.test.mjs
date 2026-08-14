import test from 'node:test'
import assert from 'node:assert/strict'
import { maskMoneyText, privateMoney } from '../src/lib/privacy.js'

test('privacy masking removes dollar amounts and monthly suffixes before rendering', () => {
  const text = 'Move $1,250.50 toward debt and keep $400/mo for savings.'
  const hidden = maskMoneyText(text, true)
  assert.equal(hidden.includes('$'), false)
  assert.equal(hidden.includes('1,250'), false)
  assert.equal(hidden.includes('400'), false)
  assert.match(hidden, /amount hidden/i)
})
test('privacy helpers preserve ordinary text and reveal formatted money when allowed', () => {
  assert.equal(maskMoneyText('No amount here', true), 'No amount here')
  assert.equal(maskMoneyText('Keep $500 available', false), 'Keep $500 available')
  assert.equal(privateMoney(500, true, value => `$${value}`), 'Amount hidden')
  assert.equal(privateMoney(500, false, value => `$${value}`), '$500')
})
