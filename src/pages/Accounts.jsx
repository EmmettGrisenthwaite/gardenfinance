import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, Check, X, Wallet, TrendingUp, Shield, PiggyBank, LineChart, Sprout, ArrowRight, Banknote, Landmark, Building2, HeartPulse, Bitcoin } from 'lucide-react'
import CountUp from '@/components/CountUp'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

export const ACCOUNT_TYPES = [
  { value: 'checking',     label: 'Checking',        group: 'Cash & Savings' },
  { value: 'savings',      label: 'Savings / HYSA',  group: 'Cash & Savings' },
  { value: 'emergency',    label: 'Emergency Fund',  group: 'Cash & Savings' },
  { value: 'money_market', label: 'Money Market',    group: 'Cash & Savings' },
  { value: 'roth_ira',     label: 'Roth IRA',        group: 'Retirement' },
  { value: 'trad_ira',     label: 'Traditional IRA', group: 'Retirement' },
  { value: '401k',         label: '401(k)',           group: 'Retirement' },
  { value: '403b',         label: '403(b)',           group: 'Retirement' },
  { value: 'hsa',          label: 'HSA',             group: 'Retirement' },
  { value: 'pension',      label: 'Pension',         group: 'Retirement' },
  { value: 'brokerage',    label: 'Brokerage',       group: 'Investments' },
  { value: 'crypto',       label: 'Crypto',          group: 'Investments' },
  { value: 'other',        label: 'Other',           group: 'Other' },
]

const GROUPS = [
  { key: 'Cash & Savings', icon: Shield,     color: 'text-sky-400',   bg: 'bg-sky-500/15',   border: 'border-sky-400/20' },
  { key: 'Retirement',     icon: PiggyBank,  color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-400/20' },
  { key: 'Investments',    icon: TrendingUp, color: 'text-emerald-400',  bg: 'bg-emerald-500/15',  border: 'border-emerald-400/20' },
  { key: 'Other',          icon: Wallet,     color: 'text-white/50',   bg: 'bg-white/5',   border: 'border-white/10' },
]

function typeLabel(value) {
  return ACCOUNT_TYPES.find(t => t.value === value)?.label ?? value
}

// A glyph per account type (Copilot-style), tinted with its group's color.
const TYPE_ICONS = {
  checking: Banknote, savings: PiggyBank, emergency: Shield, money_market: Landmark,
  roth_ira: PiggyBank, trad_ira: PiggyBank, '401k': Building2, '403b': Building2,
  hsa: HeartPulse, pension: Landmark, brokerage: LineChart, crypto: Bitcoin, other: Wallet,
}
function typeIcon(value) { return TYPE_ICONS[value] ?? Wallet }

// ─── Custom tooltip ────────────────────────────────────────────────────────────
function NetWorthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-[#0e1812] border border-white/[0.08] shadow-lg rounded-lg px-3 py-2 text-xs">
      <div className="text-white/50 mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${val >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
        {val >= 0 ? '' : '-'}${Math.abs(val).toLocaleString()}
      </div>
    </div>
  )
}

// ─── Net worth chart ───────────────────────────────────────────────────────────
function NetWorthChart({ snapshots }) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <LineChart className="w-4 h-4 text-white/50" />
          <h2 className="font-semibold text-white">Net Worth History</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm text-white/50 font-medium">Building your history</p>
          <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
            Your net worth is tracked daily. Come back tomorrow and you'll start seeing your trend.
          </p>
        </div>
      </div>
    )
  }

  const data = snapshots.map(s => ({
    date:     new Date(s.snapshot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    netWorth: Number(s.net_worth),
  }))

  const values   = data.map(d => d.netWorth)
  const minVal   = Math.min(...values)
  const maxVal   = Math.max(...values)
  const hasGrowth = maxVal > minVal
  const latest   = values[values.length - 1]
  const first    = values[0]
  const change   = latest - first
  const positive = change >= 0

  return (
    <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-4 md:p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-white/50" />
          <h2 className="font-semibold text-white">Net Worth History</h2>
        </div>
        {hasGrowth && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {positive ? '+' : ''}${change.toLocaleString()} since start
          </span>
        )}
      </div>
      <p className="text-xs text-white/40 mb-4">{snapshots.length} snapshots over {snapshots.length} days</p>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={positive ? '#34d399' : '#fbbf24'} stopOpacity={0.35} />
              <stop offset="100%" stopColor={positive ? '#34d399' : '#fbbf24'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false}
            interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false}
            tickFormatter={v => { const a = Math.abs(v); const s = v < 0 ? '-' : ''; return a >= 1000 ? `${s}$${(a / 1000).toFixed(0)}k` : `${s}$${a}` }}
            width={46}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
          <Tooltip content={<NetWorthTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
          <Area
            type="monotone" dataKey="netWorth" fill="url(#nwFill)" fillOpacity={1}
            stroke={positive ? '#34d399' : '#fbbf24'} strokeWidth={2.5}
            dot={{ r: 3, fill: positive ? '#34d399' : '#fbbf24', strokeWidth: 0 }} activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Inline balance editor ──────────────────────────────────────────────────────
function BalanceCell({ account, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(account.balance))

  function save() {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) onSave(account.id, n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-white/40 text-sm">$</span>
        <input autoFocus type="number" inputMode="decimal" min="0" step="0.01"
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-28 px-2 py-1.5 border border-emerald-400/60 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
        <button onClick={save} className="p-1.5 text-emerald-400 hover:text-emerald-300 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 text-white/40 hover:text-white/60 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => { setVal(String(account.balance)); setEditing(true) }}
      className="flex items-center gap-1.5 group/bal min-h-[44px] px-1">
      <span className="font-semibold text-white">${Number(account.balance).toLocaleString()}</span>
      <Pencil className="w-3 h-3 text-white/30 group-hover/bal:text-white/50 transition-colors" />
    </button>
  )
}

// ─── Add account form ──────────────────────────────────────────────────────────
function AddForm({ onAdd }) {
  const [name,        setName]        = useState('')
  const [type,        setType]        = useState('checking')
  const [balance,     setBalance]     = useState('')
  const [institution, setInstitution] = useState('')
  const [open,        setOpen]        = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name || balance === '') return
    onAdd({ name, type, balance: parseFloat(balance) || 0, institution })
    setName(''); setType('checking'); setBalance(''); setInstitution('')
    setOpen(false)
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/30'
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
        <Plus className="w-4 h-4" /> Add Account
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-[#0e1812] w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-semibold text-white">New Account</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Account name</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} required
                  placeholder="e.g. Chase Checking" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Type</label>
                  <select value={type} onChange={e => setType(e.target.value)}
                    className={`${inputCls} bg-[#0e1812]`}>
                    {['Cash & Savings', 'Retirement', 'Investments', 'Other'].map(g => (
                      <optgroup key={g} label={g}>
                        {ACCOUNT_TYPES.filter(t => t.group === g).map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Bank / broker</label>
                  <input value={institution} onChange={e => setInstitution(e.target.value)}
                    placeholder="Optional" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Current balance ($)</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={balance} required
                  onChange={e => setBalance(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-3 border border-white/[0.08] rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                  Add account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function AccountsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="bg-white/[0.055] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="h-12 bg-white/10 animate-pulse" />
          <div className="divide-y divide-gray-50">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1.5">
                  <div className="h-4 bg-white/10 rounded animate-pulse w-36" />
                  <div className="h-3 bg-white/10 rounded animate-pulse w-24" />
                </div>
                <div className="h-5 bg-white/10 rounded animate-pulse w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Accounts() {
  const { user }   = useAuth()
  const [accounts,  setAccounts]  = useState([])
  const [debts,     setDebts]     = useState([])
  const [goals,     setGoals]     = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [a, d, g, s] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('balance').eq('user_id', user.id),
        supabase.from('goals').select('name, current_amount').eq('user_id', user.id),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id)
          .order('snapshot_date', { ascending: true }).limit(90),
      ])
      const accts    = a.data ?? []
      const dts      = d.data ?? []
      const gls      = g.data ?? []
      const snaps    = s.data ?? []
      setAccounts(accts)
      setDebts(dts)
      setGoals(gls)
      setSnapshots(snaps)
      setLoading(false)

      // Auto-snapshot today's net worth (upsert = no duplicate).
      // Goal pots count as assets alongside account balances.
      const assets      = accts.reduce((sum, ac) => sum + Number(ac.balance), 0)
                        + gls.reduce((sum, gl) => sum + Number(gl.current_amount), 0)
      const liabilities = dts.reduce((sum, dt) => sum + Number(dt.balance), 0)
      const netWorth    = assets - liabilities
      if (accts.length > 0 || gls.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('net_worth_snapshots').upsert(
          { user_id: user.id, assets, liabilities, net_worth: netWorth, snapshot_date: today },
          { onConflict: 'user_id,snapshot_date' }
        )
        // Refresh snapshots to include today
        const { data: fresh } = await supabase.from('net_worth_snapshots').select('*')
          .eq('user_id', user.id).order('snapshot_date', { ascending: true }).limit(90)
        if (fresh) setSnapshots(fresh)
      }
    }
    load()
  }, [user.id])

  async function handleAdd(acct) {
    const { data } = await supabase.from('accounts').insert({ ...acct, user_id: user.id }).select().single()
    if (data) setAccounts(prev => [...prev, data])
  }

  async function handleUpdateBalance(id, balance) {
    await supabase.from('accounts').update({ balance }).eq('id', id)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, balance } : a))
  }

  async function handleDelete(id) {
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  const acctAssets  = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const goalAssets  = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalAssets = acctAssets + goalAssets
  const totalDebt   = debts.reduce((s, d) => s + Number(d.balance), 0)
  const netWorth    = totalAssets - totalDebt

  const grouped = GROUPS.map(g => ({
    ...g,
    accounts: accounts.filter(a => {
      const t = ACCOUNT_TYPES.find(t => t.value === a.type)
      return (t?.group ?? 'Other') === g.key
    }),
  })).filter(g => g.accounts.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Accounts</h1>
          <p className="text-white/60 mt-1 text-sm">Your balances across all accounts</p>
        </div>
        <AddForm onAdd={handleAdd} />
      </div>

      {/* Net worth summary */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-3 md:p-4 min-w-0">
          <div className="text-xs font-semibold text-emerald-300 mb-1">Assets</div>
          <CountUp value={totalAssets} format={n => `$${Math.round(n).toLocaleString()}`}
            className="text-base md:text-2xl font-bold tabular-nums leading-tight text-emerald-300" />
        </div>
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-3 md:p-4 min-w-0">
          <div className="text-xs font-semibold text-rose-300 mb-1">Debt</div>
          <CountUp value={totalDebt} format={n => `$${Math.round(n).toLocaleString()}`}
            className="text-base md:text-2xl font-bold tabular-nums leading-tight text-rose-300" />
        </div>
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-3 md:p-4 min-w-0">
          <div className={`text-xs font-semibold mb-1 ${netWorth >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>Net Worth</div>
          <CountUp value={netWorth} format={n => `${n >= 0 ? '' : '-'}$${Math.abs(Math.round(n)).toLocaleString()}`}
            className={`block text-base md:text-2xl font-bold tabular-nums leading-tight ${netWorth >= 0 ? 'text-sky-300' : 'text-amber-300'}`} />
        </div>
      </div>

      {/* Net worth history chart */}
      {!loading && accounts.length > 0 && (
        <NetWorthChart snapshots={snapshots} />
      )}

      {/* Account groups */}
      {loading ? (
        <AccountsSkeleton />
      ) : accounts.length === 0 ? (
        <div className="bg-[#0e1812] rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
          <Wallet className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <p className="text-white/80 font-semibold text-sm mb-1">No accounts yet</p>
          <p className="text-white/40 text-xs max-w-xs mx-auto">
            Add your checking, savings, retirement accounts, and investments so your advisor knows your full picture.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ key, icon: Icon, color, bg, border, accounts: grpAccounts }) => {
            const subtotal = grpAccounts.reduce((s, a) => s + Number(a.balance), 0)
            return (
              <div key={key} className="bg-white/[0.055] rounded-xl border border-white/[0.08] overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3 ${bg} border-b ${border}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-sm font-semibold ${color}`}>{key}</span>
                  </div>
                  <span className={`text-sm font-bold ${color}`}>${subtotal.toLocaleString()}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {grpAccounts.map(acct => {
                    const TI = typeIcon(acct.type)
                    return (
                    <div key={acct.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5/60 group">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${bg} ${color}`}>
                        <TI className="w-[18px] h-[18px]" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{acct.name}</div>
                        <div className="text-xs text-white/40 truncate">
                          {typeLabel(acct.type)}{acct.institution ? ` · ${acct.institution}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <BalanceCell account={acct} onSave={handleUpdateBalance} />
                        <button onClick={() => handleDelete(acct.id)}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/30 hover:text-rose-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Goals & savings — counted as assets; managed on the Plan page */}
      {!loading && goalAssets > 0 && (
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/15 border-b border-emerald-400/20">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-300" />
              <span className="text-sm font-semibold text-emerald-300">Goals &amp; Savings</span>
            </div>
            <span className="text-sm font-bold text-emerald-300">${goalAssets.toLocaleString()}</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {goals.filter(g => Number(g.current_amount) > 0).map((g, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-white truncate min-w-0">{g.name}</span>
                <span className="text-sm font-semibold text-white/80 tabular-nums flex-shrink-0">${Number(g.current_amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <Link to="/plan#goals"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/[0.06] transition-colors border-t border-white/[0.06]">
            Manage goals in Plan <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {(accounts.length > 0 || goalAssets > 0) && (
        <p className="text-xs text-white/40 text-center">
          Balances are tracked daily for your net worth chart. Tap any balance to update it.
        </p>
      )}
    </motion.div>
  )
}
