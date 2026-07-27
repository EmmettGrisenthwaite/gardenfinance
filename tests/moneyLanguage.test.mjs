import test from 'node:test'
import assert from 'node:assert/strict'

import { computeSnapshot } from '../src/lib/finance.js'
import { headlineMetrics, moneySections } from '../src/lib/moneyLanguage.js'

const JARGON = /weighted|populated|runway|liquidity|cash-flow margin/i

function snapshotFor(overrides = {}) {
  return computeSnapshot({
    profile: { monthly_income: 4800, monthly_expenses: 3900, health_insurance: 'employer' },
    accounts: [],
    debts: [],
    goals: [],
    ...overrides,
  })
}

const byId = (list, id) => list.find(item => item.id === id)

test('a metric has one name and no jargon', () => {
  const metrics = headlineMetrics(snapshotFor())
  assert.deepEqual(metrics.map(metric => metric.id), ['margin', 'emergency', 'debtInterest', 'unallocated'])
  assert.equal(byId(metrics, 'margin').label, 'Left over monthly')
  assert.equal(byId(metrics, 'emergency').label, 'Emergency fund')
  for (const metric of metrics) {
    assert.doesNotMatch(metric.label, JARGON, `label "${metric.label}" leaks jargon`)
    assert.doesNotMatch(metric.note, JARGON, `note "${metric.note}" leaks jargon`)
  }
})

test('the emergency metric answers "is that enough?" in the value itself', () => {
  const metric = byId(headlineMetrics(snapshotFor({
    accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2300 }],
  })), 'emergency')
  assert.match(metric.value, /of 3 mo/)
  assert.match(metric.note, /\$2,300 saved of/)
})

test('a single debt names its own rate instead of averaging one number', () => {
  const single = byId(headlineMetrics(snapshotFor({
    debts: [{ id: 'v', name: 'Visa', balance: 3400, interest_rate: 24 }],
  })), 'debtInterest')
  assert.equal(single.note, '24% APR on Visa')

  const many = byId(headlineMetrics(snapshotFor({
    debts: [
      { id: 'v', name: 'Visa', balance: 3000, interest_rate: 24 },
      { id: 'l', name: 'Loan', balance: 3000, interest_rate: 6 },
    ],
  })), 'debtInterest')
  assert.match(many.note, /average across 2 debts/)
})

test('missing rates read as missing, never as a 0% rate', () => {
  const cash = byId(moneySections({
    snapshot: snapshotFor(),
    accountGroups: { cash: [{ id: 'a', name: 'Checking', type: 'checking', balance: 2300 }] },
  }), 'cash')
  assert.match(cash.detail, /Add your rate/)
  assert.doesNotMatch(cash.meta + cash.detail, /0\.00%|0%/)

  const rated = byId(moneySections({
    snapshot: snapshotFor(),
    accountGroups: { cash: [{ id: 'a', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 5000, interest_rate: 4 }] },
  }), 'cash')
  assert.match(rated.detail, /4% APY/)

  const noRateDebt = byId(headlineMetrics(snapshotFor({
    debts: [{ id: 'd', name: 'Loan', balance: 5000 }],
  })), 'debtInterest')
  assert.match(noRateDebt.note, /No rate recorded/)
})

test('empty sections say "nothing yet" instead of restating their own title', () => {
  const sections = moneySections({ snapshot: snapshotFor(), accountGroups: {}, cashFlowItems: [], activeDebts: [] })
  const asset = byId(sections, 'asset')
  assert.equal(asset.meta, 'Nothing added yet')
  assert.equal(asset.detail, null, 'an empty section must not pad itself with a restated title')

  const investment = byId(sections, 'investment')
  assert.equal(investment.detail, null, 'no disclaimer when nothing is invested')

  for (const section of sections) {
    assert.doesNotMatch(section.meta, JARGON)
    if (section.detail) assert.doesNotMatch(section.detail, JARGON)
    // The detail must never simply repeat the title.
    if (section.detail) assert.notEqual(section.detail.toLowerCase(), section.title.toLowerCase())
  }
})

test('counts are pluralized correctly, including the -y words', () => {
  const one = moneySections({
    snapshot: snapshotFor(),
    accountGroups: { cash: [{ id: 'a', name: 'A', type: 'checking', balance: 10 }] },
    cashFlowItems: [{ id: 'i' }],
    activeDebts: [{ id: 'd', name: 'Card', balance: 100, interest_rate: 20 }],
  })
  assert.match(byId(one, 'plan').detail, /^1 category tracked$/)
  assert.equal(byId(one, 'cash').meta, '1 account')
  assert.match(byId(one, 'debts').meta, /^1 debt · /)

  const many = moneySections({
    snapshot: snapshotFor(),
    accountGroups: { cash: [{ id: 'a' }, { id: 'b' }] },
    cashFlowItems: [{ id: 'i' }, { id: 'j' }],
    activeDebts: [{ id: 'd', name: 'A', balance: 1, interest_rate: 5 }, { id: 'e', name: 'B', balance: 1, interest_rate: 5 }],
  })
  assert.match(byId(many, 'plan').detail, /^2 categories tracked$/)
  assert.equal(byId(many, 'cash').meta, '2 accounts')
  assert.match(byId(many, 'debts').meta, /^2 debts · /)
})

test('rates drop false precision', () => {
  const whole = byId(headlineMetrics(snapshotFor({
    debts: [{ id: 'd', name: 'Card', balance: 1000, interest_rate: 24 }],
  })), 'debtInterest')
  assert.match(whole.note, /24% APR/, 'a whole rate should not render as 24.0%')

  const fractional = byId(headlineMetrics(snapshotFor({
    debts: [{ id: 'd', name: 'Card', balance: 1000, interest_rate: 23.99 }],
  })), 'debtInterest')
  assert.match(fractional.note, /24% APR/)
})
