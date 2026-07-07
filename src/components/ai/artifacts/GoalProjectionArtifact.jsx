import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getProjection, formatDateLabel, formatMonths } from '@/lib/financeArtifacts'
import Slider from '@/components/ui/slider'
import { Target, Calendar, TrendingUp, DollarSign, CheckCircle, AlertCircle } from 'lucide-react'

export default function GoalProjectionArtifact({ goal, monthlyIncome, onUpdateGoal }) {
  const [monthlyContribution, setMonthlyContribution] = useState(
    goal?.monthly_contribution || Math.round((monthlyIncome || 0) * 0.1)
  )

  const result = useMemo(() => {
    if (!goal) return null
    return getProjection(goal, monthlyContribution)
  }, [goal, monthlyContribution])

  if (!goal) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.10] rounded-xl p-4 mt-3">
        <div className="text-center py-4">
          <Target className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/50">Set a goal to see contribution projections</p>
        </div>
      </div>
    )
  }

  const maxContribution = Math.max(
    monthlyContribution,
    Math.round((monthlyIncome || 0) * 0.5),
    goal.target_amount || 1000
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3"
    >
      <div className="bg-white/[0.05] border border-white/[0.10] rounded-xl overflow-hidden mt-3">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Target className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{goal.name}</h4>
            <p className="text-[11px] text-white/40">
              ${(goal.current_amount || 0).toLocaleString()} of ${(goal.target_amount || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Slider */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60">Monthly contribution</span>
              <span className="text-sm font-bold text-amber-300">${monthlyContribution}/mo</span>
            </div>
            <Slider
              value={[monthlyContribution]}
              onValueChange={([v]) => setMonthlyContribution(v)}
              min={10}
              max={Math.max(maxContribution, 500)}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-white/30">$10</span>
              <span className="text-[10px] text-white/30">${Math.round(maxContribution / 2)}</span>
              <span className="text-[10px] text-white/30">${maxContribution}</span>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <Calendar className="w-4 h-4 text-amber-400/70 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {result?.reachedByDate ? formatDateLabel(result.reachedByDate) : '—'}
              </p>
              <p className="text-[10px] text-white/40">Reached by</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <TrendingUp className="w-4 h-4 text-amber-400/70 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {result?.monthsToGoal !== Infinity ? formatMonths(result.monthsToGoal) : '—'}
              </p>
              <p className="text-[10px] text-white/40">Months to goal</p>
            </div>
          </div>

          {/* On-track indicator */}
          {result && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
              result.onTrack
                ? 'bg-emerald-500/10'
                : 'bg-amber-500/10'
            }`}>
              {result.onTrack ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              )}
              <p className={`text-xs ${result.onTrack ? 'text-emerald-200' : 'text-amber-200'}`}>
                {result.onTrack
                  ? `On track${goal.deadline ? ' for your deadline' : ''}`
                  : `Behind schedule — need $${Math.ceil((result.remaining || 0) / Math.max(1, result.monthsToGoal))}/mo to hit deadline`
                }
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{Math.round(result?.percentComplete || 0)}% complete</span>
              <span>${(result?.remaining || 0).toLocaleString()} to go</span>
            </div>
            <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, result?.percentComplete || 0)}%` }}
              />
            </div>
          </div>

          {/* Action button */}
          {onUpdateGoal && monthlyContribution !== (goal.monthly_contribution || 0) && (
            <button
              onClick={() => onUpdateGoal(goal.id, { monthly_contribution: monthlyContribution })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Update goal to ${monthlyContribution}/mo
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
