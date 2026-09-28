// Development-only manual QA for the Plan after it has been generated. Open
// through Vite, never production. Supabase is replaced before App mounts and
// the network is disabled, so no real records or AI endpoints are reachable.
//
// The saved plan is built by the real engine from the user's numbers a month
// ago; the records are today's, after a raise and a month of progress. So the
// Plan should show live progress and offer to resize what changed.
// ?step=<index> opens that step's detail page instead of the Plan;
// ?route=<path> opens any page; ?onboarding=1 shows first-run setup;
// ?artifacts=1 adds an advisor reply carrying every calculator card.
import { createRoot } from 'react-dom/client'
import App from '../../src/App'
import { supabase } from '../../src/lib/supabase'
import { computeSnapshot } from '../../src/lib/finance'
import { buildInitialPlan, buildMoneyRoute } from '../../src/lib/moneyRoute'
import '../../src/index.css'

const user = { id: '00000000-0000-4000-8000-000000000002', email: 'plan-qa@example.invalid' }
const stamp = new Date().toISOString()

const profile = { id: user.id, onboarding_complete: true, monthly_income: 5400, monthly_expenses: 4000, health_insurance: 'employer', employer_401k: 'none', employment_type: 'w2', investment_types: ['none'], age: 24 }
const account = (id, fields) => ({ id, user_id: user.id, created_at: stamp, last_verified_at: stamp, ...fields })
const accountsNow = [
  account('checking', { name: 'Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 400 }),
  account('savings', { name: 'Ally Savings', institution: 'Ally', type: 'savings', subtype: 'hysa', balance: 500, interest_rate: 4 }),
]
const cardNow = { id: 'card', user_id: user.id, name: 'Visa', lender: 'Capital One', type: 'credit_card', balance: 2100, interest_rate: 26, minimum_payment: 60, created_at: stamp }

// A month ago: less income, less saved, more owed.
const lastMonth = {
  profile: { ...profile, monthly_income: 5000 },
  accounts: [{ ...accountsNow[0] }, { ...accountsNow[1], balance: 300 }],
  debts: [{ ...cardNow, balance: 2800 }],
  goals: [],
  cashFlowItems: [],
}
const steps = buildInitialPlan(buildMoneyRoute({ ...lastMonth, snapshot: computeSnapshot(lastMonth) }))
  .map((step, index) => ({ ...step, id: `step-${index}`, proposed: undefined, done: false, addedAt: stamp }))

const params = new URLSearchParams(window.location.search)
// A brand-new account has no profile row yet; that is what opens setup.
const firstRun = params.get('onboarding') === '1'
const withArtifacts = params.get('artifacts') === '1'
const rows = {
  profiles: firstRun ? [] : [profile],
  accounts: accountsNow,
  debts: [cardNow],
  goals: [{ id: 'trip', user_id: user.id, name: 'Japan trip', goal_type: 'savings', target_amount: 4000, current_amount: 1250, monthly_contribution: 200, deadline: '2027-08-01', created_at: stamp }],
  advisor_plans: [{ id: 'plan', user_id: user.id, title: 'Your plan', created_at: stamp, steps }],
  conversations: [{ id: 'conversation', user_id: user.id, updated_at: stamp, messages: [
    { role: 'user', content: 'Should I pay off my card or save first?' },
    { role: 'assistant', content: 'Finish your first $1,000 of savings — you only need $100 more — then put everything toward the Visa. At 26%, it costs you more than any savings account pays.' },
    ...(withArtifacts ? [{ role: 'assistant', content: 'Here is how the numbers play out.', artifacts: [
      { type: 'debt_payoff', params: {} },
      { type: 'goal_projection', params: { goalId: 'trip' } },
      { type: 'net_worth', params: {} },
    ] }] : []),
  ] }],
}

supabase.auth.getSession = async () => ({ data: { session: { user, access_token: 'local-qa-only' } }, error: null })
supabase.auth.getUser = async () => ({ data: { user }, error: null })
supabase.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } })
supabase.from = table => {
  let operation = 'read'
  let payload
  let single = false
  const filters = []
  const query = {
    select() { return query },
    eq(key, value) { filters.push([key, value]); return query },
    in() { return query },
    order() { return query },
    limit() { return query },
    is() { return query },
    not() { return query },
    neq() { return query },
    gte() { return query },
    maybeSingle() { single = true; return query },
    single() { single = true; return query },
    insert(value) { operation = 'insert'; payload = value; return query },
    update(value) { operation = 'update'; payload = value; return query },
    upsert(value) { operation = 'upsert'; payload = value; return query },
    delete() { operation = 'delete'; return query },
    async then(resolve, reject) {
      try {
        const match = row => filters.every(([key, value]) => row[key] === value)
        let result = (rows[table] || []).filter(match)
        if (operation === 'update') result.forEach(row => Object.assign(row, payload))
        else if (operation === 'insert' || operation === 'upsert') {
          const saved = { id: `saved-${Date.now()}`, created_at: stamp, ...payload }
          rows[table] = [...(rows[table] || []), saved]
          result = [saved]
        } else if (operation === 'delete') rows[table] = (rows[table] || []).filter(row => !match(row))
        return resolve({ data: single ? (result[0] || null) : result, error: null })
      } catch (error) { return reject(error) }
    },
  }
  return query
}
supabase.rpc = async (name, payload = {}) => {
  if (name === 'reconcile_garden_milestones' || name === 'record_garden_milestone') {
    return { data: { total: 0, previousTotal: 0, inserted: false, milestones: [] }, error: null }
  }
  if (name === 'save_dashboard_layout') return { data: { user_id: user.id, layout: payload.p_layout, layout_revision: 1, hide_amounts: false }, error: null }
  if (name === 'set_dashboard_privacy') return { data: { user_id: user.id, hide_amounts: payload.p_hide_amounts, layout_revision: 1 }, error: null }
  return { data: [], error: null }
}
window.fetch = async () => { throw new Error('Network disabled in plan QA') }
window.__planQA = { rows, steps }

// ?route=/settings (any in-app path) or ?step=<index>; defaults to the Plan.
const stepIndex = params.get('step')
const route = params.get('route') || (stepIndex === null ? '/plan' : `/plan/step/step-${stepIndex}`)
for (const key of [`advisor-chat-${user.id}`]) { try { localStorage.removeItem(key) } catch { /* private mode */ } }
window.history.replaceState({}, '', route)
createRoot(document.getElementById('root')).render(<App />)
