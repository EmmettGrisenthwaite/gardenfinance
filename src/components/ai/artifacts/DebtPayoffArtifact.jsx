import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { debtFreedomWithExtra, formatDateLabel, formatMonths } from '@/lib/financeArtifacts'
import Slider from '@/components/ui/slider'

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
      <p className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4 text-[14px] text-readable-secondary">
        Add your debts to see when they could be paid off.
      </p>
    )
  }

  // NOTE: a "stuck" result (payment loses to interest) must NOT hide the card —
  // the slider is the only way out of that state. It renders inline below.
  const stuck = !result || result.stuck
  const totalDebt = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0)
  const topDebt = [...debts].sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0]

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="Debt payoff"
      className="mt-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[15px] font-semibold text-white">Debt payoff</h4>
        <p className="text-[13px] tabular-nums text-readable-muted">
          ${totalDebt.toLocaleString()} · {debts.length} debt{debts.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[14px] text-readable-secondary">Monthly payment</span>
          <span className="text-[15px] font-semibold tabular-nums text-emerald-200">${extraPayment.toLocaleString()}/mo</span>
        </div>
        <Slider
          value={[extraPayment]}
          onValueChange={([v]) => setExtraPayment(v)}
          min={0}
          max={1000}
          step={25}
          className="w-full"
        />
        <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-readable-muted">
          <span>$0</span>
          <span>$500</span>
          <span>$1,000</span>
        </div>
      </div>

      {stuck ? (
        /* Payment loses to interest at this level — say so, keep the slider */
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3.5 py-2.5 text-[14px] leading-5 text-rose-100">
          At ${extraPayment.toLocaleString()}/mo, interest grows faster than you pay it down. Move the slider up to see a payoff date.
        </p>
      ) : (
        <>
          <dl className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.07]">
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-[14px] text-readable-secondary">Debt-free by</dt>
              <dd className="text-[16px] font-semibold tabular-nums text-white">{formatDateLabel(result.debtFreeDate)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-[14px] text-readable-secondary">Time to pay off</dt>
              <dd className="text-[16px] font-semibold tabular-nums text-white">{formatMonths(result.monthsToFreedom)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="section-label">Pay off in this order</p>
            <ol className="mt-1.5">
              {result.payoffOrder.map((name, i) => {
                const debt = debts.find(d => d.name === name)
                return (
                  <li key={name} className="flex items-center gap-3 py-1.5 text-[14px]">
                    <span className="w-4 shrink-0 text-right tabular-nums text-readable-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-white">{name}</span>
                    {debt?.interest_rate && (
                      <span className="tabular-nums text-readable-muted">{debt.interest_rate}%</span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          {topDebt && onAddStep && (
            <button
              type="button"
              onClick={() => onAddStep({
                type: 'budget',
                budget_type: 'expense',
                category: 'Debt payoff',
                amount: extraPayment,
                name: `Extra payment: ${topDebt.name}`,
              })}
              className="btn-primary mt-4 min-h-11 w-full text-[15px]"
            >
              Add ${extraPayment.toLocaleString()}/mo toward {topDebt.name}
            </button>
          )}
        </>
      )}
    </motion.section>
  )
}
