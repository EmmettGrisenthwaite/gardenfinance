import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, RefreshCw, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const EXPENSE_CATEGORIES = ['Housing', 'Food', 'Transport', 'Healthcare', 'Entertainment', 'Utilities', 'Savings', 'Other']
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Side Hustle', 'Other']

function EntryForm({ type, onAdd }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [recurring, setRecurring] = useState(true)
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !amount) return
    onAdd({ name, amount: parseFloat(amount), category: category || categories[0], type, recurring })
    setName('')
    setAmount('')
    setCategory('')
    setRecurring(true)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
          min="0"
          step="0.01"
          className="sm:w-32 px-3 py-2.5 rounded-lg border border-gray-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="min-h-[44px] px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {/* Recurring toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setRecurring(true)}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            recurring ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-3 h-3" /> Repeats monthly
        </button>
        <button
          type="button"
          onClick={() => setRecurring(false)}
          className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !recurring ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <Zap className="w-3 h-3" /> One-time
        </button>
        <span className="text-xs text-gray-400">
          {recurring ? 'Counts toward garden health' : type === 'income' ? 'Logged as windfall ✦' : "Tracked but won't affect garden"}
        </span>
      </div>
    </div>
  )
}

function EntryList({ entries, onDelete }) {
  if (!entries.length) return (
    <div className="py-8 text-center">
      <div className="text-3xl mb-2">🌱</div>
      <p className="text-sm text-gray-500 font-medium">No entries yet</p>
      <p className="text-xs text-gray-400 mt-1">Add your income and expenses above</p>
    </div>
  )
  return (
    <div className="space-y-1">
      {entries.map(entry => (
        <div key={entry.id} className="flex items-center justify-between min-h-[48px] py-2 px-3 rounded-lg hover:bg-gray-50 group">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{entry.name}</span>
              {entry.recurring === false && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">One-time</span>
              )}
            </div>
            <div className="text-xs text-gray-400">{entry.category}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">${Number(entry.amount).toLocaleString()}</span>
            <button
              onClick={() => onDelete(entry.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
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
            <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-20" />
          </div>
          <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
        </div>
      ))}
    </div>
  )
}

export default function Budget() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [user.id])

  async function load() {
    const { data } = await supabase.from('budgets').select('*').eq('user_id', user.id).order('created_at')
    setEntries(data ?? [])
    setLoading(false)
  }

  async function handleAdd(entry) {
    const { data } = await supabase.from('budgets').insert({ ...entry, user_id: user.id }).select().single()
    if (data) setEntries(prev => [...prev, data])
  }

  async function handleDelete(id) {
    await supabase.from('budgets').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const income = entries.filter(e => e.type === 'income')
  const expenses = entries.filter(e => e.type === 'expense')

  const totalIncome   = income.filter(e => e.recurring !== false).reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = expenses.filter(e => e.recurring !== false).reduce((s, e) => s + Number(e.amount), 0)
  const net = totalIncome - totalExpenses

  const oneTimeIncome   = income.filter(e => e.recurring === false).reduce((s, e) => s + Number(e.amount), 0)
  const oneTimeExpenses = expenses.filter(e => e.recurring === false).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
        <p className="text-gray-500 mt-1 text-sm">Track your monthly income and expenses</p>
      </div>

      {/* Summary — 2 cols on mobile, 3 on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Recurring Income</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-green-800">${totalIncome.toLocaleString()}</div>
          {oneTimeIncome > 0 && <div className="text-xs text-amber-600 mt-1">+${oneTimeIncome.toLocaleString()} one-time ✦</div>}
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium">Recurring Expenses</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-red-800">${totalExpenses.toLocaleString()}</div>
          {oneTimeExpenses > 0 && <div className="text-xs text-gray-500 mt-1">+${oneTimeExpenses.toLocaleString()} one-time</div>}
        </div>
        <div className={`rounded-xl p-4 col-span-2 sm:col-span-1 ${net >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <div className={`flex items-center gap-2 mb-1 ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Monthly Net</span>
          </div>
          <div className={`text-xl md:text-2xl font-bold ${net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
            {net >= 0 ? '+' : ''}${net.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" /> Income
        </h2>
        <EntryForm type="income" onAdd={handleAdd} />
        {loading ? <ListSkeleton /> : <EntryList entries={income} onDelete={handleDelete} />}
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" /> Expenses
        </h2>
        <EntryForm type="expense" onAdd={handleAdd} />
        {loading ? <ListSkeleton /> : <EntryList entries={expenses} onDelete={handleDelete} />}
      </div>
    </motion.div>
  )
}
