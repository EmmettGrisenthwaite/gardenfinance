import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import GardenVisual from '@/components/garden/GardenVisual'
import Onboarding from '@/components/Onboarding'
import { DollarSign, Target, CreditCard, TrendingUp, Wallet, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const PROFILE_FIELDS = [
  { key: 'age',              label: 'Age' },
  { key: 'employment_type',  label: 'Employment type' },
  { key: 'employer_401k',    label: '401k status' },
  { key: 'investment_types', label: 'Investment accounts', check: v => Array.isArray(v) && v.length > 0 },
  { key: 'health_insurance', label: 'Health insurance' },
  { key: 'primary_goal',     label: 'Primary goal' },
]

function profileCompleteness(profile) {
  if (!profile) return { filled: 0, total: PROFILE_FIELDS.length, missing: PROFILE_FIELDS.map(f => f.label) }
  const filled  = PROFILE_FIELDS.filter(f => f.check ? f.check(profile[f.key]) : !!profile[f.key])
  const missing = PROFILE_FIELDS.filter(f => !(f.check ? f.check(profile[f.key]) : !!profile[f.key]))
  return { filled: filled.length, total: PROFILE_FIELDS.length, missing: missing.map(f => f.label) }
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="w-9 h-9 bg-gray-100 rounded-lg mb-3 animate-pulse" />
      <div className="h-6 bg-gray-100 rounded animate-pulse mb-1.5 w-20" />
      <div className="h-3.5 bg-gray-100 rounded animate-pulse w-24" />
    </div>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [goals,           setGoals]           = useState([])
  const [budgets,         setBudgets]         = useState([])
  const [debts,           setDebts]           = useState([])
  const [accounts,        setAccounts]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [showOnboarding,  setShowOnboarding]  = useState(false)

  const { filled, total, missing } = profileCompleteness(profile)
  const isProfileIncomplete = filled < total

  useEffect(() => {
    async function load() {
      const [g, b, d, a] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
      ])
      setGoals(g.data ?? [])
      setBudgets(b.data ?? [])
      setDebts(d.data ?? [])
      setAccounts(a.data ?? [])
      setLoading(false)
    }
    load()
  }, [user.id])

  const recurringIncome   = budgets.filter(b => b.type === 'income'  && b.recurring !== false).reduce((s, b) => s + Number(b.amount), 0)
  const recurringExpenses = budgets.filter(b => b.type === 'expense' && b.recurring !== false).reduce((s, b) => s + Number(b.amount), 0)
  const net        = recurringIncome - recurringExpenses
  const totalDebt  = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const netWorth   = totalAssets - totalDebt

  const name = user.user_metadata?.full_name?.split(' ')[0] || 'there'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { label: 'Monthly Income',   value: `$${recurringIncome.toLocaleString()}`,   icon: DollarSign, color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Monthly Expenses', value: `$${recurringExpenses.toLocaleString()}`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Active Goals',     value: goals.length,                              icon: Target,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Total Debt',       value: `$${totalDebt.toLocaleString()}`,          icon: CreditCard, color: 'text-red-600',    bg: 'bg-red-50'    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {name} 👋</h1>
        <p className="text-gray-500 mt-1 text-sm">Here's how your financial garden is growing.</p>
      </div>

      {/* Profile completeness banner */}
      {isProfileIncomplete && !loading && (
        <button
          onClick={() => setShowOnboarding(true)}
          className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50/40 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <UserCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800">
              Complete your advisor profile — {filled}/{total} done
            </div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">
              Missing: {missing.join(', ')}
            </div>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-amber-400 transition-all"
                style={{ width: `${(filled / total) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-amber-600 group-hover:text-amber-700 flex-shrink-0">
            Add info →
          </span>
        </button>
      )}

      {/* Quick stats — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {loading
          ? [1, 2, 3, 4].map(i => <StatSkeleton key={i} />)
          : stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className={`inline-flex items-center justify-center w-9 h-9 ${bg} rounded-lg mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))
        }
      </div>

      {/* Net worth banner */}
      {!loading && accounts.length > 0 && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${netWorth >= 0 ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'}`}>
          <div className="flex items-center gap-3">
            <Wallet className={`w-5 h-5 flex-shrink-0 ${netWorth >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            <div>
              <div className={`text-sm font-semibold ${netWorth >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                Net Worth: {netWorth >= 0 ? '' : '-'}${Math.abs(netWorth).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">
                ${totalAssets.toLocaleString()} assets · ${totalDebt.toLocaleString()} debt
              </div>
            </div>
          </div>
          <Link to="/accounts" className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0">
            View
          </Link>
        </div>
      )}

      {/* Prompt to add accounts */}
      {!loading && accounts.length === 0 && (budgets.length > 0 || goals.length > 0) && (
        <Link to="/accounts"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50/40 transition-colors group">
          <div className="w-9 h-9 bg-gray-50 group-hover:bg-green-100 rounded-lg flex items-center justify-center transition-colors flex-shrink-0">
            <Wallet className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 group-hover:text-green-800">Add your account balances</div>
            <div className="text-xs text-gray-400">Checking, savings, retirement — lets your advisor see your full picture</div>
          </div>
        </Link>
      )}

      {/* Garden visual */}
      {loading ? (
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      ) : (
        <GardenVisual goals={goals} budgets={budgets} debts={debts} />
      )}

      {/* Monthly net summary */}
      {!loading && (recurringIncome > 0 || recurringExpenses > 0) && (
        <div className={`rounded-xl p-4 text-sm font-medium ${net >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {net >= 0
            ? `You have a $${net.toLocaleString()} monthly surplus — great work! 🌱`
            : `You're spending $${Math.abs(net).toLocaleString()} more than you earn monthly. Time to weed the garden.`}
        </div>
      )}
    </motion.div>
  )
}
