import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  ChevronLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet,
  LineChart, Home, Car, Boxes, CreditCard, Check,
} from 'lucide-react'

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
          className="w-full bg-transparent text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
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
  return (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-1.5">
      <input value={name} onChange={e => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== item.name) onUpdate(item.id, { name }) }}
        className="w-full min-w-0 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/90 text-sm focus:outline-none focus:border-emerald-400/40 sm:flex-1" />
      <div className={`grid items-center gap-1.5 ${showRate ? 'grid-cols-[minmax(0,1fr)_72px_40px]' : 'grid-cols-[minmax(0,1fr)_40px]'} sm:flex sm:flex-shrink-0`}>
        <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2 sm:w-[96px]">
          <span className="text-white/40 text-xs">$</span>
          <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)}
            onBlur={() => { const n = parseFloat(bal); if (!isNaN(n) && n !== Number(item.balance)) onUpdate(item.id, { balance: n }) }}
            className="w-full min-w-0 bg-transparent text-sm font-semibold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        {showRate && (
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-2 sm:w-[64px]">
            <input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="—"
              onBlur={() => { const n = parseFloat(rate); const cur = item.interest_rate ?? null; if ((isNaN(n) ? null : n) !== cur) onUpdate(item.id, { interest_rate: isNaN(n) ? null : n }) }}
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-amber-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            <span className="text-white/35 text-xs">%</span>
          </div>
        )}
        <button onClick={() => onDelete(item.id)} aria-label="Remove"
          className="min-h-10 min-w-10 rounded-lg text-white/25 hover:bg-rose-500/10 hover:text-rose-400 transition-colors flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ─── A titled, addable list of line items (investments, property, debts…) ───────
function LineItemList({ icon: Icon, title, accent = 'emerald', items, presets = [], showRate = false, onAdd, onUpdate, onDelete, emptyHint }) {
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
        <div className="grid grid-cols-1 gap-2 pt-1.5 pb-1 sm:flex sm:items-center sm:gap-1.5">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="w-full min-w-0 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30 sm:flex-1" />
          <div className={`grid items-center gap-1.5 ${showRate ? 'grid-cols-[minmax(0,1fr)_72px_40px]' : 'grid-cols-[minmax(0,1fr)_40px]'} sm:flex sm:flex-shrink-0`}>
            <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-2 sm:w-[96px]">
              <span className="text-white/40 text-xs">$</span>
              <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)} placeholder="0"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                className="w-full min-w-0 bg-transparent text-sm text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            {showRate && (
              <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-lg px-1.5 py-2 sm:w-[64px]">
                <input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="APR"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                  className="w-full min-w-0 bg-transparent text-sm text-amber-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-white/35 text-xs">%</span>
              </div>
            )}
            <button onClick={add} disabled={!name.trim() || bal === '' || !(parseFloat(bal) >= 0)}
              className={`min-h-10 min-w-10 rounded-lg text-white transition-colors flex items-center justify-center disabled:bg-white/10 disabled:text-white/30 ${c.btn}`}>
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
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

  useEffect(() => {
    async function load() {
      const [ac, d] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id).order('created_at'),
      ])
      setAccounts(ac.data ?? [])
      setDebts(d.data ?? [])
      setIncome(Number(profile?.monthly_income) || 0)
      setExpenses(Number(profile?.monthly_expenses) || 0)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
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

  // Keep the profile's net worth in sync so the dashboard and advisor agree.
  useEffect(() => {
    if (loading) return
    if (Number(profile?.net_worth) === netWorth) return
    setProfile(p => (p ? { ...p, net_worth: netWorth } : p))
    supabase.from('profiles').update({ net_worth: netWorth }).eq('id', user.id).then(() => {}, () => {})
  }, [netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile cash flow ──
  async function saveMoney(fields) {
    if ('monthly_income'   in fields) setIncome(fields.monthly_income)
    if ('monthly_expenses' in fields) setExpenses(fields.monthly_expenses)
    const { data } = await supabase.from('profiles').update(fields).eq('id', user.id).select().single()
    if (data) setProfile(data)
  }

  // ── Canonical single-row accounts (checking / savings) ──
  async function saveCanonical(type, name, val) {
    const v = Math.max(0, Number(val) || 0)
    const existing = accounts.find(a => a.type === type)
    if (existing) {
      setAccounts(prev => prev.map(a => a.id === existing.id ? { ...a, balance: v } : a))
      await supabase.from('accounts').update({ balance: v }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('accounts').insert({ user_id: user.id, name, type, balance: v }).select().single()
      if (data) setAccounts(prev => [...prev, data])
    }
  }

  // ── Itemized accounts (investments, property, vehicles, other) ──
  async function addAccount(type, { name, balance }) {
    const { data } = await supabase.from('accounts')
      .insert({ user_id: user.id, name, type, balance: Math.max(0, Number(balance) || 0) }).select().single()
    if (data) setAccounts(prev => [...prev, data])
  }
  async function updateAccount(id, fields) {
    const patch = {}
    if ('name' in fields)    patch.name = fields.name.trim() || 'Account'
    if ('balance' in fields) patch.balance = Math.max(0, Number(fields.balance) || 0)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    await supabase.from('accounts').update(patch).eq('id', id)
  }
  function deleteAccount(id) {
    setAccounts(prev => prev.filter(a => a.id !== id))
    supabase.from('accounts').delete().eq('id', id).then(() => {})
  }

  // ── Debts (with interest rate) ──
  async function addDebt({ name, balance, interest_rate }) {
    const { data } = await supabase.from('debts')
      .insert({ user_id: user.id, name, balance: Math.max(0, Number(balance) || 0), interest_rate: interest_rate ?? null })
      .select().single()
    if (data) setDebts(prev => [...prev, data])
  }
  async function updateDebt(id, fields) {
    const patch = {}
    if ('name' in fields)          patch.name = fields.name.trim() || 'Debt'
    if ('balance' in fields)       patch.balance = Math.max(0, Number(fields.balance) || 0)
    if ('interest_rate' in fields) patch.interest_rate = fields.interest_rate
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
    await supabase.from('debts').update(patch).eq('id', id)
  }
  function deleteDebt(id) {
    setDebts(prev => prev.filter(d => d.id !== id))
    supabase.from('debts').delete().eq('id', id).then(() => {})
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto w-full px-4 pt-2 pb-10">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="p-1.5 -ml-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-[22px] font-medium text-white">Your Money</h1>
      </div>

      {/* Net worth hero */}
      <div className="bg-gradient-to-br from-emerald-500/[0.12] to-emerald-700/[0.06] rounded-2xl border border-emerald-400/20 px-4 py-4 mb-5">
        <div className="text-[10px] font-semibold text-emerald-200/70 uppercase tracking-wide mb-0.5">Net worth</div>
        <div className={`text-3xl font-bold tabular-nums leading-none ${netWorth >= 0 ? 'text-white' : 'text-rose-300'}`}>{fmt(netWorth)}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
          <span className="text-emerald-200/90 tabular-nums">Assets {fmt(totalAssets)}</span>
          <span className="text-white/25">−</span>
          <span className="text-rose-200/90 tabular-nums">Debts {fmt(totalDebt)}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Monthly cash flow */}
        <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] px-4 py-3.5">
          <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-2.5">Monthly cash flow</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <EditableAmount label="Income"   value={income}   onSave={v => saveMoney({ monthly_income: v })}   color="text-emerald-300" />
            <EditableAmount label="Expenses" value={expenses} onSave={v => saveMoney({ monthly_expenses: v })} color="text-rose-300" />
            <div className="col-span-2 sm:col-span-1">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditableAmount label="Checking & cash" value={checking} onSave={v => saveCanonical('checking', 'Checking', v)} color="text-sky-200" />
            <EditableAmount label="Savings (HYSA)"   value={savings}  onSave={v => saveCanonical('savings', 'Savings', v)}   color="text-emerald-200" />
          </div>
        </div>

        {/* Investments */}
        <LineItemList icon={LineChart} title="Investments" accent="violet"
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
