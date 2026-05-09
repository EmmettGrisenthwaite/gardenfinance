import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, X, CreditCard, Flame } from 'lucide-react'
import { motion } from 'framer-motion'

function DebtModal({ debt, onSave, onClose }) {
  const [name, setName] = useState(debt?.name ?? '')
  const [balance, setBalance] = useState(debt?.balance ?? '')
  const [interestRate, setInterestRate] = useState(debt?.interest_rate ?? '')
  const [minPayment, setMinPayment] = useState(debt?.minimum_payment ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      name,
      balance: parseFloat(balance),
      interest_rate: parseFloat(interestRate) || 0,
      minimum_payment: parseFloat(minPayment) || 0,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{debt ? 'Edit Debt' : 'Add Debt'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Debt name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Student loan"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Balance ($)</label>
                <input type="number" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} required min="0" step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Interest rate (%)</label>
                <input type="number" inputMode="decimal" value={interestRate} onChange={e => setInterestRate(e.target.value)} min="0" max="100" step="0.01" placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum monthly payment ($)</label>
              <input type="number" inputMode="decimal" value={minPayment} onChange={e => setMinPayment(e.target.value)} min="0" step="0.01" placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Debt() {
  const { user } = useAuth()
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { load() }, [user.id])

  async function load() {
    const { data } = await supabase.from('debts').select('*').eq('user_id', user.id).order('created_at')
    setDebts(data ?? [])
    setLoading(false)
  }

  async function handleSave(data) {
    if (modal && modal !== 'new') {
      await supabase.from('debts').update(data).eq('id', modal.id)
    } else {
      await supabase.from('debts').insert({ ...data, user_id: user.id })
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(d => d.id !== id))
  }

  const totalDebt       = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalMinPayment = debts.reduce((s, d) => s + Number(d.minimum_payment), 0)
  const avalancheOrder  = [...debts].sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debt</h1>
          <p className="text-gray-500 mt-1 text-sm">Track and strategize your payoff plan</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Debt
        </button>
      </div>

      {/* Summary */}
      {!loading && debts.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl p-4">
            <div className="text-xs text-red-700 font-medium mb-1">Total Debt</div>
            <div className="text-2xl font-bold text-red-800">${totalDebt.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="text-xs text-orange-700 font-medium mb-1">Min. Monthly Payments</div>
            <div className="text-2xl font-bold text-orange-800">${totalMinPayment.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Payoff strategy */}
      {!loading && debts.length > 1 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">Avalanche Strategy — Recommended Order</span>
          </div>
          <p className="text-xs text-amber-700 mb-3">Pay minimums on all debts, then put extra money toward the highest-interest debt first. This saves the most money overall.</p>
          <ol className="space-y-1.5">
            {avalancheOrder.map((debt, i) => (
              <li key={debt.id} className="flex items-center gap-2.5 text-sm text-amber-900">
                <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <span className="font-medium flex-1 min-w-0 truncate">{debt.name}</span>
                <span className="text-amber-600 text-xs flex-shrink-0">{Number(debt.interest_rate).toFixed(1)}% APR</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Debt list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : debts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-gray-800 font-semibold text-sm mb-1">No debts tracked</p>
          <p className="text-gray-400 text-xs max-w-xs mx-auto">
            Debt-free or just getting started — add any loans or cards to plan your payoff strategy.
          </p>
          <button onClick={() => setModal('new')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add a debt
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map(debt => (
            <div key={debt.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{debt.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Number(debt.interest_rate) > 0 ? `${Number(debt.interest_rate).toFixed(1)}% APR` : 'No interest'}
                      {Number(debt.minimum_payment) > 0 && ` · $${Number(debt.minimum_payment).toLocaleString()} min/mo`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-lg font-bold text-gray-900">${Number(debt.balance).toLocaleString()}</span>
                  <button onClick={() => setModal(debt)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(debt.id)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DebtModal debt={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </motion.div>
  )
}
