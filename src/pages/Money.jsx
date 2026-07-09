import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  ChevronLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet,
  LineChart, Home, Car, Boxes, CreditCard, Check, Activity, ArrowRight,
} from 'lucide-react'
import { computeSnapshot } from '@/lib/finance'

const fmt = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString()}`

// Full class strings per accent (Tailwind can't see dynamically-built names).
const ACCENTS = {
  emerald: { icon: 'text-emerald-300', total: 'text-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-500', chipOn: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' },
  violet:  { icon: 'text-violet-300',  total: 'text-violet-200',  btn: 'bg-violet-600 hover:bg-violet-500',   chipOn: 'border-violet-400/60 bg-violet-500/15 text-violet-100' },
  amber:   { icon: 'text-amber-300',   total: 'text-amber-200',   btn: 'bg-amber-600 hover:bg-amber-500',     chipOn: 'border-amber-400/60 bg-amber-500/15 text-amber-100' },
  sky:     { icon: 'text-sky-300',     total: 'text-sky-200',     btn: 'bg-sky-600 hover:bg-sky-500',         chipOn: 'border-sky-400/60 bg-sky-500/15 text-sky-100' },
  rose:    { icon: 'text-rose-300',    total: 'text-rose-200',    btn: 'bg-rose-600 hover:bg-rose-500',       chipOn: 'border-rose-400/60 bg-rose-500/15 text-rose-100' },
}

// ─── Single inline-editable amount (income, expenses, checking, savings) ────────
function EditableAmount({ label, value, onSave, color = 'text-white', hint }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value ?? 0))
  const cancelled = useRef(false)
  function commit() { const n = parseFloat(val); onSave(isNaN(n) ? 0 : Math.max(0, n)); setEditing(false) }
  if (editing) {
    return (
      <div className="flex items-center bg-white/[0.06] border border-emerald-400/50 rounded-lg px-2.5 py-2">
        <span className="text-white/40 text-sm">$</span>
        <input autoFocus type="number" inputMode="decimal" value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { if (cancelled.current) { cancelled.current = false; return } commit() }}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { cancelled.current = true; setEditing(false) } }}
          className="w-full bg-transparent text-base md:text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <button onMouseDown={e => e.preventDefault()} onClick={commit} className="p-0.5 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
      </div>
    )
  }
  return (
    <button onClick={() => { setVal(String(value ?? 0)); setEditing(true) }} className="w-full text-left">
      <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">{label}{hint && <span className="text-white/25 normal-case tracking-normal"> · {hint}</span>}</div>
      <div className={`text-base font-bold tabular-nums leading-tight ${color}`}>{fmt(value)}</div>
    </button>
  )
}

// ─── One row in a line-item list (name + amount + optional rate + delete) ───────
function LineRow({ item, showRate, onUpdate, onDelete }) {
  const [name, setName] = useState(item.name ?? '')
  const [bal, setBal]   = useState(String(item.balance ?? 0))
  const [rate, setRate] = useState(item.interest_rate != null ? String(item.interest_rate) : '')
  useEffect(() => {
    setName(item.name ?? '')
    setBal(String(item.balance ?? 0))
    setRate(item.interest_rate != null ? String(item.interest_rate) : '')
  }, [item.name, item.balance, item.interest_rate])
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <input value={name} onChange={e => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== item.name) onUpdate(item.id, { name }) }}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/90 text-base md:text-sm focus:outline-none focus:border-emerald-400/40" />
      <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 w-[88px]">
        <span className="text-white/40 text-xs">$</span>
        <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)}
          onBlur={() => { const n = parseFloat(bal); if (!isNaN(n) && n !== Number(item.balance)) onUpdate(item.id, { balance: n }) }}
          className="w-full min-w-0 bg-transparent text-base md:text-sm font-semibold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </div>
      {showRate && (
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-1.5 w-[58px]">
          <input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="—"
            onBlur={() => { const n = parseFloat(rate); const cur = item.interest_rate ?? null; if ((isNaN(n) ? null : n) !== cur) onUpdate(item.id, { interest_rate: isNaN(n) ? null : n }) }}
            className="w-full min-w-0 bg-transparent text-base md:text-sm font-semibold text-amber-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="text-white/35 text-xs">%</span>
        </div>
      )}
      <button onClick={() => onDelete(item.id)} aria-label="Remove"
        className="p-1 text-white/25 hover:text-rose-400 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ─── A titled, addable list of line items (investments, property, debts…) ───────
function LineItemList({ icon: Icon, title, accent = 'emerald', items, presets = [], showRate = false, rateLabel = 'APR', onAdd, onUpdate, onDelete, emptyHint }) {
  const [name, setName] = useState('')
  const [bal, setBal]   = useState('')
  const [rate, setRate] = useState('')
  const c = ACCENTS[accent] ?? ACCENTS.emerald
  const total = items.reduce((s, i) => s + Number(i.balance || 0), 0)

  function add() {
    const b = parseFloat(bal)
    if (!name.trim() || isNaN(b) || b < 0) return
    const r = parseFloat(rate)
    onAdd({ name: name.trim(), balance: b, ...(showRate ? { interest_rate: isNaN(r) ? null : r } : {}) })
    setName(''); setBal(''); setRate('')
  }

  return (
    <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-sm font-semibold text-white">{title}</span>
        {total > 0 && <span className={`ml-auto text-sm font-bold tabular-nums ${c.total}`}>{fmt(total)}</span>}
      </div>
      <div className="px-4 py-2">
        {items.length > 0 ? (
          <div className="divide-y divide-white/[0.05]">
            {items.map(it => <LineRow key={it.id} item={it} showRate={showRate} onUpdate={onUpdate} onDelete={onDelete} />)}
          </div>
        ) : (
          emptyHint && <p className="text-[11px] text-white/35 py-2">{emptyHint}</p>
        )}

        {presets.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-2.5 pb-1">
            {presets.map(p => (
              <button key={p} onClick={() => setName(p)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  name === p ? c.chipOn : 'border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 items-center pt-1.5 pb-1">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] text-white text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
          <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 w-[88px]">
            <span className="text-white/40 text-xs">$</span>
            <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)} placeholder="0"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              className="w-full min-w-0 bg-transparent text-base md:text-sm text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          {showRate && (
            <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-lg px-1.5 py-1.5 w-[58px]">
              <input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder={rateLabel}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                className="w-full min-w-0 bg-transparent text-base md:text-sm text-amber-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="text-white/35 text-xs">%</span>
            </div>
          )}
          <button onClick={add} disabled={!name.trim() || bal === '' || !(parseFloat(bal) >= 0)}
            className={`p-1.5 rounded-lg text-white transition-colors flex-shrink-0 disabled:bg-white/10 disabled:text-white/30 ${c.btn}`}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function Money() {
  const { user, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts]       = useState([])
  const [income, setIncome]     = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      const [ac, d] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id).order('created_at'),
      ])
      if (ac.error) throw ac.error
      if (d.error) throw d.error
      setAccounts(ac.data ?? [])
      setDebts(d.data ?? [])
      setIncome(Number(profile?.monthly_income) || 0)
      setExpenses(Number(profile?.monthly_expenses) || 0)
      setLoading(false)
    }
    load().catch(err => {
      setError(err.message ?? 'Could not load your money data.')
      setLoading(false)
    })
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived totals ──
  const byType   = (t) => accounts.filter(a => a.type === t)
  const sumType  = (t) => byType(t).reduce((s, a) => s + Number(a.balance || 0), 0)
  const checking = sumType('checking')
  const savings  = sumType('savings')
  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const totalDebt   = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const netWorth    = totalAssets - totalDebt
  const surplus     = income - expenses
  // The shared finance engine's read on the whole picture (runway, savings
  // rate, debt-free date, next-dollar priority).
  const snap = computeSnapshot({
    profile: { ...profile, monthly_income: income, monthly_expenses: expenses },
    accounts, debts,
  })

  // Keep the profile's net worth in sync so the dashboard and advisor agree.
  useEffect(() => {
    if (loading) return
    if (Number(profile?.net_worth) === netWorth) return
    setProfile(p => (p ? { ...p, net_worth: netWorth } : p))
    supabase.from('profiles').update({ net_worth: netWorth }).eq('id', user.id)
      .then(({ error: profileError }) => {
        if (profileError) setError(profileError.message ?? 'Could not sync net worth.')
      })
  }, [netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile cash flow ──
  async function saveMoney(fields) {
    setError(null)
    const { data, error: saveError } = await supabase.from('profiles')
      .update(fields).eq('id', user.id).select().single()
    if (saveError) {
      setError(saveError.message ?? 'Could not save that amount.')
      return
    }
    if ('monthly_income'   in fields) setIncome(fields.monthly_income)
    if ('monthly_expenses' in fields) setExpenses(fields.monthly_expenses)
    if (data) setProfile(data)
  }

  // ── Canonical single-row accounts (checking / savings) ──
  async function saveCanonical(type, name, val) {
    const v = Math.max(0, Number(val) || 0)
    const existing = accounts.find(a => a.type === type)
    if (existing) {
      const { error: updateError } = await supabase.from('accounts').update({ balance: v })
        .eq('id', existing.id).eq('user_id', user.id)
      if (updateError) {
        setError(updateError.message ?? 'Could not save that account balance.')
        return
      }
      setAccounts(prev => prev.map(a => a.id === existing.id ? { ...a, balance: v } : a))
    } else {
      const { data, error: insertError } = await supabase.from('accounts')
        .insert({ user_id: user.id, name, type, balance: v }).select().single()
      if (insertError) {
        setError(insertError.message ?? 'Could not create that account.')
        return
      }
      if (data) setAccounts(prev => [...prev, data])
    }
  }

  // ── Itemized accounts (investments, property, vehicles, other) ──
  async function addAccount(type, { name, balance, interest_rate }) {
    const { data, error: insertError } = await supabase.from('accounts')
      .insert({ user_id: user.id, name, type, balance: Math.max(0, Number(balance) || 0), interest_rate: interest_rate ?? null })
      .select().single()
    if (insertError) {
      setError(insertError.message ?? 'Could not add that account.')
      return
    }
    if (data) setAccounts(prev => [...prev, data])
  }
  async function updateAccount(id, fields) {
    const patch = {}
    if ('name' in fields)          patch.name = fields.name.trim() || 'Account'
    if ('balance' in fields)       patch.balance = Math.max(0, Number(fields.balance) || 0)
    if ('interest_rate' in fields) patch.interest_rate = fields.interest_rate
    const { error: updateError } = await supabase.from('accounts').update(patch)
      .eq('id', id).eq('user_id', user.id)
    if (updateError) {
      setError(updateError.message ?? 'Could not update that account.')
      return
    }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }
  async function deleteAccount(id) {
    const { error: deleteError } = await supabase.from('accounts').delete()
      .eq('id', id).eq('user_id', user.id)
    if (deleteError) {
      setError(deleteError.message ?? 'Could not delete that account.')
      return
    }
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  // ── Debts (with interest rate) ──
  async function addDebt({ name, balance, interest_rate }) {
    const { data, error: insertError } = await supabase.from('debts')
      .insert({ user_id: user.id, name, balance: Math.max(0, Number(balance) || 0), interest_rate: interest_rate ?? null })
      .select().single()
    if (insertError) {
      setError(insertError.message ?? 'Could not add that debt.')
      return
    }
    if (data) setDebts(prev => [...prev, data])
  }
  async function updateDebt(id, fields) {
    const patch = {}
    if ('name' in fields)          patch.name = fields.name.trim() || 'Debt'
    if ('balance' in fields)       patch.balance = Math.max(0, Number(fields.balance) || 0)
    if ('interest_rate' in fields) patch.interest_rate = fields.interest_rate
    const { error: updateError } = await supabase.from('debts').update(patch)
      .eq('id', id).eq('user_id', user.id)
    if (updateError) {
      setError(updateError.message ?? 'Could not update that debt.')
      return
    }
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  async function deleteDebt(id) {
    const { error: deleteError } = await supabase.from('debts').delete()
      .eq('id', id).eq('user_id', user.id)
    if (deleteError) {
      setError(deleteError.message ?? 'Could not delete that debt.')
      return
    }
    setDebts(prev => prev.filter(d => d.id !== id))
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto w-full px-4 pb-10"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="p-1.5 -ml-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-[22px] font-medium text-white">Your Money</h1>
      </div>

      {error && (
        <p className="mb-4 text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Net worth hero */}
      <div className="bg-gradient-to-br from-emerald-500/[0.12] to-emerald-700/[0.06] rounded-2xl border border-emerald-400/20 px-4 py-4 mb-4">
        <div className="text-[10px] font-semibold text-emerald-200/70 uppercase tracking-wide mb-0.5">Net worth</div>
        <div className={`text-3xl font-bold tabular-nums leading-none ${netWorth >= 0 ? 'text-white' : 'text-rose-300'}`}>{fmt(netWorth)}</div>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-emerald-200/90 tabular-nums">Assets {fmt(totalAssets)}</span>
          <span className="text-white/25">−</span>
          <span className="text-rose-200/90 tabular-nums">Debts {fmt(totalDebt)}</span>
        </div>
      </div>

      {/* Financial health — the deterministic engine's read on the numbers */}
      {!loading && (income > 0 || expenses > 0 || totalAssets > 0) && (
        <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] px-4 py-3.5 mb-4">
          <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-emerald-300" /> Financial health
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">Runway</div>
              <div className={`text-base font-bold tabular-nums leading-tight ${
                snap.efMonths >= snap.efTargetMonths ? 'text-emerald-300' : snap.efMonths >= 1 ? 'text-amber-300' : 'text-rose-300'}`}>
                {snap.expenses > 0 ? `${snap.efMonths.toFixed(1)} mo` : '—'}
              </div>
              <div className="text-[10px] text-white/35">target {snap.efTargetMonths} mo</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">Savings rate</div>
              <div className={`text-base font-bold tabular-nums leading-tight ${
                snap.savingsRate >= 0.2 ? 'text-emerald-300' : snap.savingsRate >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>
                {snap.income > 0 ? `${Math.round(snap.savingsRate * 100)}%` : '—'}
              </div>
              <div className="text-[10px] text-white/35">target 20%+</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">Debt-free</div>
              <div className="text-base font-bold tabular-nums leading-tight text-sky-300">
                {totalDebt === 0 ? 'Now ✓' : snap.debtFree && !snap.debtFree.stuck ? `~${snap.debtFree.debtFreeLabel}` : '—'}
              </div>
              {totalDebt > 0 && snap.debtFree && !snap.debtFree.stuck && (
                <div className="text-[10px] text-white/35">if surplus → debt</div>
              )}
            </div>
          </div>
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${
            snap.next.urgent ? 'bg-amber-400/[0.08] border-amber-400/25' : 'bg-emerald-500/[0.08] border-emerald-400/20'}`}>
            <ArrowRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${snap.next.urgent ? 'text-amber-300' : 'text-emerald-300'}`} />
            <p className="text-xs text-white/85 leading-snug">
              <span className="font-semibold text-white">Next dollar goes to:</span> {snap.next.title}. <span className="text-white/55">{snap.next.why}</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Monthly cash flow */}
        <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] px-4 py-3.5">
          <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-2.5">Monthly cash flow</div>
          <div className="grid grid-cols-3 gap-3">
            <EditableAmount label="Income"   value={income}   onSave={v => saveMoney({ monthly_income: v })}   color="text-emerald-300" />
            <EditableAmount label="Expenses" value={expenses} onSave={v => saveMoney({ monthly_expenses: v })} color="text-rose-300" />
            <div>
              <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">Surplus</div>
              <div className={`text-base font-bold tabular-nums leading-tight flex items-center gap-1 ${surplus >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>
                {surplus >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {fmt(surplus)}
              </div>
            </div>
          </div>
        </div>

        {/* Cash & savings */}
        <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <Wallet className="w-4 h-4 text-sky-300" />
            <span className="text-sm font-semibold text-white">Cash & savings</span>
            <span className="ml-auto text-sm font-bold tabular-nums text-sky-200">{fmt(checking + savings)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EditableAmount label="Checking & cash" value={checking} onSave={v => saveCanonical('checking', 'Checking', v)} color="text-sky-200" />
            <EditableAmount label="Savings (HYSA)"   value={savings}  onSave={v => saveCanonical('savings', 'Savings', v)}   color="text-emerald-200" />
          </div>
        </div>

        {/* Investments */}
        <LineItemList icon={LineChart} title="Investments" accent="violet" showRate rateLabel="APY"
          items={byType('brokerage')} presets={['Roth IRA', 'Traditional IRA', '401(k)', 'Brokerage', 'HSA']}
          emptyHint="Add retirement & brokerage accounts so your advisor sees your full picture."
          onAdd={(it) => addAccount('brokerage', it)} onUpdate={updateAccount} onDelete={deleteAccount} />

        {/* Property */}
        <LineItemList icon={Home} title="Property & real estate" accent="amber"
          items={byType('property')} presets={['Home', 'Rental property', 'Land']}
          emptyHint="Add your home or other property at its current value."
          onAdd={(it) => addAccount('property', it)} onUpdate={updateAccount} onDelete={deleteAccount} />

        {/* Vehicles */}
        <LineItemList icon={Car} title="Vehicles" accent="sky"
          items={byType('vehicle')} presets={['Car', 'Truck', 'Motorcycle']}
          onAdd={(it) => addAccount('vehicle', it)} onUpdate={updateAccount} onDelete={deleteAccount} />

        {/* Other assets */}
        <LineItemList icon={Boxes} title="Other assets" accent="emerald"
          items={byType('other_asset')} presets={['Cash', 'Crypto', 'Collectibles', 'Business']}
          onAdd={(it) => addAccount('other_asset', it)} onUpdate={updateAccount} onDelete={deleteAccount} />

        {/* Debts */}
        <LineItemList icon={CreditCard} title="Debts & liabilities" accent="rose" showRate
          items={debts} presets={['Mortgage', 'Student loan', 'Car loan', 'Credit card', 'Personal loan']}
          emptyHint="Add what you owe with its rate — the advisor prioritises the costliest debt first."
          onAdd={addDebt} onUpdate={updateDebt} onDelete={deleteDebt} />

        <p className="text-center text-[11px] text-white/30 pt-1">
          Net worth updates automatically. The amount field is the balance; the % is the interest rate.
        </p>
      </div>
    </motion.div>
  )
}
