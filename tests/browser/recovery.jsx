// Development-only manual QA. Open this HTML through Vite, never production.
// All Supabase methods are replaced before App mounts; no real records or AI
// endpoints are reachable. ?screen=home|plan|advisor|money&fault=accounts
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/App'
import { supabase } from '../../src/lib/supabase'
import '../../src/index.css'

const params = new URLSearchParams(window.location.search)
const screen = params.get('screen') || 'home'
const fault = params.get('fault') || 'accounts'
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' }
const stamp = new Date().toISOString()
const rows = {
  profiles: [{ id: user.id, onboarding_complete: true, monthly_income: 4000, monthly_expenses: 2800, net_worth: 4800, health_insurance: 'employer', employment_status: 'employed', investment_types: [], has_401k: false }],
  accounts: [
    { id: 'checking', user_id: user.id, name: 'Checking', type: 'checking', subtype: 'checking', balance: 2400, created_at: stamp, last_verified_at: stamp },
    { id: 'savings', user_id: user.id, name: 'Emergency savings', type: 'savings', subtype: 'hysa', balance: 3600, interest_rate: 4, created_at: stamp, last_verified_at: stamp },
  ],
  debts: [{ id: 'card', user_id: user.id, name: 'Credit card', type: 'credit_card', balance: 1200, interest_rate: 18, minimum_payment: 45, planned_payment: 100, created_at: stamp }],
  advisor_plans: [{ id: 'plan', user_id: user.id, title: 'Your plan', created_at: stamp, steps: [{ id: 'step', text: 'Confirm the card payment date', detail: 'Keep the required payment on time.', doneWhen: 'The due date is saved.', source: 'user', done: false }] }],
  conversations: [{ id: 'conversation', user_id: user.id, updated_at: stamp, messages: [
    { role: 'user', content: 'Keep my saved conversation.' },
    { role: 'assistant', content: 'Your conversation is still here after reconnecting.' },
  ] }],
}
let unavailable = fault !== 'none' && fault !== 'after-save'
let notify = () => {}
const writes = []
const failures = []
let nextId = 1

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
    maybeSingle() { single = true; return query },
    single() { single = true; return query },
    insert(value) { operation = 'insert'; payload = value; return query },
    update(value) { operation = 'update'; payload = value; return query },
    upsert(value) { operation = 'upsert'; payload = value; return query },
    delete() { operation = 'delete'; return query },
    async then(resolve, reject) {
      try {
        const match = row => filters.every(([key, value]) => row[key] === value)
        if (operation === 'read' && unavailable && table === (fault === 'after-save' ? 'accounts' : fault)) {
          if (fault === 'after-save') unavailable = false
          failures.push(table); notify()
          return resolve({ data: null, error: { message: 'Simulated service interruption', code: '503' } })
        }
        let result = (rows[table] || []).filter(match)
        if (operation !== 'read') {
          writes.push({ table, operation, payload, whileUnavailable: unavailable }); notify()
          if (operation === 'insert' || operation === 'upsert') {
            const saved = { id: `saved-${nextId++}`, created_at: stamp, ...payload }
            rows[table] = [...(rows[table] || []), saved]; result = [saved]
          } else if (operation === 'update') {
            result.forEach(row => Object.assign(row, payload))
          } else rows[table] = (rows[table] || []).filter(row => !match(row))
          if (fault === 'after-save' && table === 'accounts') unavailable = true
        }
        return resolve({ data: single ? (result[0] || null) : result, error: null })
      } catch (error) { return reject(error) }
    },
  }
  return query
}
supabase.rpc = async (name, payload) => {
  writes.push({ table: name, operation: 'rpc', whileUnavailable: unavailable }); notify()
  if (name === 'save_dashboard_layout') return { data: { user_id: user.id, layout: payload.p_layout, layout_revision: 1, hide_amounts: false }, error: null }
  if (name === 'reconcile_garden_milestones') return { data: { total: 0, previousTotal: 0, inserted: false }, error: null }
  return { data: null, error: { message: 'This mutation is not enabled in the QA fixture.' } }
}
// Never send a chat or other request outside this fixture.
window.fetch = async () => { throw new Error('Network disabled in recovery QA') }
for (const key of [`advisor-chat-${user.id}`, `garden-dashboard-${user.id}`]) {
  try { localStorage.removeItem(key) } catch {}
}
window.history.replaceState({}, '', ({ home: '/', plan: '/plan', advisor: '/advisor', money: '/?section=money&sheet=accounts' })[screen] || '/')

function RecoveryQA() {
  const [, refresh] = useState(0)
  notify = () => refresh(value => value + 1)
  return <>
    <App />
    <details className="fixed bottom-0 right-0 z-[9999] max-w-[85vw] rounded-tl-xl border border-white/20 bg-[#15251d] px-3 py-2 text-xs text-white" open>
      <summary className="cursor-pointer font-semibold">Local QA · {screen}</summary>
      <p className="mt-2">Service: {unavailable ? 'unavailable' : 'available'} · failed reads: {failures.length}</p>
      <p>Writes while unavailable: {writes.filter(item => item.whileUnavailable).length}</p>
      <p>Account inserts: {writes.filter(item => item.table === 'accounts' && item.operation === 'insert').length}</p>
      <p>Account updates: {writes.filter(item => item.table === 'accounts' && item.operation === 'update').length}</p>
      <p>Snapshot values: {writes.filter(item => item.table === 'net_worth_snapshots').map(item => item.payload.net_worth).join(', ') || 'none'}</p>
      <p>Conversation writes: {writes.filter(item => item.table === 'conversations').length}</p>
      <button type="button" className="mt-2 min-h-11 rounded-lg bg-white/10 px-3" onClick={() => { unavailable = false; refresh(value => value + 1) }}>Repair data service</button>
    </details>
  </>
}

createRoot(document.getElementById('root')).render(<RecoveryQA />)
