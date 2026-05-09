import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, Check, X, Wallet, TrendingUp, Shield, PiggyBank } from 'lucide-react'
import { motion } from 'framer-motion'

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
      {/* Stack vertically on mobile */}
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
              onChange={e => setBalance(e.target.value)}
              placeholder="Current balance"
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
        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [debts,    setDebts]    = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [a, d] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('balance').eq('user_id', user.id),
      ])
      setAccounts(a.data ?? [])
      setDebts(d.data ?? [])
      setLoading(false)
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
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1 text-sm">Your balances across all accounts</p>
        </div>
        <AddForm onAdd={handleAdd} />
      </div>

      {/* Net worth summary — 3 cols on sm+, stacked on xs */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-green-50 rounded-xl p-3 md:p-4 border border-green-100">
          <div className="text-xs font-medium text-green-700 mb-1">Assets</div>
          <div className="text-lg md:text-2xl font-bold text-green-800">${totalAssets.toLocaleString()}</div>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 md:p-4 border border-rose-100">
          <div className="text-xs font-medium text-rose-700 mb-1">Debt</div>
          <div className="text-lg md:text-2xl font-bold text-rose-800">${totalDebt.toLocaleString()}</div>
        </div>
        <div className={`rounded-xl p-3 md:p-4 border ${netWorth >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <div className={`text-xs font-medium mb-1 ${netWorth >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Worth</div>
          <div className={`text-lg md:text-2xl font-bold ${netWorth >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
            {netWorth >= 0 ? '' : '-'}${Math.abs(netWorth).toLocaleString()}
          </div>
        </div>
      </div>

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
              <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
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
          Balances are used by your AI Advisor to give personalized advice. Tap any balance to update it.
        </p>
      )}
    </motion.div>
  )
}
