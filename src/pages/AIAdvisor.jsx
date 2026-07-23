import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { callClaude, requestPlan, requestGuide, suggestGoal, chatConfigured } from '@/lib/claude'
import { savePlan, appendSteps, applyStep, addGoal, normalizeSteps, listPlans } from '@/lib/advisorPlans'
import { buildContext, buildSystemPrompt } from '@/lib/advisorContext'
import { getDataGaps } from '@/lib/dataGaps'
import { computeSnapshot } from '@/lib/finance'
import { netWorthTrend } from '@/lib/netWorth'
import {
  createMemory, getMemories, findSimilarMemory,
  formatMemoriesForContext, distillConversation,
} from '@/lib/memory'
import { listFinancialActivities } from '@/lib/financialActivities'
import { listReminderEvents, listReminders } from '@/lib/reminders'
import { selectAdvisorResponseAction, selectPendingAdvisorAttachment } from '@/lib/advisorResponseAction'
import PlanCard from '@/components/PlanCard'
import ResourceLinks from '@/components/ResourceLinks'
import GuideCard from '@/components/GuideCard'
import GoalSuggestionCard from '@/components/GoalSuggestionCard'
import ArtifactRenderer from '@/components/ai/artifacts/ArtifactRenderer'

// Loosely gates the (extra) goal-suggestion call to messages that sound like a
// savings/financial intent — the tool itself makes the final decision.
const GOAL_INTENT = /\b(sav(e|ing|ings)|buy|buying|afford|down\s?-?payment|house|home|condo|apartment|car|vehicle|truck|trip|travel|vacation|holiday|honeymoon|wedding|ring|baby|college|tuition|degree|invest|investing|brokerage|roth|ira|401k|fund|goal|retire|retirement|emergency)\b/i
// "I want to actually set something up" — gates the (extra) how-to guide call;
// the guide tool itself makes the final yes/no decision.
const GUIDE_INTENT = /\b(open|start|set\s?up|sign\s?up|create|switch|roll\s?over|move|transfer|enroll)\b[^.?!]*\b(roth|ira|401k|403b|hsa|brokerage|savings? account|hysa|high.?yield|index fund|etf|mutual fund|emergency fund|life insurance|will|credit|account|invest)\b|\bwalk me through\b|\bstep[-\s]?by[-\s]?step\b|\bhow (do|can) i (open|start|set\s?up|sign\s?up|get|invest)\b/i

import {
  Send, Bot, Sparkles, RefreshCw, ArrowDown, Settings, MoreHorizontal, Wallet,
  Target, BarChart3, PiggyBank, CreditCard, TrendingUp, Shield, Sprout,
  ClipboardList, Loader2, Brain, Plus, ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Quick questions ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: 'What do I do first?',  q: 'What should I prioritize right now?',       icon: Target },
  { label: 'Open a Roth IRA',      q: 'Help me open a Roth IRA',                   icon: Sparkles },
  { label: "How's my budget?",     q: "How's my budget looking?",                  icon: BarChart3 },
  { label: 'Tackle my debt',       q: 'How do I tackle my debt?',                  icon: CreditCard },
  { label: 'Am I saving enough?',  q: 'Am I saving enough?',                       icon: PiggyBank },
  { label: 'Start investing?',     q: 'Should I start investing?',                 icon: TrendingUp },
  { label: 'Emergency fund size',  q: 'How big should my emergency fund be?',      icon: Shield },
  { label: 'Grow my garden',       q: 'How can I grow my garden faster?',          icon: Sprout },
]


// ─── Parse artifacts from LLM response ─────────────────────────────────────────
function parseArtifacts(text) {
  const artifacts = []
  const artifactRegex = /<artifact\s+type="([^"]+)"(?:\s+goalId="([^"]*)")?\s*\/>/g
  let match
  while ((match = artifactRegex.exec(text)) !== null) {
    artifacts.push({ type: match[1], params: { goalId: match[2] } })
  }
  return artifacts
}

// Tappable answers to the advisor's own follow-up question (<options> block).
// Also accepts the legacy <quick_replies> tag from older saved conversations.
function parseOptions(text) {
  const match = text.match(/<(?:options|quick_replies)>([\s\S]*?)<\/(?:options|quick_replies)>/)
  if (!match) return []
  return match[1]
    .split('\n')
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(l => l.length > 0 && l.length < 80)
    .slice(0, 4)
}

function stripArtifactsAndReplies(text) {
  return text
    .replace(/<artifact\s+type="[^"]+"(?:\s+goalId="[^"]*")?\s*\/>/g, '')
    .replace(/<(?:options|quick_replies)>[\s\S]*?<\/(?:options|quick_replies)>/g, '')
    .replace(/<plannable\s*\/>/g, '')
    .trim()
}

// During streaming the tail of the text may contain a half-received tag — strip
// complete tags AND any unterminated trailing fragment so raw markup never
// flashes in the bubble.
function stripForStreaming(text) {
  return stripArtifactsAndReplies(text)
    .replace(/<(?:options|quick_replies)>[\s\S]*$/, '')   // opened, not yet closed
    .replace(/<[a-z_]*$/, '')                             // partially received "<opt…"
    .replace(/<artifact[^>]*$/, '')
    .trimEnd()
}

// ─── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-emerald-300" />
      </div>
      <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 bg-emerald-300/70 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isLast, onArtifactAction, onAddToPlan, debts, goals, accounts, profile }) {
  const isUser = msg.role === 'user'
  const [sourcesOpen, setSourcesOpen] = useState(false)

  function renderContent(text) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      const rendered = parts.map((p, j) =>
        p.startsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p
      )

      if (/^(Your move:|Next step:)/i.test(line.trim())) {
        return (
          <div key={i} className="mt-3 p-3 bg-emerald-400/15 border-l-2 border-emerald-400 rounded-r-lg">
            <div className="text-sm font-semibold text-emerald-100">{rendered}</div>
          </div>
        )
      }

      if (line.trim().startsWith('• ') || line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const body = line.trim().replace(/^[•\-*]\s+/, '')
        const bparts = body.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
          p.startsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
            <span>{bparts}</span>
          </div>
        )
      }
      if (/^\d+\./.test(line.trim())) {
        return <div key={i} className="my-0.5">{rendered}</div>
      }
      if (!line.trim()) return <div key={i} className="h-2" />
      if (line.trim().endsWith(':') && line.length < 60 && !line.includes('$')) {
        return <div key={i} className="font-semibold text-white mt-3 mb-1">{rendered}</div>
      }
      return <div key={i}>{rendered}</div>
    })
  }

  if (isUser) {
    return (
      <motion.div className="mb-5 flex justify-end"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        <div className="max-w-[82%] rounded-2xl rounded-br-md border border-emerald-300/15 bg-emerald-600/90 px-4 py-2.5 text-sm leading-relaxed text-white md:max-w-[72%]">
          {msg.content}
        </div>
      </motion.div>
    )
  }

  // Tappable answers to the advisor's question — only on the latest reply
  // (answering moves the conversation on; stale options would mislead).
  const options = msg.options ?? msg.quickReplies ?? []
  const responseAction = selectAdvisorResponseAction({
    isLast,
    answerCount: options.length,
    artifactCount: msg.artifacts?.length || 0,
    plannable: Boolean(onAddToPlan && msg.plannable),
  })
  const showOptions = responseAction === 'answers'
  const showArtifacts = responseAction === 'attachment'

  return (
    <motion.div className="mb-6 flex items-start gap-3"
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-300/10 bg-emerald-400/[0.07]">
        <Bot className="h-4 w-4 text-emerald-200/75" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="pr-1 text-[15px] leading-[1.7] text-readable-secondary [&_strong]:font-semibold [&_strong]:text-readable-primary">
          {renderContent(msg.content)}
        </div>

        {/* Web-search sources — real URLs from real search results, tappable */}
        {msg.sources?.length > 0 && (
          <div>
            <button type="button" onClick={() => setSourcesOpen(value => !value)} aria-expanded={sourcesOpen}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-readable-secondary hover:bg-white/[0.04] hover:text-white">
              Sources ({Math.min(3, msg.sources.length)}) <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
            </button>
            {sourcesOpen && <div className="mt-1"><ResourceLinks resources={msg.sources.slice(0, 3)} /></div>}
          </div>
        )}

        {/* Artifacts */}
        {showArtifacts && (
          <div className="space-y-2">
            {msg.artifacts.map((artifact, i) => (
              <ArtifactRenderer
                key={i}
                artifact={artifact}
                debts={debts}
                goals={goals}
                accounts={accounts}
                profile={profile}
                onAddStep={onArtifactAction}
                onUpdateGoal={onArtifactAction}
              />
            ))}
          </div>
        )}

        {/* Tappable answers to the advisor's follow-up question */}
        {showOptions && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }} className="space-y-1.5">
            <div className="text-[10px] font-semibold text-readable-muted uppercase tracking-wider pl-1">Tap to answer</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onArtifactAction?.('reply', opt)}
                  className="px-3.5 py-2 bg-emerald-500/[0.08] border border-emerald-400/30 rounded-xl text-[13px] font-medium text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400/50 active:scale-[0.98] transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* One "add this to my plan" CTA — only on the latest reply, and only
            when the model marked its advice as concretely actionable. */}
        {responseAction === 'add_to_plan' && (
          <button
            onClick={() => onAddToPlan(msg.content)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/[0.12] border border-emerald-400/30 rounded-xl text-[13px] font-semibold text-emerald-100 hover:bg-emerald-500/25 hover:border-emerald-400/50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add this to my plan
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Welcome / empty state ─────────────────────────────────────────────────────
function WelcomeScreen({ hasData, onSuggest, analyzing, onBuildPlan, building, progressDelta, suggestions, primaryGap }) {
  return (
    <motion.div className="py-5 text-center"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="relative mx-auto mb-5 h-14 w-14">
        <div className="pointer-events-none absolute -inset-8 rounded-full bg-emerald-400/[0.08] blur-2xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.09]">
          <Bot className="h-7 w-7 text-emerald-200" />
        </div>
      </div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/75">Personal to your numbers</p>
      <h2 className="font-display text-[25px] font-medium tracking-[-0.02em] text-white">Make the next move clear.</h2>
      <p className="mx-auto mb-6 mt-2 max-w-sm text-sm leading-relaxed text-readable-secondary">
        {progressDelta?.has
          ? `Since ${progressDelta.days} days ago: ${progressDelta.delta >= 0 ? '+' : ''}$${Math.abs(progressDelta.delta).toLocaleString()} net worth${progressDelta.stepsDone ? `, ${progressDelta.stepsDone} step${progressDelta.stepsDone !== 1 ? 's' : ''} done` : ''}. `
          : ''}
        {primaryGap
          ? primaryGap.label
          : hasData
          ? "I've looked at your numbers. Want me to tell you exactly where you stand and build you a plan?"
          : <>Ask me anything — and I'll build you a plan you can check off to grow your garden. Add your{' '}
            <Link to="/money" className="text-emerald-300 hover:text-emerald-200">money</Link>{' '}
            and{' '}
            <Link to="/plan#goals" className="text-emerald-300 hover:text-emerald-200">goals</Link>{' '}
            for advice that's about you.</>}
      </p>

      <div className="mb-7 flex justify-center">
        {primaryGap ? (
          <Link to={primaryGap.href} state={primaryGap.sheet ? { sheet: primaryGap.sheet } : undefined} className="btn-primary min-h-12 px-5">
            <Wallet className="h-4 w-4" /> {primaryGap.cta || 'Add details'}
          </Link>
        ) : hasData ? (
          <motion.button
            onClick={onBuildPlan}
            disabled={analyzing || building}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-primary min-h-12 px-5"
          >
            {building ? (
              <>
                <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                Reviewing your finances…
              </>
            ) : (
              <><ClipboardList className="h-4 w-4" /> Review my finances</>
            )}
          </motion.button>
        ) : (
          <Link to="/money" className="btn-primary min-h-12 px-5"><Wallet className="h-4 w-4" /> Add my numbers</Link>
        )}
      </div>

      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-readable-muted">Ask something specific</div>
      <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
        {suggestions.slice(0, 3).map((s, i) => (
          <motion.button key={i} onClick={() => onSuggest(s.q ?? s.label)}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.04, duration: 0.25 }}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.045] px-3.5 py-2 text-[13px] text-readable-secondary transition-colors hover:border-emerald-300/25 hover:bg-emerald-400/[0.06] hover:text-white">
            <s.icon className="w-3.5 h-3.5 text-emerald-300/80" />{s.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AIAdvisor() {
  const { user, profile, setProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const STORAGE_KEY = `advisor-chat-${user.id}`
  const LAST_VISIT_KEY = `advisor-last-visit-${user.id}`

  // Init from localStorage immediately (no flicker), then sync from Supabase
  const [messages, setMessages]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [] } catch { return [] }
  })
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [analyzing, setAnalyzing]       = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [goals,    setGoals]            = useState([])
  const [debts,    setDebts]            = useState([])
  const [plans,    setPlans]            = useState([])
  const [accounts, setAccounts]         = useState([])
  const [cashFlowItems, setCashFlowItems] = useState([])
  const [budgetLimits, setBudgetLimits] = useState([])
  const [memories, setMemories]         = useState([])
  const [activities, setActivities]     = useState([])
  const [reminders, setReminders]       = useState([])
  const [reminderEvents, setReminderEvents] = useState([])
  const [error, setError]               = useState(null)
  const [atBottom, setAtBottom]         = useState(true)
  const [pendingPlan, setPendingPlan]   = useState(null)
  const [buildingPlan, setBuildingPlan] = useState(false)
  const [pendingGoal, setPendingGoal]   = useState(null)
  const [pendingGuide, setPendingGuide] = useState(null)
  const [progressDelta, setProgressDelta] = useState(null)
  const [toast, setToast] = useState(null)   // transient status pill, optionally with a next action
  const [menuOpen, setMenuOpen] = useState(false)
  const toastTimer = useRef(null)
  function flashToast(message, action = null) {
    setToast({ message, action })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  const bottomRef    = useRef(null)
  const inputRef     = useRef(null)
  const scrollRef    = useRef(null)
  const isLoadingHistory = useRef(true)
  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = 'auto'
  }, [input])
  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [g, d, conv, pl, ac, flow, limits, mems, activityRows, reminderRows, reminderEventRows] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('conversations').select('messages').eq('user_id', user.id).single(),
        listPlans(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('budget_limits').select('*').eq('user_id', user.id),
        getMemories(),
        listFinancialActivities(user.id, { limit: 20 }),
        listReminders(user.id),
        listReminderEvents(user.id, { limit: 20 }),
      ])
      if (g.error) throw g.error
      if (d.error) throw d.error
      if (ac.error) throw ac.error
      if (flow.error) throw flow.error
      if (limits.error) throw limits.error
      if (conv.error && conv.error.code !== 'PGRST116') throw conv.error
      const loadedGoals = g.data ?? []
      const loadedDebts = d.data ?? []
      const loadedAccounts = ac.data ?? []
      const loadedFlow = flow.data ?? []
      const loadedLimits = limits.data ?? []
      const loadedSnapshot = computeSnapshot({
        profile, accounts: loadedAccounts, debts: loadedDebts, goals: loadedGoals,
        cashFlowItems: loadedFlow, budgetLimits: loadedLimits,
      })
      const trend = await netWorthTrend(user.id, {
        netWorth: loadedSnapshot.netWorth,
        assets: loadedSnapshot.assets,
        liabilities: loadedSnapshot.totalDebt,
      })
      setGoals(loadedGoals)
      setDebts(loadedDebts)
      setPlans(pl ?? [])
      setAccounts(loadedAccounts)
      setCashFlowItems(loadedFlow)
      setBudgetLimits(loadedLimits)
      setMemories(mems ?? [])
      setActivities(activityRows ?? [])
      setReminders(reminderRows ?? [])
      setReminderEvents(reminderEventRows ?? [])

      // Calculate progress delta since last visit
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY)
      let stepsDone = 0
      if (pl?.length) {
        stepsDone = pl.reduce((sum, p) => sum + p.steps.filter(s => s.done).length, 0)
      }
      let lastSteps = 0
      try {
        lastSteps = lastVisit ? Number(JSON.parse(localStorage.getItem(`advisor-steps-${user.id}`) || '0')) : 0
      } catch { /* corrupted local progress should not block the advisor */ }
      const newSteps = stepsDone - lastSteps

      setProgressDelta({
        ...trend,
        stepsDone: newSteps > 0 ? newSteps : null,
      })

      // Store current state for next visit
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
      localStorage.setItem(`advisor-steps-${user.id}`, JSON.stringify(stepsDone))

      // Merge Supabase history
      if (conv.data?.messages?.length) {
        const remoteMessages = conv.data.messages
        setMessages(prev => remoteMessages.length >= prev.length ? remoteMessages : prev)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMessages)) } catch {}
      }
      isLoadingHistory.current = false
      setHistoryLoading(false)
    }
    load().catch(err => {
      setError(err.message ?? 'Could not load your advisor data.')
      isLoadingHistory.current = false
      setHistoryLoading(false)
    })
  }, [user.id, profile, LAST_VISIT_KEY, STORAGE_KEY])

  // A Plan "Smart next step" can route here with a pre-filled question
  useEffect(() => {
    const ask = location.state?.ask
    if (!ask || historyLoading) return
    navigate('/advisor', { replace: true, state: null })
    void send(ask)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, location.state, navigate])

  // Persist to localStorage + Supabase when messages settle
  useEffect(() => {
    if (isLoadingHistory.current) return
    if (loading || analyzing) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
    async function saveConversation() {
      const payload = { messages, updated_at: new Date().toISOString() }
      const { data: existing, error: readError } = await supabase.from('conversations')
        .select('id').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1)
      if (readError) throw readError
      const result = existing?.[0]
        ? await supabase.from('conversations').update(payload).eq('id', existing[0].id).eq('user_id', user.id)
        : await supabase.from('conversations').insert({ ...payload, user_id: user.id })
      if (result.error) throw result.error
    }
    saveConversation().catch(saveError => {
      console.warn('Could not save advisor conversation:', saveError.message)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, analyzing])

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: loading || analyzing ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, pendingPlan, buildingPlan, pendingGoal])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setAtBottom(distFromBottom < 80)
  }, [])

  // ── Context caching ───────────────────────────────────────────────────────────
  const money = useMemo(() => ({
    income:   Number(profile?.monthly_income)   || 0,
    expenses: Number(profile?.monthly_expenses) || 0,
    netWorth: accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
      - debts.reduce((s, d) => s + (Number(d.balance) || 0), 0),
  }), [profile, accounts, debts])

  const systemPrompt = useMemo(() => {
    const ctx = buildContext(money, goals, debts, profile, {
      plans, accounts, cashFlowItems, budgetLimits, activities, reminders, reminderEvents,
    })
    const memoriesText = formatMemoriesForContext(memories)
    return buildSystemPrompt(ctx, memoriesText)
  }, [money, goals, debts, profile, plans, accounts, cashFlowItems, budgetLimits, activities, reminders, reminderEvents, memories])

  const noKey  = !chatConfigured
  const hasData = goals.length > 0 || debts.length > 0 || plans.length > 0 || money.income > 0 || money.expenses > 0 || money.netWorth !== 0
  const quickSuggestions = useMemo(() => {
    const hasInvestmentAccount = accounts.some(account => account.type === 'brokerage' || [
      'taxable_brokerage', 'roth_ira', 'traditional_ira', '401k', '403b', 'hsa', 'sep_ira', 'crypto', 'other_investment',
    ].includes(account.subtype))
    return [
      SUGGESTIONS[0],
      hasInvestmentAccount
        ? { label: 'Review my investments', q: 'Review my investment accounts and contributions. What should I improve next?', icon: TrendingUp }
        : SUGGESTIONS[1],
      SUGGESTIONS[2],
    ]
  }, [accounts])

  // ── Data gaps — a light, dismissable nudge to fill in what sharpens advice
  // most (a debt's rate, an investment balance…). Purely derived from live
  // data, so once a field is filled the gap vanishes on its own — no separate
  // "stop asking" bookkeeping needed. The model gets the same ranked list in
  // its context and can ask about the top one in conversation too.
  const GAP_DISMISS_KEY = `advisor-gaps-dismissed-${user.id}`
  const [dismissedGaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GAP_DISMISS_KEY)) ?? [] } catch { return [] }
  })
  const gaps = useMemo(
    () => getDataGaps({ profile, accounts, debts, goals, cashFlowItems }).filter(g => !dismissedGaps.includes(g.id)),
    [profile, accounts, debts, goals, cashFlowItems, dismissedGaps],
  )

  // ── Send message ────────────────────────────────────────────────────────────
  async function send(text, opts = {}) {
    if (!text.trim() || loading || noKey) return
    setError(null)

    const userMsg = { role: 'user', content: text.trim() }
    const next    = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setAtBottom(true)
    setPendingGoal(null)
    setPendingGuide(null)
    if (opts.analyzing) setAnalyzing(true); else setLoading(true)

    try {
      // Stream the reply — strip artifact/options markup (including half-received
      // tag fragments) so raw tags never flash in the bubble mid-stream. Web
      // search citations arrive on the same stream; they become source chips.
      let sources = []
      const isSetupRequest = GUIDE_INTENT.test(text)
      const reply = await callClaude(next, systemPrompt, {
        maxTokens: 4000,
        onDelta: (text) => setMessages([...next, { role: 'assistant', content: stripForStreaming(text) }]),
        // Setup requests get up to three official links in the dedicated guide
        // below; suppressing generic source chips avoids a duplicate link row.
        onSources: isSetupRequest ? undefined : (s) => { sources = s },
      })

      // Parse artifacts, tappable answer options, and the plannable marker
      const artifacts = parseArtifacts(reply)
      const options = parseOptions(reply)
      const plannable = /<plannable\s*\/>/.test(reply)
      const cleanReply = stripArtifactsAndReplies(reply)

      const convo = [...next, {
        role: 'assistant',
        content: cleanReply,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        options: options.length > 0 ? options : undefined,
        plannable: plannable || undefined,
        sources: sources.length > 0 ? sources : undefined,
      }]
      setMessages(convo)

      // Periodically distill durable facts in the background — every 3
      // exchanges (no extra call per message, which would double cost for
      // little gain, but frequent enough that a real conversation reaches it).
      if (convo.length >= 6 && convo.length % 6 === 0) {
        distillAndSave(convo)
      }

      // After the reply, offer relevant follow-ups
      if (isSetupRequest) {
        requestGuide(convo, systemPrompt).then(g => { if (g) setPendingGuide(g) })
      } else if (GOAL_INTENT.test(text)) {
        suggestGoal(convo, systemPrompt).then(g => { if (g) setPendingGoal(g) })
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setMessages(messages)
    } finally {
      setLoading(false)
      setAnalyzing(false)
      inputRef.current?.focus()
    }
  }

  // ── Build plan ──────────────────────────────────────────────────────────────
  async function handleBuildPlan() {
    if (buildingPlan || loading || analyzing || noKey) return
    setError(null)
    setBuildingPlan(true)
    setAtBottom(true)
    try {
      const planMsgs = [
        ...messages,
        { role: 'user', content: 'Based on my actual numbers, build me a short, concrete financial action plan I can follow — 3 to 5 ordered steps. Where a step means starting a savings/investment goal or adding a recurring budget line, include its apply action so I can add it in one tap.' },
      ]
      const plan = await requestPlan(planMsgs, systemPrompt)
      setPendingPlan({ ...plan, steps: normalizeSteps(plan.steps), saved: false })
    } catch (err) {
      setError(err.message ?? 'Could not build a plan. Try again.')
    } finally {
      setBuildingPlan(false)
    }
  }

  async function handleSavePlan() {
    try {
      await savePlan(user.id, pendingPlan)
      setPendingPlan(p => ({ ...p, saved: true }))
      setError(null)
      flashToast('Added your action plan to Plan', { to: '/plan', label: 'View Plan' })
      return true
    } catch (err) {
      setError(err.message ?? 'Could not save that plan. Please try again.')
      return false
    }
  }

  async function handleSaveGuide() {
    try {
      await savePlan(user.id, { title: pendingGuide.title, steps: pendingGuide.steps }, { source: 'guide' })
      setPendingGuide(p => ({ ...p, saved: true }))
      setError(null)
      flashToast('Added this guide to Plan', { to: '/plan', label: 'View Plan' })
      return true
    } catch (err) {
      setError(err.message ?? 'Could not save that guide. Please try again.')
      return false
    }
  }

  // ── Memory distillation (always in the background — never blocks the UI) ────
  async function distillAndSave(convo) {
    try {
      const distilled = await distillConversation(convo)
      let added = 0
      for (const fact of distilled) {
        const sameKey = fact.memory_key && memories.find(memory =>
          memory.memory_key === fact.memory_key && (memory.subject_key || '') === (fact.subject_key || 'primary'))
        if (sameKey || !findSimilarMemory(fact.fact, memories)) {
          const row = await createMemory(fact.fact, fact.category, {
            memoryKey: fact.memory_key || `${fact.category || 'other'}.context`,
            subjectKey: fact.subject_key || 'primary',
            source: 'conversation',
            confidence: 0.8,
          })
          if (row) added++
        }
      }
      if (added > 0) {
        setMemories(await getMemories())
        flashToast('Your advisor remembered something new')
      }
    } catch (err) {
      console.error('Error distilling conversation:', err)
    }
  }

  // ── Start over: clear instantly, distill the old thread in the background ───
  async function handleClearChat() {
    const snapshot = messages
    setMessages([])
    setError(null)
    setPendingPlan(null)
    setPendingGoal(null)
    setPendingGuide(null)
    localStorage.removeItem(STORAGE_KEY)
    const { error: deleteError } = await supabase.from('conversations').delete().eq('user_id', user.id)
    if (deleteError) setError(deleteError.message ?? 'Could not clear the saved conversation.')
    if (snapshot.length > 2) distillAndSave(snapshot)
  }

  // ── Add to plan from chat message ───────────────────────────────────────────
  async function handleAddToPlan(messageContent) {
    setLoading(true)
    try {
      const planMsgs = [
        ...messages,
        { role: 'user', content: `Turn this advice into 2-4 actionable plan steps: "${messageContent.slice(0, 2000)}"` },
      ]
      const plan = await requestPlan(planMsgs, systemPrompt)
      // Append into the user's ONE plan; be honest about what was new.
      const { added, skipped } = await appendSteps(user.id, plan.steps, { source: 'advisor', group: plan.title })
      setError(null)
      flashToast(added === 0
        ? 'Those steps are already in your Plan'
        : `Added ${added} step${added === 1 ? '' : 's'} to your Plan${skipped ? ` — ${skipped} already there` : ''}`,
        { to: '/plan', label: 'View Plan' })
    } catch (err) {
      setError(err.message ?? 'Could not add to plan.')
    } finally {
      setLoading(false)
    }
  }

  // ── Artifact action handler ─────────────────────────────────────────────────
  async function handleArtifactAction(action, data) {
    if (action === 'reply') {
      send(data)
      return
    }
    if (action === 'budget') {
      try {
        const message = await applyStep(user.id, data)
        const { data: refreshedProfile, error: profileError } = await supabase.from('profiles')
          .select('*').eq('id', user.id).single()
        if (profileError) throw profileError
        if (refreshedProfile) setProfile(refreshedProfile)
        const [flowResult, limitResult] = await Promise.all([
          supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order'),
          supabase.from('budget_limits').select('*').eq('user_id', user.id),
        ])
        if (flowResult.error) throw flowResult.error
        if (limitResult.error) throw limitResult.error
        setCashFlowItems(flowResult.data ?? [])
        setBudgetLimits(limitResult.data ?? [])
        flashToast(message)
        setError(null)
      } catch (err) {
        setError(err.message ?? 'Could not apply that step.')
      }
      return
    }
    if (action === 'goal') {
      try {
        const { error: updateError } = await supabase.from('goals')
          .update({ monthly_contribution: data.monthly_contribution })
          .eq('id', data.id).eq('user_id', user.id)
        if (updateError) throw updateError
        // Refresh goals
        const { data: refreshed, error: refreshError } = await supabase.from('goals')
          .select('*').eq('user_id', user.id)
        if (refreshError) throw refreshError
        setGoals(refreshed ?? [])
      } catch (err) {
        setError(err.message ?? 'Could not update goal.')
      }
    }
  }

  async function handleSuggestedGoal(suggestion) {
    try {
      const created = await addGoal(user.id, suggestion)
      setGoals(prev => [...prev, created])
      const monthly = Number(suggestion.monthly_contribution) || 0
      await appendSteps(user.id, [{
        text: monthly > 0
          ? `Save $${Math.round(monthly).toLocaleString()}/mo toward ${suggestion.name}`
          : `Start saving toward ${suggestion.name}`,
      }], { source: 'suggestion', group: suggestion.name })
      setPlans(await listPlans(user.id))
    } catch (err) {
      setError(err.message ?? 'Could not add that goal to your plan.')
      return false
    }
    return true
  }

  const isEmpty = messages.length === 0 && !loading && !analyzing && !historyLoading && !pendingPlan && !buildingPlan
  const pendingAttachment = selectPendingAdvisorAttachment({
    plan: pendingPlan,
    guide: pendingGuide,
    goal: pendingGoal,
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.07] bg-[#08110e]/88 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.09]">
              <Bot className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h1 className="font-display text-[18px] font-medium leading-tight text-white">Advisor</h1>
              <p className="text-[11px] text-readable-muted">Personal to your real numbers</p>
            </div>
          </div>
          <div className="relative z-30">
            {menuOpen && <button type="button" aria-label="Close advisor menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 cursor-default" />}
            <button type="button" onClick={() => setMenuOpen(open => !open)} aria-label="Advisor menu" aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-readable-muted transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: -5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c1612] p-1.5 shadow-2xl">
                {messages.length > 0 && (
                  <button type="button" onClick={() => { setMenuOpen(false); handleClearChat() }}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-readable-secondary transition-colors hover:bg-white/[0.06] hover:text-white">
                    <RefreshCw className="h-4 w-4" /> Start over
                  </button>
                )}
                <Link to="/settings" onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-readable-secondary transition-colors hover:bg-white/[0.06] hover:text-white">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Status toast (memory saved, plan added, …) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-shrink-0 z-50"
          >
            <div className="max-w-3xl mx-auto px-4 pt-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/15 border border-emerald-400/25 rounded-lg">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-200">{toast.message}</span>
                {toast.action && (
                  <Link
                    to={toast.action.to}
                    onClick={() => setToast(null)}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 whitespace-nowrap"
                  >
                    {toast.action.label} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not-configured banner */}
      {noKey && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 mt-4">
          <div className="p-4 bg-amber-400/10 border border-amber-400/30 rounded-xl text-sm">
            <p className="font-semibold text-amber-200 mb-1">Advisor isn't configured yet</p>
            <p className="text-amber-200/70 text-xs leading-relaxed">
              Set <code className="bg-amber-400/15 px-1 rounded">VITE_SUPABASE_URL</code> and deploy the{' '}
              <code className="bg-amber-400/15 px-1 rounded">chat</code> Edge Function
              (<code className="bg-amber-400/15 px-1 rounded">supabase functions deploy chat</code>).
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
              onClick={() => { setAtBottom(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              className="advisor-scroll-button fixed right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.09] bg-[#101a16]/90 text-readable-secondary shadow-lg backdrop-blur-xl transition-colors hover:border-emerald-300/25 hover:text-emerald-200"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className={`mx-auto max-w-3xl px-4 py-6 ${isEmpty ? 'flex min-h-full flex-col justify-center' : ''}`}>

          {isEmpty && !noKey && (
            <WelcomeScreen
              hasData={hasData}
              onSuggest={send}
              analyzing={analyzing}
              onBuildPlan={handleBuildPlan}
              building={buildingPlan}
              progressDelta={progressDelta}
              suggestions={quickSuggestions}
              primaryGap={gaps[0] || null}
            />
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                isLast={i === messages.length - 1 && !loading && !analyzing}
                onArtifactAction={handleArtifactAction}
                onAddToPlan={handleAddToPlan}
                debts={debts}
                goals={goals}
                accounts={accounts}
                profile={profile}
              />
            ))}
          </AnimatePresence>

          {/* Typing dots */}
          {(loading || analyzing) && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}

          {/* One response attachment at a time. */}
          {pendingAttachment?.kind === 'plan' ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <PlanCard plan={pendingAttachment.value} saved={pendingAttachment.value.saved} onSave={handleSavePlan} />
            </motion.div>
          ) : pendingAttachment?.kind === 'guide' ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GuideCard guide={pendingAttachment.value} saved={pendingAttachment.value.saved}
                onSave={handleSaveGuide} onDismiss={() => setPendingGuide(null)} />
            </motion.div>
          ) : pendingAttachment?.kind === 'goal' ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GoalSuggestionCard suggestion={pendingAttachment.value}
                onAdd={handleSuggestedGoal}
                onDismiss={() => setPendingGoal(null)} />
            </motion.div>
          ) : null}
          {buildingPlan && (
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-200/80">
              <Loader2 className="w-4 h-4 animate-spin" /> Building your action plan…
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3">
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 inline-block px-3 py-2 rounded-lg">{error}</p>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer shares one clearance contract with the mobile app dock. */}
      <div className="advisor-composer-shell flex-shrink-0">
        <div className="border-t border-white/[0.07] bg-[#08110e]/92 backdrop-blur-xl">
          <form onSubmit={e => { e.preventDefault(); send(input) }} className="mx-auto max-w-3xl px-4 py-3 md:py-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 rounded-2xl border border-white/[0.1] bg-white/[0.055] px-4 py-3 transition-colors focus-within:border-emerald-300/40 focus-within:ring-1 focus-within:ring-emerald-300/15">
                <textarea ref={inputRef} value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder={noKey ? 'Add your API key to start…' : 'Ask me anything…'}
                  disabled={noKey || loading || analyzing}
                  rows={1}
                  className="w-full bg-transparent text-base md:text-sm text-white placeholder-white/35 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                  style={{ maxHeight: 120, overflowY: 'auto' }}
                />
              </div>
              <button type="submit" disabled={!input.trim() || loading || analyzing || noKey}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-950/25 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/25">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 hidden text-center text-[10px] text-readable-muted sm:block">
              Educational guidance — not a substitute for a licensed financial planner.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
