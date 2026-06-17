import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// ─── Milestone definitions ─────────────────────────────────────────────────────
const MILESTONE_DEFS = {
  first_budget: {
    emoji: '🌱',
    title: 'First seeds planted!',
    desc: "You've added your first budget entry. Your garden is officially taking root.",
  },
  first_goal: {
    emoji: '🌳',
    title: 'First tree planted!',
    desc: "Goals are the trees in your garden. This one's just getting started — keep watering it.",
  },
  first_debt: {
    emoji: '🌿',
    title: 'Tracking your weeds',
    desc: "Knowing what you owe is the first step to clearing it. You're already ahead of most people.",
  },
  first_account: {
    emoji: '🏦',
    title: 'Full picture unlocked!',
    desc: "Your advisor can now see everything. The more complete the picture, the better the guidance.",
  },
  first_surplus: {
    emoji: '☀️',
    title: "You're in the green!",
    desc: "Your income exceeds your expenses. The sun is shining bright on your garden.",
  },
  first_transaction: {
    emoji: '📝',
    title: 'Tracking real spending!',
    desc: "Logging actual transactions makes your budget come alive — this is how you find the leaks.",
  },
  score_50: {
    emoji: '🌻',
    title: 'Garden score: 50!',
    desc: "Halfway to a perfect garden. You've built a real foundation — most people never get here.",
  },
  score_75: {
    emoji: '🌸',
    title: 'Garden score: 75!',
    desc: "Your garden is flourishing. You're in the top tier of financial health for your age.",
  },
  score_100: {
    emoji: '🏆',
    title: 'Perfect garden!',
    desc: "100/100. Your financial garden is in full bloom. This is what it looks like when everything clicks.",
  },
  goal_complete: {
    emoji: '🎉',
    title: 'Goal achieved!',
    desc: "You funded it completely. That tree is fully grown — time to plant another one.",
  },
  debt_cleared: {
    emoji: '✂️',
    title: 'Debt eliminated!',
    desc: "That weed is gone from your garden forever. One down — keep going.",
  },
  debt_payment: {
    emoji: '💪',
    title: 'Payment recorded!',
    desc: "Every payment chips away at it. Your garden gets a little greener each time.",
  },
}

// ─── useMilestones hook ────────────────────────────────────────────────────────
// Tracks which milestones have been shown so we never repeat one.
export function useMilestones(userId) {
  const key = `milestones-seen-${userId}`

  function getSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(key)) ?? []) } catch { return new Set() }
  }

  function markSeen(milestoneKey) {
    const seen = getSeen()
    seen.add(milestoneKey)
    localStorage.setItem(key, JSON.stringify([...seen]))
  }

  function isNew(milestoneKey) {
    return !getSeen().has(milestoneKey)
  }

  // Returns array of milestone keys that are newly achieved (not yet seen)
  function getNewMilestones(achievedKeys) {
    const seen = getSeen()
    return achievedKeys.filter(k => !seen.has(k))
  }

  return { isNew, markSeen, getNewMilestones }
}

// ─── Compute currently achieved milestones from app state ─────────────────────
export function computeAchieved({ budgets, goals, debts, accounts, scores, transactions = [] }) {
  const achieved = []
  const { totalScore, surplusRatio } = scores

  if (budgets.length > 0)      achieved.push('first_budget')
  if (goals.length > 0)        achieved.push('first_goal')
  if (debts.length > 0)        achieved.push('first_debt')
  if (accounts.length > 0)     achieved.push('first_account')
  if (transactions.length > 0) achieved.push('first_transaction')
  if (surplusRatio > 0)        achieved.push('first_surplus')
  if (totalScore >= 50)        achieved.push('score_50')
  if (totalScore >= 75)        achieved.push('score_75')
  if (totalScore >= 100)       achieved.push('score_100')

  goals.forEach(g => {
    const pct = Number(g.target_amount) > 0
      ? Number(g.current_amount) / Number(g.target_amount)
      : 0
    if (pct >= 1) achieved.push(`goal_complete_${g.id}`)
  })

  debts.forEach(d => {
    if (Number(d.balance) <= 0) achieved.push(`debt_cleared_${d.id}`)
  })

  return achieved
}

// ─── MilestoneToast component ─────────────────────────────────────────────────
export default function MilestoneToast({ milestoneKey, goals = [], debts = [], onDismiss }) {
  const [visible, setVisible] = useState(true)

  // Resolve definition — handle dynamic keys for goals/debts
  let def = MILESTONE_DEFS[milestoneKey]
  if (!def && milestoneKey?.startsWith('goal_complete_')) {
    const goalId = milestoneKey.replace('goal_complete_', '')
    const goal   = goals.find(g => g.id === goalId)
    def = {
      ...MILESTONE_DEFS.goal_complete,
      desc: goal
        ? `"${goal.name}" is fully funded. That tree is fully grown — time to plant another one.`
        : MILESTONE_DEFS.goal_complete.desc,
    }
  }
  if (!def && milestoneKey?.startsWith('debt_cleared_')) {
    const debtId = milestoneKey.replace('debt_cleared_', '')
    const debt   = debts.find(d => d.id === debtId)
    def = {
      ...MILESTONE_DEFS.debt_cleared,
      desc: debt
        ? `"${debt.name}" is paid off. That weed is gone from your garden forever.`
        : MILESTONE_DEFS.debt_cleared.desc,
    }
  }

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const t = setTimeout(dismiss, 6000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDismiss, 350)
  }

  if (!def) { onDismiss(); return null }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          onClick={dismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.82, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 12, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="relative z-10 w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'linear-gradient(145deg, #052e16 0%, #064e3b 55%, #0c4a6e 100%)' }}
          >
            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-8 pt-10 pb-8 text-center">
              {/* Emoji with spring entrance */}
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.12, type: 'spring', damping: 10, stiffness: 180 }}
                className="text-6xl mb-5 leading-none select-none"
              >
                {def.emoji}
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="text-xl font-black text-white mb-2.5 leading-tight"
              >
                {def.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
                className="text-sm text-white/60 leading-relaxed mb-7"
              >
                {def.desc}
              </motion.p>

              {/* CTA button */}
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
                onClick={dismiss}
                className="px-7 py-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-sm rounded-2xl transition-all"
              >
                Keep growing 🌱
              </motion.button>
            </div>

            {/* Auto-dismiss countdown bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className="h-0.5 bg-white/25"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
