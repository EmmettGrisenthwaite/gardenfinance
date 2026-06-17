import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, Check, X, Wallet, TrendingUp, Shield, PiggyBank, LineChart } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
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
  { key: 'Cash & Savings', icon: Shield,     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  { key: 'Retirement',     icon: PiggyBank,  color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { key: 'Investments',    icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
  { key: 'Other',          icon: Wallet,     color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-100' },
]

function typeLabel(value) {
  return ACCOUNT_TYPES.find(t => t.value === value)?.label ?? value
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────
function NetWorthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-500 mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${val >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
        {val >= 0 ? '' : '-'}${Math.abs(val).toLocaleString()}
      </div>
    </div>
  )
}

// ─── Net worth chart ───────────────────────────────────────────────────────────
function NetWorthChart({ snapshots }) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <LineChart className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Net Worth History</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Building your history</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
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
    <div className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg p-4 md:p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Net Worth History</h2>
        </div>
        {hasGrowth && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {positive ? '+' : ''}${change.toLocaleString()} since start
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">{snapshots.length} snapshots over {snapshots.length} days</p>

      <ResponsiveContainer width="100%" height={180}>
        <ReLineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
            width={48}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 2" />
          <Tooltip content={<NetWorthTooltip />} />
          <Line
            type="monotone" dataKey="netWorth" dot={{ r: 3, fill: positive ? '#3b82f6' : '#f97316' }}
            activeDot={{ r: 5 }} stroke={positive ? '#3b82f6' : '#f97316'} strokeWidth={2.5}
          />
        </ReLineChart>
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
        <span className="text-gray-400 text-sm">$</span>
        <input autoFocus type="number" inputMode="decimal" min="0" step="0.01"
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-28 px-2 py-1.5 border border-green-400 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-green-200"
        />
        <button onClick={save} className="p-1.5 text-green-600 hover:text-green-700 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => { setVal(String(account.balance)); setEditing(true) }}
      className="flex items-center gap-1.5 group/bal min-h-[44px] px-1">
      <span className="font-semibold text-gray-800">${Number(account.balance).toLocaleString()}</span>
      <Pencil className="w-3 h-3 text-gray-300 group-hover/bal:text-gray-500 transition-colors" />
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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
        <Plus className="w-4 h-4" /> Add Account
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-white border border-green-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-800">New Account</span>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Account name (e.g. Chase Checking)"
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-400" />
        <div className="grid grid-cols-2 gap-3">
          <select value={type} onChange={e => setType(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
            {['Cash & Savings', 'Retirement', 'Investments', 'Other'].map(g => (
              <optgroup key={g} label={g}>
                {ACCOUNT_TYPES.filter(t => t.group === g).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <input value={institution} onChange={e => setInstitution(e.target.value)}
            placeholder="Bank / broker"
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={balance}
              onChange={e => setBalance(e.target.value)} placeholder="Current balance"
              className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <button type="submit"
            className="px-5 py-2.5 min-h-[44px] bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
            Add
          </button>
        </div>
      </div>
    </form>
  )
}

function AccountsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map(i => (
        <div key={i} className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg overflow-hidden">
          <div className="h-12 bg-gray-100 animate-pulse" />
          <div className="divide-y divide-gray-50">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1.5">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-36" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
                </div>
                <div className="h-5 bg-gray-100 rounded animate-pulse w-20" />
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
  const [snapshots, setSnapshots] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [a, d, s] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('balance').eq('user_id', user.id),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id)
          .order('snapshot_date', { ascending: true }).limit(90),
      ])
      const accts    = a.data ?? []
      const dts      = d.data ?? []
      const snaps    = s.data ?? []
      setAccounts(accts)
      setDebts(dts)
      setSnapshots(snaps)
      setLoading(false)

      // Auto-snapshot today's net worth (upsert = no duplicate)
      const assets      = accts.reduce((sum, ac) => sum + Number(ac.balance), 0)
      const liabilities = dts.reduce((sum, dt) => sum + Number(dt.balance), 0)
      const netWorth    = assets - liabilities
      if (accts.length > 0) {
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

  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance), 0)
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
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-3 md:p-4">
          <div className="text-xs font-semibold text-green-700 mb-1">Assets</div>
          <div className="text-lg md:text-2xl font-bold text-green-800">${totalAssets.toLocaleString()}</div>
        </div>
        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-3 md:p-4">
          <div className="text-xs font-semibold text-rose-600 mb-1">Debt</div>
          <div className="text-lg md:text-2xl font-bold text-rose-700">${totalDebt.toLocaleString()}</div>
        </div>
        <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-3 md:p-4">
          <div className={`text-xs font-semibold mb-1 ${netWorth >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>Net Worth</div>
          <div className={`text-lg md:text-2xl font-bold ${netWorth >= 0 ? 'text-blue-800' : 'text-orange-700'}`}>
            {netWorth >= 0 ? '' : '-'}${Math.abs(netWorth).toLocaleString()}
          </div>
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
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold text-sm mb-1">No accounts yet</p>
          <p className="text-gray-400 text-xs max-w-xs mx-auto">
            Add your checking, savings, retirement accounts, and investments so your advisor knows your full picture.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ key, icon: Icon, color, bg, border, accounts: grpAccounts }) => {
            const subtotal = grpAccounts.reduce((s, a) => s + Number(a.balance), 0)
            return (
              <div key={key} className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className={`flex items-center justify-between px-4 py-3 ${bg} border-b ${border}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-sm font-semibold ${color}`}>{key}</span>
                  </div>
                  <span className={`text-sm font-bold ${color}`}>${subtotal.toLocaleString()}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {grpAccounts.map(acct => (
                    <div key={acct.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 group">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{acct.name}</div>
                        <div className="text-xs text-gray-400">
                          {typeLabel(acct.type)}{acct.institution ? ` · ${acct.institution}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <BalanceCell account={acct} onSave={handleUpdateBalance} />
                        <button onClick={() => handleDelete(acct.id)}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {accounts.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Balances are tracked daily for your net worth chart. Tap any balance to update it.
        </p>
      )}
    </motion.div>
  )
}
