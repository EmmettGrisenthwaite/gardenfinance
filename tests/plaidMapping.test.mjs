import test from 'node:test'
import assert from 'node:assert/strict'

import { indexLiabilities, mapPlaidAccount, mapPlaidAccounts } from '../supabase/functions/_shared/plaidMapping.js'

test('a checking account maps to a cash account with our own type/subtype pair', () => {
  const { table, row } = mapPlaidAccount({
    account_id: 'acc_checking', name: 'Plaid Checking', type: 'depository', subtype: 'checking',
    balances: { current: 1250.44 },
  }, { institutionName: 'Chase' })
  assert.equal(table, 'accounts')
  assert.equal(row.type, 'checking')
  assert.equal(row.subtype, 'checking')
  assert.equal(row.balance, 1250.44)
  assert.equal(row.source, 'plaid')
  assert.equal(row.plaid_account_id, 'acc_checking')
  assert.equal(row.institution, 'Chase')
})

test('savings lands in the savings type bucket, not checking', () => {
  const { row } = mapPlaidAccount({
    account_id: 'acc_savings', type: 'depository', subtype: 'savings', balances: { current: 9000 },
  })
  assert.equal(row.type, 'savings')
  assert.equal(row.subtype, 'standard_savings')
})

test('a credit card maps to debts with balance-as-owed, APR, and limit', () => {
  const liabilities = {
    credit: [{
      account_id: 'acc_visa',
      aprs: [{ apr_type: 'purchase_apr', apr_percentage: 23.99 }],
      minimum_payment_amount: 85,
    }],
  }
  const { table, row } = mapPlaidAccount({
    account_id: 'acc_visa', name: 'Plaid Credit Card', type: 'credit', subtype: 'credit card',
    balances: { current: 3400, limit: 5000 },
  }, { institutionName: 'Chase', liabilityByAccount: indexLiabilities(liabilities) })
  assert.equal(table, 'debts')
  assert.equal(row.type, 'credit_card')
  assert.equal(row.balance, 3400)
  assert.equal(row.interest_rate, 23.99)
  assert.equal(row.minimum_payment, 85)
  assert.equal(row.credit_limit, 5000)
  assert.equal(row.lender, 'Chase')
})

test('a mortgage and a student loan carry their liability-only fields', () => {
  const liabilities = {
    mortgage: [{ account_id: 'acc_mtg', interest_rate: { percentage: 6.25 }, next_monthly_payment: 2100, origination_principal_amount: 380000, maturity_date: '2054-01-01' }],
    student: [{ account_id: 'acc_stu', interest_rate_percentage: 5.5, minimum_payment_amount: 220, origination_principal_amount: 30000, loan_name: 'Great Lakes' }],
  }
  const byAccount = indexLiabilities(liabilities)

  const mortgage = mapPlaidAccount({ account_id: 'acc_mtg', name: 'Home Loan', type: 'loan', subtype: 'mortgage', balances: { current: 340000 } }, { liabilityByAccount: byAccount })
  assert.equal(mortgage.table, 'debts')
  assert.equal(mortgage.row.type, 'mortgage')
  assert.equal(mortgage.row.interest_rate, 6.25)
  assert.equal(mortgage.row.minimum_payment, 2100)
  assert.equal(mortgage.row.original_balance, 380000)
  assert.equal(mortgage.row.term_end_date, '2054-01-01')

  const student = mapPlaidAccount({ account_id: 'acc_stu', name: 'Student Loan', type: 'loan', subtype: 'student', balances: { current: 18000 } }, { liabilityByAccount: byAccount })
  assert.equal(student.row.type, 'student_loan')
  assert.equal(student.row.interest_rate, 5.5)
  assert.equal(student.row.lender, 'Great Lakes')
})

test('an auto loan with no liability detail still lands as a debt with just the balance', () => {
  const { table, row } = mapPlaidAccount({ account_id: 'acc_auto', name: 'Car Loan', type: 'loan', subtype: 'auto', balances: { current: 12000 } })
  assert.equal(table, 'debts')
  assert.equal(row.type, 'auto_loan')
  assert.equal(row.balance, 12000)
  assert.equal(row.interest_rate, undefined)
})

test('investment subtypes map onto our tax-treatment taxonomy', () => {
  const cases = [
    ['401k', '401k'], ['roth', 'roth_ira'], ['ira', 'traditional_ira'],
    ['sep ira', 'sep_ira'], ['brokerage', 'taxable_brokerage'], ['529', 'other_investment'],
  ]
  for (const [plaidSubtype, expected] of cases) {
    const { table, row } = mapPlaidAccount({ account_id: `acc_${plaidSubtype}`, type: 'investment', subtype: plaidSubtype, balances: { current: 1000 } })
    assert.equal(table, 'accounts')
    assert.equal(row.type, 'brokerage')
    assert.equal(row.subtype, expected, `plaid subtype "${plaidSubtype}" should map to "${expected}"`)
  }
})

test('an HSA is treated as an investment account even when Plaid files it under depository', () => {
  const { table, row } = mapPlaidAccount({ account_id: 'acc_hsa', type: 'depository', subtype: 'hsa', balances: { current: 4200 } })
  assert.equal(table, 'accounts')
  assert.equal(row.type, 'brokerage')
  assert.equal(row.subtype, 'hsa')
})

test('an unrecognized Plaid type is tracked as a generic asset, never silently dropped', () => {
  const { table, row } = mapPlaidAccount({ account_id: 'acc_mystery', type: 'other', subtype: 'other', balances: { current: 500 } })
  assert.equal(table, 'accounts')
  assert.equal(row.type, 'other_asset')
  assert.equal(row.subtype, 'other_asset')
})

test('mapPlaidAccounts splits a mixed account list into accounts vs debts', () => {
  const { accounts, debts } = mapPlaidAccounts([
    { account_id: 'a1', type: 'depository', subtype: 'checking', balances: { current: 500 } },
    { account_id: 'a2', type: 'credit', subtype: 'credit card', balances: { current: 200, limit: 1000 } },
    { account_id: 'a3', type: 'investment', subtype: 'roth', balances: { current: 8000 } },
  ], { institutionName: 'Ally' })
  assert.equal(accounts.length, 2)
  assert.equal(debts.length, 1)
  assert.deepEqual(accounts.map(a => a.plaid_account_id).sort(), ['a1', 'a3'])
  assert.equal(debts[0].plaid_account_id, 'a2')
})

test('every mapped row is tagged as Plaid-sourced with a fresh sync timestamp', () => {
  const { row } = mapPlaidAccount({ account_id: 'acc_x', type: 'depository', subtype: 'checking', balances: { current: 1 } })
  assert.equal(row.source, 'plaid')
  assert.ok(row.last_synced_at)
  assert.ok(!Number.isNaN(new Date(row.last_synced_at).getTime()))
})
