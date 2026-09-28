import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { netWorthTrajectory } from '@/lib/financeArtifacts'

const signed = value => `${value < 0 ? '−' : ''}$${Math.abs(Math.round(value)).toLocaleString()}`

export default function NetWorthTrajectoryArtifact({ assets, debts, monthlySurplus }) {
  const result = useMemo(() => {
    return netWorthTrajectory(assets, debts, monthlySurplus, 10)
  }, [assets, debts, monthlySurplus])

  const currentNetWorth = (assets || 0) - (debts || 0)

  if (!result || !result.trajectory || result.trajectory.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4 text-[14px] text-readable-secondary">
        Add your money to see where your net worth is heading.
      </p>
    )
  }

  // Scale to the real range, so a negative start sits below a zero line
  // instead of being clipped off the bottom of the chart.
  const values = [...result.trajectory.map(t => t.netWorth), currentNetWorth]
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const yFor = value => 38 - ((value - min) / (max - min || 1)) * 34
  const points = result.trajectory.map((t, i) => `${(i / (result.trajectory.length - 1)) * 100},${yFor(t.netWorth)}`).join(' ')
  const y1 = result.year1?.netWorth || 0
  const y5 = result.year5?.netWorth || 0
  const y10 = result.year10?.netWorth || 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="Net worth projection"
      className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4"
    >
      <h4 className="text-[15px] font-semibold text-white">Where your net worth is heading</h4>
      <p className="mt-0.5 text-[13px] text-readable-muted">If you keep going at this pace.</p>

      <div className="mt-4">
        <svg viewBox="0 0 100 40" className="h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          {min < 0 && (
            <line x1="0" x2="100" y1={yFor(0)} y2={yFor(0)} stroke="rgba(255,255,255,0.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
          <polygon fill="url(#nw-fill)" points={`0,40 ${points} 100,40`} />
          <polyline fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" points={points} />
        </svg>
        <div className="mt-1 flex justify-between text-[12px] text-readable-muted">
          <span>Now</span>
          <span>5 years</span>
          <span>10 years</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
        {[['In 1 year', y1], ['In 5 years', y5], ['In 10 years', y10]].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-readable-muted">{label}</dt>
            <dd className="mt-0.5 text-[16px] font-semibold tabular-nums text-white">{signed(value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[14px] leading-5 text-readable-secondary">
        {currentNetWorth < 0
          ? `You are below zero today. With ${monthlySurplus > 0 ? `$${monthlySurplus.toLocaleString()}/mo to work with` : 'steady progress'}, that turns around and keeps growing.`
          : 'Most of the growth comes late. Money invested early has the longest time to compound.'}
      </p>
    </motion.section>
  )
}
