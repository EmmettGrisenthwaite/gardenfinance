import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, ArrowRight, RefreshCw } from 'lucide-react'
import { callClaude } from '@/lib/claude'
import { useAuth } from '@/context/AuthContext'

const SYSTEM_PROMPT = `You are a sharp, empathetic financial advisor for young adults (18-35).
Generate ONE specific, data-driven daily insight in exactly 1-2 sentences.
Rules:
- Use their actual numbers — be specific, not generic
- Be encouraging but honest — if something needs fixing, say so directly
- Do NOT start with "Based on", "I notice", "It looks like", or "Great job"
- Start with the actual insight, e.g. "Your emergency fund covers 1.4 months..."
- End with one clear action or a forward-looking note
- If data is sparse, focus on the most impactful next step they can take`

function buildInsightContext(data) {
  const { budgets, goals, debts, accounts } = data

  const income = budgets
    .filter(b => b.type === 'income' && b.recurring !== false)
    .reduce((s, b) => s + Number(b.amount), 0)
  const expenses = budgets
    .filter(b => b.type === 'expense' && b.recurring !== false)
    .reduce((s, b) => s + Number(b.amount), 0)
  const net = income - expenses
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance), 0)
  const totalAssets = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const monthsOfExpenses = expenses > 0
    ? (totalAssets / expenses).toFixed(1)
    : null

  const highInterestDebts = debts
    .filter(d => Number(d.interest_rate) >= 15)
    .map(d => `${d.name} at ${d.interest_rate}% APR ($${Number(d.balance).toLocaleString()})`)

  const goalSummary = goals.map(g => {
    const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)
    const remaining = Number(g.target_amount) - Number(g.current_amount)
    const monthsLeft = g.monthly_contribution > 0
      ? Math.ceil(remaining / g.monthly_contribution)
      : null
    return `${g.name}: ${pct}% saved ($${Number(g.current_amount).toLocaleString()} of $${Number(g.target_amount).toLocaleString()})${monthsLeft ? `, ~${monthsLeft} months to go at current pace` : ''}`
  })

  return `
Monthly income: $${income.toLocaleString()}
Monthly expenses: $${expenses.toLocaleString()}
Monthly surplus: $${net.toLocaleString()} ${net < 0 ? '(DEFICIT)' : ''}
Total debt: $${totalDebt.toLocaleString()}
Total assets/savings: $${totalAssets.toLocaleString()}
${monthsOfExpenses ? `Emergency fund coverage: ${monthsOfExpenses} months of expenses` : ''}
${highInterestDebts.length ? `High-interest debt (>15%): ${highInterestDebts.join(', ')}` : 'No high-interest debt'}
Goals: ${goalSummary.length ? goalSummary.join(' | ') : 'No goals set yet'}
`.trim()
}

export default function DailyInsight({ budgets = [], goals = [], debts = [], accounts = [] }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [insight, setInsight]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)

  const hasData = budgets.length > 0 || goals.length > 0 || debts.length > 0

  useEffect(() => {
    if (!hasData) return
    generateInsight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData])

  async function generateInsight(force = false) {
    // Cache key = user + today's date so it refreshes daily and is per-user
    const cacheKey = `daily-insight-${user?.id ?? 'guest'}-${new Date().toDateString()}-v2`
    if (!force) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setInsight(cached); return }
    }

    setLoading(true)
    setError(false)
    try {
      const context = buildInsightContext({ budgets, goals, debts, accounts })
      const text = await callClaude(
        [{ role: 'user', content: `My financial snapshot:\n${context}\n\nGive me today's insight.` }],
        SYSTEM_PROMPT,
        { maxTokens: 120 }
      )
      const clean = text.trim()
      localStorage.setItem(cacheKey, clean)
      setInsight(clean)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (!hasData) return null

  const openAdvisor = () => navigate('/advisor')

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Open your advisor"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      onClick={openAdvisor}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAdvisor() } }}
      className="w-full text-left group cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70"
    >
      <div className="bg-green-900/40 backdrop-blur-md rounded-2xl border border-green-400/30 p-4 flex items-center gap-3 hover:bg-green-900/55 transition-all shadow-lg">
        {/* Icon */}
        <div className="w-10 h-10 bg-green-500/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/40 transition-colors">
          <Sprout className="w-5 h-5 text-green-300" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-green-400/80 uppercase tracking-widest mb-0.5">
            Today's Insight
          </div>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <div className="h-3 bg-green-400/20 rounded animate-pulse w-48" />
                <div className="h-3 bg-green-400/20 rounded animate-pulse w-32" />
              </motion.div>
            ) : error ? (
              <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-green-200/60">
                Couldn't load insight — tap to open your advisor
              </motion.p>
            ) : insight ? (
              <motion.p key="insight" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm text-green-100 leading-snug line-clamp-2">
                {insight}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!loading && (
            <button
              onClick={e => { e.stopPropagation(); generateInsight(true) }}
              className="p-1.5 rounded-lg text-green-400/60 hover:text-green-300 hover:bg-green-400/10 transition-colors"
              title="Refresh insight"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <ArrowRight className="w-4 h-4 text-green-400/60 group-hover:text-green-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </motion.div>
  )
}
