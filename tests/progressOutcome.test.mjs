import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFinancialPreview,
  inferStepOutcome,
  normalizeStepOutcome,
  resolveOutcomeTargets,
} from '../src/lib/progressOutcome.js'

test('infers transfers, debt payments, recurring setups, and account openings deterministically', () => {
  assert.equal(inferStepOutcome({ text: 'Move $500 from Checking to Emergency Savings' }).kind, 'transfer')
  assert.equal(inferStepOutcome({ text: 'Pay $300 toward the Visa card' }).kind, 'debt_payment')
  assert.equal(inferStepOutcome({ text: 'Set up an automatic $200 monthly transfer to savings' }).kind, 'recurring_setup')
  assert.equal(inferStepOutcome({ text: 'Open a Roth IRA' }).kind, 'account_opening')
  assert.equal(inferStepOutcome({ text: 'Roll over an old 401k into an IRA' }).kind, 'transfer')
  assert.equal(inferStepOutcome({ text: 'Review my beneficiaries' }).kind, 'information')
})

test('structured outcomes override inference and retain stable intent', () => {
  const outcome = normalizeStepOutcome({
    text: 'Do the next move',
    intentKey: 'fund.house',
    completionPolicy: 'repeatable',
    outcome: { kind: 'contribution', amount: 750, destination_account_hint: 'House savings' },
  })
  assert.equal(outcome.kind, 'contribution')
  assert.equal(outcome.amount, 750)
  assert.equal(outcome.intentKey, 'fund.house')
  assert.equal(outcome.completionPolicy, 'repeatable')
})

test('resolves clear account, debt, and goal targets without inventing ambiguous matches', () => {
  const data = {
    accounts: [
      { id: 'checking', name: 'Main Checking', type: 'checking', subtype: 'checking', balance: 2000 },
      { id: 'saving', name: 'Emergency Savings', type: 'savings', subtype: 'hysa', balance: 1000 },
    ],
    debts: [{ id: 'visa', name: 'Visa', balance: 900 }],
    goals: [{ id: 'ef', name: 'Emergency Fund', target_amount: 5000, current_amount: 1000 }],
  }
  const transfer = resolveOutcomeTargets(normalizeStepOutcome({ text: 'Move $500 from Main Checking to Emergency Savings for my Emergency Fund goal' }), data)
  assert.deepEqual(transfer, { sourceAccountId: 'checking', destinationAccountId: 'saving', debtId: null, goalId: 'ef' })
  const debt = resolveOutcomeTargets(normalizeStepOutcome({ text: 'Pay $300 toward Visa' }), data)
  assert.equal(debt.sourceAccountId, 'checking')
  assert.equal(debt.debtId, 'visa')
})

test('builds an atomic transfer preview including linked goal progress', () => {
  const preview = buildFinancialPreview({
    activity: { kind: 'transfer' }, amount: 500,
    sourceAccountId: 'checking', destinationAccountId: 'saving', goalId: 'ef',
  }, {
    accounts: [
      { id: 'checking', name: 'Checking', balance: 2000 },
      { id: 'saving', name: 'Savings', balance: 1000 },
    ],
    goals: [{ id: 'ef', name: 'Emergency Fund', current_amount: 1000, target_amount: 5000 }],
  })
  assert.equal(preview.error, null)
  assert.deepEqual(preview.updates.map(update => [update.entity, update.before, update.after]), [
    ['account', 2000, 1500], ['account', 1000, 1500], ['goal', 1000, 1500],
  ])
})

test('debt previews cap payments and reject stale-looking invalid moves locally', () => {
  const preview = buildFinancialPreview({
    activity: { kind: 'debt_payment' }, amount: 800, sourceAccountId: 'checking', debtId: 'loan',
  }, {
    accounts: [{ id: 'checking', name: 'Checking', balance: 1000 }],
    debts: [{ id: 'loan', name: 'Loan', balance: 500 }],
  })
  assert.equal(preview.amount, 500)
  assert.equal(preview.updates[0].after, 500)
  assert.equal(preview.updates[1].after, 0)
})
