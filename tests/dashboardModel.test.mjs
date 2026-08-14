import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DASHBOARD_MAX_WIDGETS,
  buildDashboardSuggestion,
  buildDefaultDashboard,
  dashboardEvidenceFingerprint,
  dismissDashboardSuggestion,
  normalizeDashboardLayout,
} from '../src/lib/dashboardModel.js'

function context(patch = {}) {
  return {
    snapshot: {
      cashFlowMargin: 1000,
      unallocated: 500,
      liquid: 4000,
      expenses: 3000,
      efMonths: 1.3,
      efTargetMonths: 3,
      invested: 0,
      totalDebt: 0,
      investmentAccounts: [],
      ...patch.snapshot,
    },
    accounts: patch.accounts || [],
    debts: patch.debts || [],
    goals: patch.goals || [],
    reminders: patch.reminders || [],
    now: patch.now || new Date('2026-08-14T12:00:00Z'),
  }
}

test('personalized default always keeps the four calm foundation cards', () => {
  const layout = buildDefaultDashboard(context())
  assert.deepEqual(layout.widgets.slice(0, 4).map(item => item.id), [
    'garden', 'net-worth', 'monthly-plan', 'cash-emergency',
  ])
  assert.equal(layout.widgets.length, 5)
})
test('personalized fifth card prioritizes debt, goals, investments, accounts, then routines', () => {
  const debt = buildDefaultDashboard(context({
    debts: [{ id: 'd1', balance: 100 }], snapshot: { totalDebt: 100 },
    goals: [{ id: 'g1', current_amount: 0, target_amount: 1000 }],
  }))
  assert.equal(debt.widgets[4].id, 'debt')

  const goal = buildDefaultDashboard(context({ goals: [{ id: 'g1', current_amount: 0, target_amount: 1000 }] }))
  assert.equal(goal.widgets[4].id, 'goals')

  const investment = buildDefaultDashboard(context({ snapshot: { invested: 500, investmentAccounts: [{ id: 'ira' }] } }))
  assert.equal(investment.widgets[4].id, 'investments')

  const accounts = buildDefaultDashboard(context({ accounts: [{ id: 'cash', name: 'Checking' }] }))
  assert.equal(accounts.widgets[4].id, 'account-watchlist')
  assert.deepEqual(accounts.widgets[4].settings.accountIds, ['cash'])

  const routines = buildDefaultDashboard(context({ reminders: [{ id: 'r1', status: 'active' }] }))
  assert.equal(routines.widgets[4].id, 'routines')
})

test('normalization enforces known unique widgets, supported sizes, and the five-card cap', () => {
  const layout = normalizeDashboardLayout({ widgets: [
    { id: 'garden', size: 'huge' },
    { id: 'garden', size: 'compact' },
    { id: 'unknown', size: 'compact' },
    { id: 'net-worth', size: 'expanded' },
    { id: 'monthly-plan', size: 'compact' },
    { id: 'cash-emergency', size: 'compact' },
    { id: 'debt', size: 'compact' },
    { id: 'goals', size: 'compact' },
  ] }, context())
  assert.equal(layout.widgets.length, DASHBOARD_MAX_WIDGETS)
  assert.equal(layout.widgets[0].size, 'expanded')
  assert.equal(new Set(layout.widgets.map(item => item.id)).size, layout.widgets.length)
  assert.equal(layout.widgets.some(item => item.id === 'unknown'), false)
})

test('normalization repairs deleted account and goal references and trims metric settings', () => {
  const layout = normalizeDashboardLayout({ widgets: [
    { id: 'account-watchlist', size: 'expanded', settings: { accountIds: ['valid', 'deleted', 'valid'] } },
    { id: 'goals', size: 'compact', settings: { goalId: 'deleted' } },
    { id: 'quick-metrics', size: 'compact', settings: { metrics: ['margin', 'debt-apr', 'bad'] } },
  ] }, context({ accounts: [{ id: 'valid' }], goals: [{ id: 'valid-goal' }] }))
  assert.deepEqual(layout.widgets[0].settings.accountIds, ['valid'])
  assert.equal(layout.widgets[1].settings.goalId, null)
  assert.deepEqual(layout.widgets[2].settings.metrics, ['margin'])
})

test('dashboard suggestion is evidence-based, unique, dismissible, and returns after evidence changes', () => {
  const evidence = context({ debts: [{ id: 'card', balance: 2000, interest_rate: 20, last_verified_at: '2026-08-14' }], snapshot: { totalDebt: 2000 } })
  const layout = normalizeDashboardLayout({ widgets: [{ id: 'net-worth', size: 'compact' }] }, evidence)
  const suggestion = buildDashboardSuggestion(evidence, layout)
  assert.equal(suggestion.widgetId, 'debt')

  const dismissed = dismissDashboardSuggestion(layout, suggestion, evidence)
  assert.equal(buildDashboardSuggestion(evidence, dismissed), null)

  const changed = context({ debts: [{ id: 'card', balance: 1500, interest_rate: 20, last_verified_at: '2026-08-14' }], snapshot: { totalDebt: 1500 } })
  assert.notEqual(dashboardEvidenceFingerprint(evidence), dashboardEvidenceFingerprint(changed))
  assert.equal(buildDashboardSuggestion(changed, dismissed)?.widgetId, 'debt')
})

test('stale records recommend freshness before other optional cards', () => {
  const evidence = context({
    accounts: [{ id: 'cash', balance: 2000, last_verified_at: '2026-01-01' }],
    debts: [{ id: 'card', balance: 1000, interest_rate: 20, last_verified_at: '2026-08-14' }],
    snapshot: { totalDebt: 1000 },
  })
  const suggestion = buildDashboardSuggestion(evidence, { widgets: [{ id: 'net-worth', size: 'compact' }] })
  assert.equal(suggestion.widgetId, 'freshness')
})
