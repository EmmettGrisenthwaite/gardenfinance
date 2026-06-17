import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  Plus, Trash2, TrendingUp, TrendingDown, DollarSign, RefreshCw, Zap,
  Pencil, Check, X, BarChart3, Receipt, Download, ChevronDown, ChevronUp, Sprout,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Healthcare', 'Entertainment', 'Utilities', 'Savings', 'Other']
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Investment', 'Side Hustle', 'Other']

const CAT_COLORS = {
  Housing:       { bar: 'bg-blue-500',   light: 'bg-sky-500/15',   text: 'text-sky-300',   over: 'bg-red-500' },
  Food:          { bar: 'bg-orange-500', light: 'bg-amber-500/15', text: 'text-amber-300', over: 'bg-red-500' },
  Transport:     { bar: 'bg-yellow-500', light: 'bg-yellow-500/15', text: 'text-yellow-300', over: 'bg-red-500' },
  Healthcare:    { bar: 'bg-pink-500',   light: 'bg-pink-500/15',   text: 'text-pink-300',   over: 'bg-red-500' },
  Entertainment: { bar: 'bg-purple-500', light: 'bg-violet-500/15', text: 'text-violet-300', over: 'bg-red-500' },
  Utilities:     { bar: 'bg-teal-500',   light: 'bg-teal-500/15',   text: 'text-teal-300',   over: 'bg-red-500' },
  Savings:       { bar: 'bg-emerald-500',  light: 'bg-emerald-500/15',  text: 'text-emerald-300',  over: 'bg-red-500' },
  Other:         { bar: 'bg-white/30',   light: 'bg-white/5',   text: 'text-white/60',   over: 'bg-red-500' },
}
function catColor(cat) { return CAT_COLORS[cat] ?? CAT_COLORS.Other }

// ─── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(entries, transactions) {
  const rows = [
    ['Section', 'Type', 'Name / Note', 'Category', 'Amount', 'Recurring', 'Date'],
    ...entries.map(e => [
      'Budget Plan', e.type, e.name, e.category ?? '',
      Number(e.amount).toFixed(2),
      e.recurring === false ? 'One-time' : 'Monthly', '',
    ]),
    ...transactions.map(t => [
      'Transactions', 'expense', t.note || '', t.category ?? '',
      Number(t.amount).toFixed(2), '', t.date ?? '',
    ]),
  ]
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `garden-budget-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Entry add form ────────────────────────────────────────────────────────────
function EntryForm({ type, onAdd }) {
  const [name,      setName]      = useState('')
  const [amount,    setAmount]    = useState('')
  const [category,  setCategory]  = useState('')
  const [recurring, setRecurring] = useState(true)
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !amount) return
    onAdd({ name, amount: parseFloat(amount), category: category || categories[0], type, recurring })
    setName(''); setAmount(''); setCategory(''); setRecurring(true)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
          className="flex-1 sm:min-w-[150px] min-w-0 px-3 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.06] text-white text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
        <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Amount" min="0" step="0.01"
          className="sm:w-28 min-w-0 px-3 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.06] text-white text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="sm:w-36 min-w-0 px-3 py-2.5 rounded-lg border border-white/[0.08] text-white text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30 bg-[#0e1812]">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="min-h-[44px] flex-shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setRecurring(true)}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            recurring ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40' : 'bg-white/10 text-white/50 hover:bg-white/15'
          }`}>
          <RefreshCw className="w-3 h-3" /> Repeats monthly
        </button>
        <button type="button" onClick={() => setRecurring(false)}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !recurring ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40' : 'bg-white/10 text-white/50 hover:bg-white/15'
          }`}>
          <Zap className="w-3 h-3" /> One-time
        </button>
        <span className="text-xs text-white/40">
          {recurring ? 'Counts toward garden health' : type === 'income' ? 'Logged as windfall ✦' : "Tracked but won't affect garden"}
        </span>
      </div>
    </div>
  )
}

// ─── Entry edit modal ──────────────────────────────────────────────────────────
function EntryEditModal({ entry, onSave, onClose }) {
  const [name,      setName]      = useState(entry.name)
  const [amount,    setAmount]    = useState(String(entry.amount))
  const [category,  setCategory]  = useState(entry.category ?? '')
  const [recurring, setRecurring] = useState(entry.recurring !== false)
  const categories = entry.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !amount) return
    onSave({ ...entry, name, amount: parseFloat(amount), category: category || categories[0], recurring })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-[#0e1812] w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-semibold text-white">Edit {entry.type === 'income' ? 'Income' : 'Expense'}</h3>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/60 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Amount ($)</label>
              <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
                required min="0" step="0.01"
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] text-base bg-[#0e1812] focus:outline-none focus:ring-1 focus:ring-emerald-400/30">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRecurring(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                recurring ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40' : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}>
              <RefreshCw className="w-3.5 h-3.5" /> Monthly
            </button>
            <button type="button" onClick={() => setRecurring(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !recurring ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40' : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}>
              <Zap className="w-3.5 h-3.5" /> One-time
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border border-white/[0.08] rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Entry list (with edit + delete) ──────────────────────────────────────────
function EntryList({ entries, onDelete, onEdit }) {
  if (!entries.length) return (
    <div className="py-8 text-center">
      <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <Sprout className="w-5 h-5 text-emerald-500" />
      </div>
      <p className="text-sm text-white/50 font-medium">No entries yet</p>
      <p className="text-xs text-white/40 mt-1">Add your income and expenses above</p>
    </div>
  )
  return (
    <div className="space-y-1">
      {entries.map(entry => (
        <div key={entry.id} className="flex items-center justify-between min-h-[48px] py-2 px-3 rounded-lg hover:bg-white/5 group">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{entry.name}</span>
              {entry.recurring === false && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">One-time</span>
              )}
            </div>
            <div className="text-xs text-white/40">{entry.category}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white/80 mr-1">${Number(entry.amount).toLocaleString()}</span>
            <button onClick={() => onEdit(entry)}
              className="p-2 text-white/40 hover:text-sky-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(entry.id)}
              className="p-2 text-white/40 hover:text-rose-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5">
          <div className="space-y-1.5">
            <div className="h-4 bg-white/10 rounded animate-pulse w-32" />
            <div className="h-3 bg-white/10 rounded animate-pulse w-20" />
          </div>
          <div className="h-4 bg-white/10 rounded animate-pulse w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Limit editor ──────────────────────────────────────────────────────────────
function LimitEditor({ category, limit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(limit ? String(limit) : '')

  const save = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) onSave(category, n)
    setEditing(false)
  }
  const clear = () => { onSave(category, null); setEditing(false) }

  if (editing) {
    return (
      <form onSubmit={e => { e.preventDefault(); save() }} className="flex items-center gap-1">
        <span className="text-white/40 text-xs">$</span>
        <input autoFocus type="number" inputMode="decimal" min="1" step="1"
          value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          className="w-20 px-2 py-1 border border-emerald-400/60 rounded text-xs font-semibold focus:outline-none" />
        <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
        {limit && <button type="button" onClick={clear} className="p-1 text-red-400 hover:text-rose-400 text-xs">✕ Remove</button>}
        <button type="button" onClick={() => setEditing(false)} className="p-1 text-white/40 hover:text-white/60"><X className="w-3 h-3" /></button>
      </form>
    )
  }

  return (
    <button onClick={() => { setVal(limit ? String(limit) : ''); setEditing(true) }}
      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors">
      <Pencil className="w-2.5 h-2.5" />
      {limit ? `Limit: $${Number(limit).toLocaleString()}` : 'Set limit'}
    </button>
  )
}

// ─── Spending breakdown (budget vs actual) ────────────────────────────────────
function SpendingBreakdown({ expenses, limits, onSetLimit, transactions }) {
  const byCategory = {}
  expenses.filter(e => e.recurring !== false).forEach(e => {
    const cat = e.category || 'Other'
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount)
  })

  // Actual spending from transactions this month
  const actualByCategory = {}
  transactions.forEach(t => {
    const cat = t.category || 'Other'
    actualByCategory[cat] = (actualByCategory[cat] ?? 0) + Number(t.amount)
  })

  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  if (!rows.length) return null

  const hasActual = transactions.length > 0

  return (
    <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-white/50" />
          Spending Breakdown
          {hasActual && (
            <span className="text-xs font-normal text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
              Actual vs Budget
            </span>
          )}
        </h2>
      </div>

      <div className="space-y-3">
        {rows.map(([cat, budgeted]) => {
          const limit   = limits[cat] ?? null
          const actual  = actualByCategory[cat] ?? 0
          // Use limit if set, else budgeted as the comparison baseline
          const cap     = limit ?? budgeted
          const spent   = hasActual ? actual : null
          const pct     = spent !== null ? Math.min((spent / (cap || 1)) * 100, 100) : null
          const over    = spent !== null && spent > cap
          const c       = catColor(cat)

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.bar}`} />
                  <span className="text-sm font-medium text-white">{cat}</span>
                  {over && (
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                      Over by ${(spent - cap).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {spent !== null ? (
                    <span className="text-sm font-semibold text-white/80">
                      ${spent.toLocaleString()} <span className="text-xs text-white/40 font-normal">/ ${cap.toLocaleString()}</span>
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-white/80">${budgeted.toLocaleString()}</span>
                  )}
                  <LimitEditor category={cat} limit={limit} onSave={onSetLimit} />
                </div>
              </div>
              {/* Bar: shows actual vs cap */}
              <div className="w-full bg-white/10 rounded-full h-1.5">
                {pct !== null ? (
                  <motion.div
                    className={`h-1.5 rounded-full ${over ? 'bg-red-500' : c.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                ) : (
                  <div className={`h-1.5 rounded-full ${c.bar} opacity-30 w-full`} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-white/40">
        {hasActual
          ? 'Bars show actual spending this month vs your budget. Tap "Set limit" to add a monthly cap.'
          : 'Log transactions below to see actual vs budgeted. Tap "Set limit" to set category caps.'}
      </p>
    </div>
  )
}

// ─── Transaction logger ────────────────────────────────────────────────────────
function TransactionLogger({ transactions, loading, onAdd, onDelete }) {
  const [open,     setOpen]     = useState(false)
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [note,     setNote]     = useState('')
  const [date,     setDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [showList, setShowList] = useState(false)

  const totalSpent = transactions.reduce((s, t) => s + Number(t.amount), 0)
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!amount) return
    onAdd({ amount: parseFloat(amount), category, note: note || null, date })
    setAmount(''); setNote('')
  }

  return (
    <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 md:px-5 py-4 hover:bg-white/5/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white text-sm">Log Actual Spending</span>
          {transactions.length > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
              ${totalSpent.toLocaleString()} this month
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-4 space-y-4 border-t border-white/10">
              <p className="text-xs text-white/40 pt-3">
                Track what you actually spend — see how it stacks up against your budget above.
              </p>

              {/* Quick log form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" required
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-white/[0.08] text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                    />
                  </div>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-white/[0.08] text-base sm:text-sm bg-[#0e1812] focus:outline-none focus:ring-1 focus:ring-emerald-400/30">
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-white/[0.08] text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="sm:w-36 px-3 py-2.5 rounded-lg border border-white/[0.08] text-base sm:text-sm bg-[#0e1812] focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
                </div>
                <button type="submit"
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Log expense
                </button>
              </form>

              {/* Transaction list */}
              {loading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-10 bg-white/10 rounded animate-pulse" />)}
                </div>
              ) : transactions.length > 0 ? (
                <div>
                  <button
                    onClick={() => setShowList(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 font-medium mb-2"
                  >
                    {showList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showList ? 'Hide' : 'Show'} {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} — {monthLabel}
                  </button>
                  <AnimatePresence>
                    {showList && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {[...transactions].sort((a, b) => b.date?.localeCompare(a.date ?? '') ?? 0).map(t => (
                            <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 group">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${catColor(t.category).bar}`} />
                                  <span className="text-sm font-medium text-white truncate">
                                    {t.note || t.category}
                                  </span>
                                  <span className="text-xs text-white/40">{t.category}</span>
                                </div>
                                {t.date && (
                                  <div className="text-xs text-white/40 ml-3.5">
                                    {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-semibold text-white/80">${Number(t.amount).toLocaleString()}</span>
                                <button onClick={() => onDelete(t.id)}
                                  className="p-1.5 text-white/30 hover:text-rose-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-xs text-white/40 text-center py-2">No transactions logged this month yet.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Budget() {
  const { user }  = useAuth()
  const [entries,      setEntries]      = useState([])
  const [limits,       setLimits]       = useState({})
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [txLoading,    setTxLoading]    = useState(true)
  const [editEntry,    setEditEntry]    = useState(null) // entry being edited

  useEffect(() => { load() }, [user.id])

  async function load() {
    const now      = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd   = nextMonth.toISOString().slice(0, 10)

    const [{ data: budgets }, { data: limitsData }, { data: txData }] = await Promise.all([
      supabase.from('budgets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('budget_limits').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('*').eq('user_id', user.id)
        .gte('date', monthStart).lt('date', monthEnd).order('date', { ascending: false }),
    ])
    setEntries(budgets ?? [])
    const limitsMap = {}
    ;(limitsData ?? []).forEach(l => { limitsMap[l.category] = Number(l.monthly_limit) })
    setLimits(limitsMap)
    setTransactions(txData ?? [])
    setLoading(false)
    setTxLoading(false)
  }

  async function handleAdd(entry) {
    const { data } = await supabase.from('budgets').insert({ ...entry, user_id: user.id }).select().single()
    if (data) setEntries(prev => [...prev, data])
  }

  async function handleEdit(updated) {
    const { name, amount, category, type, recurring } = updated
    await supabase.from('budgets').update({ name, amount, category, type, recurring }).eq('id', updated.id)
    setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, name, amount, category, type, recurring } : e))
    setEditEntry(null)
  }

  async function handleDelete(id) {
    await supabase.from('budgets').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleSetLimit(category, amount) {
    if (amount === null) {
      await supabase.from('budget_limits').delete().eq('user_id', user.id).eq('category', category)
      setLimits(prev => { const next = { ...prev }; delete next[category]; return next })
    } else {
      await supabase.from('budget_limits').upsert(
        { user_id: user.id, category, monthly_limit: amount },
        { onConflict: 'user_id,category' }
      )
      setLimits(prev => ({ ...prev, [category]: amount }))
    }
  }

  async function handleAddTransaction(tx) {
    const { data } = await supabase
      .from('transactions')
      .insert({ ...tx, user_id: user.id })
      .select()
      .single()
    if (data) setTransactions(prev => [data, ...prev])
  }

  async function handleDeleteTransaction(id) {
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const income   = entries.filter(e => e.type === 'income')
  const expenses = entries.filter(e => e.type === 'expense')

  const totalIncome     = income.filter(e => e.recurring !== false).reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses   = expenses.filter(e => e.recurring !== false).reduce((s, e) => s + Number(e.amount), 0)
  const net             = totalIncome - totalExpenses
  const oneTimeIncome   = income.filter(e => e.recurring === false).reduce((s, e) => s + Number(e.amount), 0)
  const oneTimeExpenses = expenses.filter(e => e.recurring === false).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Budget</h1>
          <p className="text-white/60 mt-1 text-sm">Track your monthly income and expenses</p>
        </div>
        <button
          onClick={() => exportCSV(entries, transactions)}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-white/15 hover:bg-white/25 border border-white/10 text-white/80 hover:text-white rounded-lg text-xs font-medium transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] shadow-sm p-4">
          <div className="flex items-center gap-2 text-emerald-300 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold">Recurring Income</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-emerald-300">${totalIncome.toLocaleString()}</div>
          {oneTimeIncome > 0 && <div className="text-xs text-amber-600 mt-1">+${oneTimeIncome.toLocaleString()} one-time ✦</div>}
        </div>
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] shadow-sm p-4">
          <div className="flex items-center gap-2 text-rose-400 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-semibold">Recurring Expenses</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-rose-300">${totalExpenses.toLocaleString()}</div>
          {oneTimeExpenses > 0 && <div className="text-xs text-white/50 mt-1">+${oneTimeExpenses.toLocaleString()} one-time</div>}
        </div>
        <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] shadow-sm p-4 col-span-2 sm:col-span-1">
          <div className={`flex items-center gap-2 mb-1 ${net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-semibold">Monthly Net</span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>
            {net >= 0 ? '+' : ''}${net.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Income
        </h2>
        <EntryForm type="income" onAdd={handleAdd} />
        {loading ? <ListSkeleton /> : <EntryList entries={income} onDelete={handleDelete} onEdit={setEditEntry} />}
      </div>

      {/* Expenses */}
      <div className="bg-white/[0.055] rounded-xl border border-white/[0.08] p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-400" /> Expenses
        </h2>
        <EntryForm type="expense" onAdd={handleAdd} />
        {loading ? <ListSkeleton /> : <EntryList entries={expenses} onDelete={handleDelete} onEdit={setEditEntry} />}
      </div>

      {/* Transaction logger */}
      <TransactionLogger
        transactions={transactions}
        loading={txLoading}
        onAdd={handleAddTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* Spending breakdown */}
      {!loading && expenses.length > 0 && (
        <SpendingBreakdown
          expenses={expenses}
          limits={limits}
          onSetLimit={handleSetLimit}
          transactions={transactions}
        />
      )}

      {/* Entry edit modal */}
      {editEntry && (
        <EntryEditModal
          entry={editEntry}
          onSave={handleEdit}
          onClose={() => setEditEntry(null)}
        />
      )}
    </motion.div>
  )
}
