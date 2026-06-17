import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Plus, Trash2, Pencil, X, Check, CalendarClock, TrendingUp, Sprout, Target } from 'lucide-react'
import { motion } from 'framer-motion'

// ─── Timeline projection ───────────────────────────────────────────────────────
function getProjection(goal) {
  const target  = Number(goal.target_amount)
  const current = Number(goal.current_amount)
  const monthly = Number(goal.monthly_contribution)
  if (target - current <= 0) return { done: true }
  if (!monthly || monthly <= 0) return null

  let monthsLeft
  if (goal.goal_type === 'investment') {
    // Investment goals compound — project growth at ~6%/yr so long horizons are
    // realistic (a linear estimate badly overstates the time for big targets).
    const i = 0.06 / 12
    let bal = current, n = 0
    while (bal < target && n < 1200) { bal = bal * (1 + i) + monthly; n++ }
    monthsLeft = n
  } else {
    monthsLeft = Math.ceil((target - current) / monthly)
  }

  if (monthsLeft >= 1200) return { longTerm: true }   // >100 yrs even with growth
  const date = new Date()
  date.setMonth(date.getMonth() + monthsLeft)
  const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { monthsLeft, label }
}

// ─── Goal modal ────────────────────────────────────────────────────────────────
function GoalModal({ goal, onSave, onClose }) {
  const [name,         setName]         = useState(goal?.name ?? '')
  const [target,       setTarget]       = useState(goal?.target_amount ?? '')
  const [current,      setCurrent]      = useState(goal?.current_amount ?? 0)
  const [deadline,     setDeadline]     = useState(goal?.deadline ?? '')
  const [contribution, setContribution] = useState(goal?.monthly_contribution ?? '')
  const [goalType,     setGoalType]     = useState(goal?.goal_type ?? 'savings')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      name,
      goal_type:            goalType,
      target_amount:        parseFloat(target),
      current_amount:       parseFloat(current),
      deadline:             deadline || null,
      monthly_contribution: contribution !== '' ? parseFloat(contribution) : 0,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-xl sm:w-full sm:max-w-md sm:mx-4 rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[75vh] sm:max-h-none">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Goal type selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Goal type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setGoalType('savings')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    goalType === 'savings'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  <Sprout className="w-4 h-4" /><span>Savings / Purchase</span>
                </button>
                <button type="button" onClick={() => setGoalType('investment')}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    goalType === 'investment'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  <TrendingUp className="w-4 h-4" /><span>Investment / Wealth</span>
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {goalType === 'investment'
                  ? 'Grows a golden tree in the investment zone as your wealth builds'
                  : 'Grows a green tree in your garden as you save toward it'}
              </p>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Monthly contribution ($)
                <span className="ml-1 font-normal text-gray-400">— enables timeline projection</span>
              </label>
              <input type="number" inputMode="decimal" value={contribution} onChange={e => setContribution(e.target.value)}
                min="0" step="0.01" placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
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

// ─── Inline progress updater ───────────────────────────────────────────────────
function ProgressInput({ goal, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(goal.current_amount)

  const save = () => { onUpdate(goal.id, parseFloat(value)); setEditing(false) }
  const pct  = Math.min(Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100), 100)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">
          ${Number(goal.current_amount).toLocaleString()} of ${Number(goal.target_amount).toLocaleString()}
        </span>
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

// ─── Timeline badge ────────────────────────────────────────────────────────────
function TimelineBadge({ goal }) {
  const proj = getProjection(goal)
  if (!proj) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <CalendarClock className="w-3 h-3 text-gray-300" />
        <span className="text-xs text-gray-400">Set a monthly contribution to see your timeline</span>
      </div>
    )
  }
  if (proj.done) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-lg border border-green-200">
        <Check className="w-3 h-3 text-green-600" />
        <span className="text-xs font-semibold text-green-700">Goal reached</span>
      </div>
    )
  }
  if (proj.longTerm) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-200">
        <CalendarClock className="w-3 h-3 text-blue-500" />
        <span className="text-xs font-medium text-blue-700">Long-term — grows with your contributions</span>
      </div>
    )
  }
  const urgency = proj.monthsLeft <= 3  ? 'bg-green-50 border-green-200 text-green-700'
                : proj.monthsLeft <= 12 ? 'bg-blue-50 border-blue-200 text-blue-700'
                :                         'bg-gray-50 border-gray-200 text-gray-600'
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${urgency}`}>
      <CalendarClock className="w-3 h-3" />
      <span className="text-xs font-medium">
        On pace for {proj.label}
        <span className="font-normal opacity-70 ml-1">({proj.monthsLeft} mo)</span>
      </span>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Goals() {
  const { user } = useAuth()
  const [goals,   setGoals]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)

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

  const totalSaved        = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalTarget       = goals.reduce((s, g) => s + Number(g.target_amount), 0)
  const totalContribution = goals.reduce((s, g) => s + Number(g.monthly_contribution || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-24 md:pb-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium text-white drop-shadow-lg">Goals</h1>
          <p className="text-white/60 mt-1 text-sm">Track your savings progress</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {/* Summary cards */}
      {!loading && goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-4">
            <div className="text-xs text-green-700 font-semibold mb-1">Total Saved</div>
            <div className="text-xl font-bold text-green-800">${totalSaved.toLocaleString()}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-4">
            <div className="text-xs text-blue-700 font-semibold mb-1">Total Target</div>
            <div className="text-xl font-bold text-blue-800">${totalTarget.toLocaleString()}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/50 shadow-sm p-4">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-purple-600" />
              <div className="text-xs text-purple-700 font-semibold">Monthly</div>
            </div>
            <div className="text-xl font-bold text-purple-800">
              {totalContribution > 0 ? `$${totalContribution.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/30 rounded-xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg p-10 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
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
            <motion.div key={goal.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-md rounded-xl border border-white/40 shadow-lg p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="font-semibold text-gray-900 break-words">{goal.name}</h3>
                    {(goal.goal_type === 'investment') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                        <TrendingUp className="w-3 h-3" /> Investment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                        <Sprout className="w-3 h-3" /> Savings
                      </span>
                    )}
                  </div>
                  {goal.deadline && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Target date: {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
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
              <TimelineBadge goal={goal} />
            </motion.div>
          ))}
        </div>
      )}

      {modal && (
        <GoalModal goal={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </motion.div>
  )
}
