export const DASHBOARD_LAYOUT_VERSION = 1
export const DASHBOARD_MAX_WIDGETS = 5

export const QUICK_METRICS = [
  'margin', 'unallocated', 'emergency', 'cash-apy',
  'debt-interest', 'debt-apr', 'utilization', 'investment-contributions',
]

export const DASHBOARD_WIDGET_MANIFEST = Object.freeze({
  garden: { title: 'Garden progress', sizes: ['compact', 'expanded'], defaultSize: 'expanded', group: 'Progress' },
  'net-worth': { title: 'Net worth', sizes: ['compact', 'expanded'], defaultSize: 'expanded', group: 'Money' },
  'monthly-plan': { title: 'Monthly plan', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Money' },
  'cash-emergency': { title: 'Cash and emergency fund', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Money' },
  debt: { title: 'Debt', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Money' },
  investments: { title: 'Investments', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Money' },
  goals: { title: 'Goals', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Progress' },
  'account-watchlist': { title: 'Account watchlist', sizes: ['compact', 'expanded'], defaultSize: 'expanded', group: 'Accounts' },
  'quick-metrics': { title: 'Quick metrics', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Money' },
  routines: { title: 'Routines', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Progress' },
  'recent-progress': { title: 'Recent progress', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Progress' },
  freshness: { title: 'Data freshness', sizes: ['compact', 'expanded'], defaultSize: 'compact', group: 'Accounts' },
})

const num = value => Number(value) || 0

function hash(value) {
  let result = 2166136261
  const input = JSON.stringify(value)
  for (let index = 0; index < input.length; index += 1) {
    result ^= input.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}
function activeGoals(goals = []) {
  return goals.filter(goal => num(goal.target_amount) > num(goal.current_amount))
}

function activeReminders(reminders = []) {
  return reminders.filter(reminder => reminder.status === 'active')
}

export function dashboardEvidenceFingerprint(context = {}) {
  const { snapshot = {}, accounts = [], debts = [], goals = [], reminders = [] } = context
  return hash({
    margin: Math.round(num(snapshot.cashFlowMargin)),
    unallocated: Math.round(num(snapshot.unallocated)),
    liquid: Math.round(num(snapshot.liquid)),
    invested: Math.round(num(snapshot.invested)),
    debt: Math.round(num(snapshot.totalDebt)),
    ef: Math.round(num(snapshot.efMonths) * 10) / 10,
    accounts: accounts.map(item => [item.id, item.last_verified_at, item.last_synced_at, Math.round(num(item.balance))]),
    debts: debts.map(item => [item.id, Math.round(num(item.balance)), num(item.interest_rate), item.last_verified_at, item.last_synced_at]),
    goals: goals.map(item => [item.id, Math.round(num(item.current_amount)), Math.round(num(item.target_amount))]),
    reminders: reminders.map(item => [item.id, item.status, item.next_due_on]),
  })
}

function normalizeSettings(id, settings, size, context) {
  const source = settings && typeof settings === 'object' ? settings : {}
  if (id === 'account-watchlist') {
    const valid = new Set((context.accounts || []).map(item => String(item.id)))
    return { accountIds: [...new Set((source.accountIds || []).map(String))].filter(value => valid.has(value)).slice(0, 3) }
  }
  if (id === 'goals') {
    const valid = new Set((context.goals || []).map(item => String(item.id)))
    const goalId = source.goalId && valid.has(String(source.goalId)) ? String(source.goalId) : null
    return { goalId }
  }
  if (id === 'quick-metrics') {
    const limit = size === 'expanded' ? 3 : 1
    const metrics = [...new Set((source.metrics || []).filter(metric => QUICK_METRICS.includes(metric)))].slice(0, limit)
    return { metrics: metrics.length ? metrics : ['margin'] }
  }
  return {}
}

export function normalizeDashboardLayout(layout, context = {}) {
  const source = layout && typeof layout === 'object' ? layout : {}
  const widgets = []
  const seen = new Set()
  for (const candidate of Array.isArray(source.widgets) ? source.widgets : []) {
    const id = String(candidate?.id || '')
    const manifest = DASHBOARD_WIDGET_MANIFEST[id]
    if (!manifest || seen.has(id) || widgets.length >= DASHBOARD_MAX_WIDGETS) continue
    const size = manifest.sizes.includes(candidate.size) ? candidate.size : manifest.defaultSize
    widgets.push({ id, size, settings: normalizeSettings(id, candidate.settings, size, context) })
    seen.add(id)
  }
  const dismissed = source.dismissedSuggestion
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    widgets,
    dismissedSuggestion: dismissed?.key && dismissed?.fingerprint
      ? { key: String(dismissed.key), fingerprint: String(dismissed.fingerprint) }
      : null,
  }
}

function widget(id, size, settings = {}) {
  return { id, size, settings }
}

export function buildDefaultDashboard(context = {}) {
  const { snapshot = {}, accounts = [], debts = [], goals = [], reminders = [] } = context
  let fifth = widget('account-watchlist', 'compact', { accountIds: accounts.slice(0, 3).map(item => item.id) })
  if (debts.some(item => num(item.balance) > 0) || num(snapshot.totalDebt) > 0) fifth = widget('debt', 'compact')
  else if (activeGoals(goals).length) fifth = widget('goals', 'compact')
  else if (num(snapshot.invested) > 0 || (snapshot.investmentAccounts || []).length) fifth = widget('investments', 'compact')
  else if (activeReminders(reminders).length) fifth = widget('routines', 'compact')

  return normalizeDashboardLayout({
    version: DASHBOARD_LAYOUT_VERSION,
    widgets: [
      widget('garden', 'expanded'),
      widget('net-worth', 'expanded'),
      widget('monthly-plan', 'compact'),
      widget('cash-emergency', 'compact'),
      fifth,
    ],
  }, context)
}

function daysOld(value, now = new Date()) {
  if (!value) return Infinity
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Infinity
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000))
}

export function buildDashboardSuggestion(context = {}, layout = {}) {
  const normalized = normalizeDashboardLayout(layout, context)
  const present = new Set(normalized.widgets.map(item => item.id))
  const fingerprint = dashboardEvidenceFingerprint(context)
  const dismissed = normalized.dismissedSuggestion
  const snapshot = context.snapshot || {}
  const accounts = context.accounts || []
  const debts = context.debts || []
  const goals = context.goals || []
  const reminders = activeReminders(context.reminders || [])
  const now = context.now ? new Date(context.now) : new Date()
  const stale = [...accounts, ...debts].filter(item => daysOld(item.last_synced_at || item.last_verified_at, now) >= 90)
  const candidates = [
    stale.length && { key: 'add-freshness', widgetId: 'freshness', title: 'Keep balances trustworthy', detail: `${stale.length} record${stale.length === 1 ? '' : 's'} need a fresh balance.` },
    debts.some(item => num(item.balance) > 0 && num(item.interest_rate) > 7) && { key: 'add-debt', widgetId: 'debt', title: 'Keep debt cost visible', detail: 'An active higher-interest balance can materially change your next move.' },
    num(snapshot.expenses) > 0 && num(snapshot.efMonths) < num(snapshot.efTargetMonths) && { key: 'add-cash-emergency', widgetId: 'cash-emergency', title: 'Watch your cash runway', detail: 'Your emergency reserve is still below its current target.' },
    activeGoals(goals).length && { key: 'add-goals', widgetId: 'goals', title: 'Keep a goal in view', detail: 'An active money goal has progress worth tracking.' },
    num(snapshot.invested) > 0 && { key: 'add-investments', widgetId: 'investments', title: 'Track contributions', detail: 'You have investment accounts that can be summarized here.' },
    reminders.length && context.primaryAction?.kind !== 'reminder' && { key: 'add-routines', widgetId: 'routines', title: 'See upcoming routines', detail: 'An approved check-in is active.' },
  ].filter(Boolean)
  const candidate = candidates.find(item => !present.has(item.widgetId)) || null
  if (!candidate) return null
  if (dismissed?.key === candidate.key && dismissed.fingerprint === fingerprint) return null
  return { ...candidate, fingerprint, size: DASHBOARD_WIDGET_MANIFEST[candidate.widgetId].defaultSize }
}

export function dismissDashboardSuggestion(layout, suggestion, context = {}) {
  const normalized = normalizeDashboardLayout(layout, context)
  if (!suggestion) return normalized
  return { ...normalized, dismissedSuggestion: { key: suggestion.key, fingerprint: suggestion.fingerprint } }
}
