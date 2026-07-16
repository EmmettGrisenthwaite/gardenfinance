import test from 'node:test'
import assert from 'node:assert/strict'
import { investmentTypesFromAccounts } from '../src/lib/moneyModel.js'

test('detailed investment accounts become the canonical profile memory', () => {
  assert.deepEqual(investmentTypesFromAccounts([
    { type: 'checking', subtype: 'checking' },
    { type: 'brokerage', subtype: 'roth_ira' },
    { type: 'brokerage', subtype: '403b' },
    { type: 'brokerage', subtype: '403b' },
  ]), ['roth_ira', '401k'])
  assert.deepEqual(investmentTypesFromAccounts([{ type: 'savings', subtype: 'hysa' }]), ['none'])
})
