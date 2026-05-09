import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import { motion } from 'framer-motion'

function GoalModal({ goal, onSave, onClose }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal?.target_amount ?? '')
  const [current, setCurrent] = useState(goal?.current_amount ?? 0)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ name, target_amount: parseFloat(target), current_amount: parseFloat(current), deadline: deadline || null })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50">
      {/* Full-screen on mobile, modal on sm+ */}
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] sm:max-h-none">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Goal name</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Emergency fund"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Target ($)</label>
                <input type="number" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} required min="1" step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Saved so far ($)</label>
                <input type="number" inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value)} min="0" step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Target date (optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
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

function ProgressInput({ goal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(goal.current_amount)

  const save = () => {
    onUpdate(goal.id, parseFloat(value))
    setEditing(false)
  }

  const pct = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">${Number(goal.current_amount).toLocaleString()} of ${Number(goal.target_amount).toLocaleString()}</span>
        <span className="text-xs font-semibold text-green-700">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      {editing ? (
        <div className="flex gap-2 items-center">
          <input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)}
            min="0" max={goal.target_amount} step="0.01"
            className="flex-1 px-2.5 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={save} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-green-600 hover:underline font-medium py-1">
          Update progress
        </button>
      )}
    </div>
  )
}

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { load() }, [user.id])

  async function load() {
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    setGoals(data ?? [])
    setLoading(false)
  }

  async function handleSave(data) {
    if (modal && modal !== 'new') {
      await supabase.from('goals').update(data).eq('id', modal.id)
    } else {
      await supabase.from('goals').insert({ ...data, user_id: user.id })
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function handleUpdateProgress(id, amount) {
    await supabase.from('goals').update({ current_amount: amount }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_amount: amount } : g))
  }

  const totalSaved  = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-500 mt-1 text-sm">Track your savings progress</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {/* Summary */}
      {!loading && goals.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs text-green-700 font-medium mb-1">Total Saved</div>
            <div className="text-2xl font-bold text-green-800">${totalSaved.toLocaleString()}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-xs text-blue-700 font-medium mb-1">Total Target</div>
            <div className="text-2xl font-bold text-blue-800">${totalTarget.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <p className="text-gray-800 font-semibold text-sm mb-1">No goals yet</p>
          <p className="text-gray-400 text-xs max-w-xs mx-auto">
            What are you saving toward? A house, emergency fund, or trip? Add a goal to plant your first tree.
          </p>
          <button onClick={() => setModal('new')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => (
            <div key={goal.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                  {goal.deadline && (
                    <p className="text-xs text-gray-400 mt-0.5">By {new Date(goal.deadline).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setModal(goal)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(goal.id)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <ProgressInput goal={goal} onUpdate={handleUpdateProgress} />
            </div>
          ))}
        </div>
      )}

      {modal && (
        <GoalModal goal={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </motion.div>
  )
}
