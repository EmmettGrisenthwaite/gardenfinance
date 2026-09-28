import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getProjection, formatDateLabel, formatMonths } from '@/lib/financeArtifacts'
import Slider from '@/components/ui/slider'

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
      <p className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4 text-[14px] text-readable-secondary">
        Set a goal to see how fast contributions get you there.
      </p>
    )
  }

  const maxContribution = Math.max(
    monthlyContribution,
    Math.round((monthlyIncome || 0) * 0.5),
    goal.target_amount || 1000
  )
  const sliderMax = Math.max(maxContribution, 500)
  const percent = Math.min(100, result?.percentComplete || 0)
  // What it takes to land on the deadline comes from the months left until it,
  // not from the months the current pace would need.
  const now = new Date()
  const deadline = goal.deadline ? new Date(`${String(goal.deadline).slice(0, 10)}T12:00:00`) : null
  const monthsLeft = deadline ? (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()) : null
  const neededMonthly = monthsLeft > 0 ? Math.ceil((result?.remaining || 0) / monthsLeft) : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label={goal.name}
      className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="min-w-0 truncate text-[15px] font-semibold text-white">{goal.name}</h4>
        <p className="shrink-0 text-[13px] tabular-nums text-readable-muted">
          ${(goal.current_amount || 0).toLocaleString()} of ${(goal.target_amount || 0).toLocaleString()}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[14px] text-readable-secondary">Monthly contribution</span>
          <span className="text-[15px] font-semibold tabular-nums text-emerald-200">${monthlyContribution.toLocaleString()}/mo</span>
        </div>
        <Slider
          value={[monthlyContribution]}
          onValueChange={([v]) => setMonthlyContribution(v)}
          min={10}
          max={sliderMax}
          step={10}
          className="w-full"
        />
        <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-readable-muted">
          <span>$10</span>
          <span>${Math.round(sliderMax / 2).toLocaleString()}</span>
          <span>${sliderMax.toLocaleString()}</span>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.07]">
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[14px] text-readable-secondary">Reached by</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-white">
            {result?.reachedByDate ? formatDateLabel(result.reachedByDate) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[14px] text-readable-secondary">Time to goal</dt>
          <dd className="text-[16px] font-semibold tabular-nums text-white">
            {result?.monthsToGoal !== Infinity ? formatMonths(result.monthsToGoal) : '—'}
          </dd>
        </div>
      </dl>

      {result && (
        <p className={`mt-3 text-[14px] leading-5 ${result.onTrack ? 'text-emerald-200' : 'text-amber-200'}`}>
          {result.onTrack
            ? `On track${goal.deadline ? ' for your deadline' : ''}. $${(result.remaining || 0).toLocaleString()} to go.`
            : neededMonthly
              ? `Behind your deadline. It takes about $${neededMonthly.toLocaleString()}/mo to get there on time.`
              : 'Past its deadline. Pick a new date, or keep going at this pace.'}
        </p>
      )}

      {onUpdateGoal && monthlyContribution !== (goal.monthly_contribution || 0) && (
        <button
          type="button"
          onClick={() => onUpdateGoal(goal.id, { monthly_contribution: monthlyContribution })}
          className="btn-primary mt-4 min-h-11 w-full text-[15px]"
        >
          Update goal to ${monthlyContribution.toLocaleString()}/mo
        </button>
      )}
    </motion.section>
  )
}
