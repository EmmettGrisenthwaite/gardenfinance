import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { debtFreedomWithExtra, formatDateLabel, formatMonths } from '@/lib/financeArtifacts'
import Slider from '@/components/ui/slider'
import { CreditCard, TrendingDown, Calendar, Target } from 'lucide-react'

export default function DebtPayoffArtifact({ debts, monthlySurplus = 0, onAddStep }) {
  // Start the calculator at the user's REAL monthly surplus (what the advisor's
  // advice assumes), not an arbitrary $50 that may not even outrun interest.
  const [extraPayment, setExtraPayment] = useState(() =>
    Math.min(1000, Math.max(50, Math.round((Number(monthlySurplus) || 0) / 25) * 25 || 50)))

  const result = useMemo(() => {
    if (!debts || debts.length === 0) return null
    return debtFreedomWithExtra(debts, extraPayment)
  }, [debts, extraPayment])

  if (!debts || debts.length === 0) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.10] rounded-xl p-4 mt-3">
        <div className="text-center py-4">
          <CreditCard className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/50">Add your debts to see payoff projections</p>
        </div>
      </div>
    )
  }

  // NOTE: a "stuck" result (payment loses to interest) must NOT hide the card —
  // the slider is the only way out of that state. It renders inline below.
  const stuck = !result || result.stuck
  const totalDebt = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0)
  const topDebt = [...debts].sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0]

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
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Debt Payoff Calculator</h4>
            <p className="text-[11px] text-white/40">${totalDebt.toLocaleString()} total · {debts.length} debt{debts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Slider */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60">Monthly payment</span>
              <span className="text-sm font-bold text-emerald-300">${extraPayment}/mo</span>
            </div>
            <Slider
              value={[extraPayment]}
              onValueChange={([v]) => setExtraPayment(v)}
              min={0}
              max={1000}
              step={25}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-white/30">$0</span>
              <span className="text-[10px] text-white/30">$500</span>
              <span className="text-[10px] text-white/30">$1,000</span>
            </div>
          </div>

          {stuck ? (
            /* Payment loses to interest at this level — say so, keep the slider */
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-500/[0.08] border border-rose-400/20">
              <TrendingDown className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/70 leading-snug">
                At ${extraPayment}/mo, interest grows faster than you're paying it down — drag the slider up to see your payoff date.
              </p>
            </div>
          ) : (
          <>
          {/* Results grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <Calendar className="w-4 h-4 text-emerald-400/70 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{formatDateLabel(result.debtFreeDate)}</p>
              <p className="text-[10px] text-white/40">Debt-free date</p>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <TrendingDown className="w-4 h-4 text-emerald-400/70 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{formatMonths(result.monthsToFreedom)}</p>
              <p className="text-[10px] text-white/40">Time to payoff</p>
            </div>
          </div>

          {/* Payoff order */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wide">Payoff order (highest APR first)</p>
            {result.payoffOrder.map((name, i) => {
              const debt = debts.find(d => d.name === name)
              return (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-white/40'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-white/80 flex-1 min-w-0 truncate">{name}</span>
                  {debt?.interest_rate && (
                    <span className="text-xs text-white/40">{debt.interest_rate}% APR</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action button */}
          {topDebt && onAddStep && (
            <button
              onClick={() => onAddStep({
                type: 'budget',
                budget_type: 'expense',
                category: 'Debt payoff',
                amount: extraPayment,
                name: `Extra payment: ${topDebt.name}`,
              })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Target className="w-4 h-4" />
              Add ${extraPayment}/mo toward {topDebt.name}
            </button>
          )}
          </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
