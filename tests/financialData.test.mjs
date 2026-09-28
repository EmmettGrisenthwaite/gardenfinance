import test from 'node:test'
import assert from 'node:assert/strict'
import { loadFinancialRecords } from '../src/lib/financialData.js'

const tables = ['accounts', 'debts', 'goals', 'cash_flow_items', 'budget_limits']

function clientFor(results = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const call = { table, orders: [] }
      calls.push(call)
      const query = {
        select(value) { call.select = value; return query },
        eq(key, value) { call.filter = [key, value]; return query },
        order(value) { call.orders.push(value); return query },
        then(resolve, reject) {
          const result = results[table] ?? { data: [], error: null }
          return Promise.resolve().then(() => typeof result === 'function' ? result() : result).then(resolve, reject)
        },
      }
      return query
    },
  }
}

test('financial records distinguish successfully empty tables from an unavailable picture', async () => {
  const client = clientFor()
  assert.deepEqual(await loadFinancialRecords(client, 'user-1'), {
    accounts: [], debts: [], goals: [], cashFlowItems: [], budgetLimits: [],
  })
  assert.deepEqual(client.calls.map(call => call.table), tables)
  assert.ok(client.calls.every(call => call.select === '*' && call.filter[0] === 'user_id' && call.filter[1] === 'user-1'))
  assert.deepEqual(client.calls.find(call => call.table === 'cash_flow_items').orders, ['sort_order', 'created_at'])
})

test('financial records preserve canonical values and account/debt metadata', async () => {
  const accounts = [{ id: 'a', balance: 8200, subtype: 'roth_ira', include_in_net_worth: false }]
  const debts = [{ id: 'd', balance: 750, interest_rate: 18, minimum_payment: 30 }]
  const result = await loadFinancialRecords(clientFor({ accounts: { data: accounts }, debts: { data: debts } }), 'user-1')
  assert.deepEqual(result.accounts, accounts)
  assert.deepEqual(result.debts, debts)
})

for (const table of tables) {
  test(`a ${table} read error rejects the whole picture instead of inventing zero balances`, async () => {
    const error = { message: 'Service unavailable', code: '503' }
    const client = clientFor({ [table]: { data: null, error } })
    await assert.rejects(loadFinancialRecords(client, 'user-1'), caught => caught === error)
  })
  test(`an incomplete ${table} response is not accepted as an empty table`, async () => {
    await assert.rejects(loadFinancialRecords(clientFor({ [table]: { data: null } }), 'user-1'), /incomplete response/)
  })
}

test('network rejection is surfaced and an explicit retry can recover canonical records', async () => {
  let fail = true
  const client = clientFor({ accounts: () => {
    if (fail) throw new TypeError('Failed to fetch')
    return { data: [{ id: 'checking', balance: 2400 }], error: null }
  } })
  await assert.rejects(loadFinancialRecords(client, 'user-1'), /Failed to fetch/)
  fail = false
  assert.equal((await loadFinancialRecords(client, 'user-1')).accounts[0].balance, 2400)
})

test('signed-out requests never query financial tables', async () => {
  const client = clientFor()
  await assert.rejects(loadFinancialRecords(client, null), /Sign in/)
  assert.equal(client.calls.length, 0)
})
