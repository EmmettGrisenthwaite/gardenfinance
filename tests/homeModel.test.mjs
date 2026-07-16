import test from 'node:test'
import assert from 'node:assert/strict'
import { selectHomeAction } from '../src/lib/homeModel.js'
import { getMoneySetupState } from '../src/lib/moneySetup.js'
import { HOME_MONEY_REDIRECTS, ONBOARDING_ACCOUNTS_ROUTE } from '../src/lib/routes.js'

test('Home action priority is setup gap, then unfinished step, then Plan review', () => {
  const plan = { steps: [{ id: 'done', text: 'Done', done: true }, { id: 'next', text: 'Open the HYSA', done: false, impact: 'Earn more interest' }] }
  const setup = { next: { label: 'Add income', cta: 'Add income', sheet: 'plan' } }

  assert.deepEqual(selectHomeAction({ setupState: setup, plan }).kind, 'setup')
  const stepAction = selectHomeAction({ setupState: { next: null }, plan })
  assert.equal(stepAction.kind, 'plan-step')
  assert.equal(stepAction.href, '/plan/step/next')
  assert.equal(selectHomeAction({ setupState: { next: null }, plan: { steps: [{ done: true }] } }).kind, 'plan-review')
  assert.equal(selectHomeAction({ setupState: { next: null }, plan: null }).title, 'Build your first focused Plan')
})

test('money setup stops asking for completed records and targets the exact Home sheet', () => {
  const missing = getMoneySetupState({ profile: {}, accounts: [], debts: [], goals: [], cashFlowItems: [] })
  assert.equal(missing.next.id, 'income')
  assert.equal(missing.next.sheet, 'plan')

  const complete = getMoneySetupState({
    profile: { monthly_income: 5000, monthly_expenses: 3500, investment_types: ['401k'] },
    accounts: [
      { id: 'cash', name: 'Checking', type: 'checking', subtype: 'checking', balance: 2000, interest_rate: 0 },
      { id: 'invest', name: '401(k)', type: 'investment', subtype: '401k', balance: 12000 },
    ],
    debts: [],
    goals: [],
    cashFlowItems: [],
  })
  assert.equal(complete.next, null)
})

test('legacy Money routes redirect to the matching Home workspace', () => {
  assert.deepEqual(HOME_MONEY_REDIRECTS, {
    '/money': '/?section=money',
    '/budget': '/?sheet=plan',
    '/accounts': '/?section=money&sheet=accounts',
    '/debt': '/?sheet=debts',
  })
  assert.equal(ONBOARDING_ACCOUNTS_ROUTE, '/?section=money&sheet=accounts&setup=1')
})
