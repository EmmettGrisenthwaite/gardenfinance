import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { netWorthTrajectory } from '@/lib/financeArtifacts'
import { TrendingUp, Sprout, DollarSign } from 'lucide-react'

export default function NetWorthTrajectoryArtifact({ assets, debts, monthlySurplus }) {
  const result = useMemo(() => {
    return netWorthTrajectory(assets, debts, monthlySurplus, 10)
  }, [assets, debts, monthlySurplus])

  const currentNetWorth = (assets || 0) - (debts || 0)

  if (!result || !result.trajectory || result.trajectory.length === 0) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.10] rounded-xl p-4 mt-3">
        <div className="text-center py-4">
          <TrendingUp className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/50">Add your money data to see net worth projections</p>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...result.trajectory.map(t => t.netWorth), currentNetWorth, 1)
  const y1 = result.year1?.netWorth || 0
  const y5 = result.year5?.netWorth || 0
  const y10 = result.year10?.netWorth || 0

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
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-sky-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Your Future Net Worth</h4>
            <p className="text-[11px] text-white/40">If you keep going at this pace</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Sparkline chart */}
          <div className="relative h-24 bg-white/[0.03] rounded-xl overflow-hidden">
            <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 10, 20, 30, 40].map(y => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
              ))}
              {/* Trajectory line */}
              <polyline
                fill="none"
                stroke="rgb(14, 165, 233)"
                strokeWidth="1.5"
                points={result.trajectory.map((t, i) => {
                  const x = (i / (result.trajectory.length - 1)) * 100
                  const y = 40 - ((t.netWorth / maxValue) * 35 + 2)
                  return `${x},${y}`
                }).join(' ')}
              />
              {/* Area fill */}
              <polygon
                fill="rgba(14, 165, 233, 0.15)"
                points={`
                  0,40
                  ${result.trajectory.map((t, i) => {
                    const x = (i / (result.trajectory.length - 1)) * 100
                    const y = 40 - ((t.netWorth / maxValue) * 35 + 2)
                    return `${x},${y}`
                  }).join(' ')}
                  100,40
                `}
              />
              {/* Current point dot */}
              <circle
                cx="0"
                cy={40 - ((currentNetWorth / maxValue) * 35 + 2)}
                r="2"
                fill="rgb(16, 185, 129)"
              />
            </svg>
            {/* Year labels */}
            <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2">
              <span className="text-[9px] text-white/30">Now</span>
              <span className="text-[9px] text-white/30">5yr</span>
              <span className="text-[9px] text-white/30">10yr</span>
            </div>
          </div>

          {/* Milestones */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400/70 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">${y1.toLocaleString()}</p>
              <p className="text-[9px] text-white/40">1 year</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
              <Sprout className="w-3.5 h-3.5 text-emerald-400/70 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">${y5.toLocaleString()}</p>
              <p className="text-[9px] text-white/40">5 years</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400/70 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">${y10.toLocaleString()}</p>
              <p className="text-[9px] text-white/40">10 years</p>
            </div>
          </div>

          {/* Motivational copy */}
          <div className="flex items-start gap-2 bg-emerald-500/8 rounded-lg px-3 py-2">
            <Sprout className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              {currentNetWorth < 0
                ? `Your net worth is negative now, but with ${monthlySurplus > 0 ? `$${monthlySurplus.toLocaleString()}/mo surplus` : 'consistent effort'} you'll turn positive and keep growing.`
                : `Keep this up and your net worth could grow to $${y10.toLocaleString()} in 10 years. The power of compounding works best when you start early.`
              }
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
