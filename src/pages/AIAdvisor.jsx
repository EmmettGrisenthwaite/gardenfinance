import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
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
import PlanCard from '@/components/PlanCard'
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
  Send, Bot, Sparkles, RefreshCw, ArrowDown, Settings, ChevronLeft,
  Target, BarChart3, PiggyBank, CreditCard, TrendingUp, Shield, Sprout,
  ClipboardList, Loader2, Brain, Plus, X,
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
      <motion.div className="flex justify-end mb-4"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        <div className="max-w-[85%] md:max-w-[78%] bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-lg">
          {msg.content}
        </div>
      </motion.div>
    )
  }

  const hasArtifacts = msg.artifacts && msg.artifacts.length > 0
  // Tappable answers to the advisor's question — only on the latest reply
  // (answering moves the conversation on; stale options would mislead).
  const options = msg.options ?? msg.quickReplies ?? []
  const showOptions = isLast && options.length > 0

  return (
    <motion.div className="flex items-end gap-2 mb-4"
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center flex-shrink-0 mb-0.5">
        <Bot className="w-4 h-4 text-emerald-300" />
      </div>
      <div className="max-w-[85%] md:max-w-[82%] space-y-2">
        <div className="bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white/85 leading-relaxed [&_strong]:text-white [&_strong]:font-semibold">
          {renderContent(msg.content)}
        </div>

        {/* Artifacts */}
        {hasArtifacts && (
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
            <div className="text-[10px] font-semibold text-white/35 uppercase tracking-wider pl-1">Tap to answer</div>
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
        {onAddToPlan && isLast && msg.plannable && (
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
function WelcomeScreen({ hasData, onSuggest, analyzing, onBuildPlan, building, progressDelta }) {
  return (
    <motion.div className="text-center py-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="relative w-16 h-16 mx-auto mb-4">
        <div className="absolute -inset-8 rounded-full bg-emerald-500/[0.14] blur-2xl pointer-events-none" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/30 ring-1 ring-emerald-400/20 flex items-center justify-center shadow-lg">
          <Bot className="w-8 h-8 text-emerald-300" />
        </div>
      </div>
      <h2 className="font-display text-[20px] font-medium text-white mb-2">Your personal financial advisor</h2>
      <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed mb-5">
        {progressDelta?.has
          ? `Since ${progressDelta.days} days ago: ${progressDelta.delta >= 0 ? '+' : ''}$${Math.abs(progressDelta.delta).toLocaleString()} net worth${progressDelta.stepsDone ? `, ${progressDelta.stepsDone} step${progressDelta.stepsDone !== 1 ? 's' : ''} done` : ''}. `
          : ''}
        {hasData
          ? "I've looked at your numbers. Want me to tell you exactly where you stand and build you a plan?"
          : <>Ask me anything — and I'll build you a plan you can check off to grow your garden. Add your{' '}
            <Link to="/money" className="text-emerald-300 hover:text-emerald-200">money</Link>{' '}
            and{' '}
            <Link to="/plan#goals" className="text-emerald-300 hover:text-emerald-200">goals</Link>{' '}
            for advice that's about you.</>}
      </p>

      {hasData && (
        <div className="flex justify-center mb-6">
          <motion.button
            onClick={onBuildPlan}
            disabled={analyzing || building}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/50 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-900/40 transition-colors"
          >
            {building ? (
              <>
                <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                Analyzing your plan…
              </>
            ) : (
              <><ClipboardList className="w-4 h-4" /> Analyze my plan & suggest steps</>
            )}
          </motion.button>
        </div>
      )}

      <div className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2.5">Or start with</div>
      <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
        {SUGGESTIONS.map((s, i) => (
          <motion.button key={i} onClick={() => onSuggest(s.q ?? s.label)}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.04, duration: 0.25 }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.07] border border-white/[0.11] rounded-full text-[13px] text-white/70 hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-white transition-all">
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
  const [memories, setMemories]         = useState([])
  const [error, setError]               = useState(null)
  const [atBottom, setAtBottom]         = useState(true)
  const [pendingPlan, setPendingPlan]   = useState(null)
  const [buildingPlan, setBuildingPlan] = useState(false)
  const [pendingGoal, setPendingGoal]   = useState(null)
  const [pendingGuide, setPendingGuide] = useState(null)
  const [progressDelta, setProgressDelta] = useState(null)
  const [toast, setToast] = useState(null)   // transient status pill, e.g. "Added to your Plan"
  const toastTimer = useRef(null)
  function flashToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  const bottomRef    = useRef(null)
  const inputRef     = useRef(null)
  const scrollRef    = useRef(null)
  const isLoadingHistory = useRef(true)
  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [g, d, conv, pl, ac, mems] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('conversations').select('messages').eq('user_id', user.id).single(),
        listPlans(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
        getMemories(),
      ])
      if (g.error) throw g.error
      if (d.error) throw d.error
      if (ac.error) throw ac.error
      if (conv.error && conv.error.code !== 'PGRST116') throw conv.error
      const loadedGoals = g.data ?? []
      const loadedDebts = d.data ?? []
      const loadedAccounts = ac.data ?? []
      const trend = await netWorthTrend(user.id, computeSnapshot({
        profile, accounts: loadedAccounts, debts: loadedDebts, goals: loadedGoals,
      }).netWorth)
      setGoals(loadedGoals)
      setDebts(loadedDebts)
      setPlans(pl ?? [])
      setAccounts(loadedAccounts)
      setMemories(mems ?? [])

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
    window.history.replaceState({}, '')
    send(ask)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, location.state])

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
    const ctx = buildContext(money, goals, debts, profile, { plans, accounts })
    const memoriesText = formatMemoriesForContext(memories)
    return buildSystemPrompt(ctx, memoriesText)
  }, [money, goals, debts, profile, plans, accounts, memories])

  const noKey  = !chatConfigured
  const hasData = goals.length > 0 || debts.length > 0 || plans.length > 0 || money.income > 0 || money.expenses > 0 || money.netWorth !== 0

  // ── Data gaps — a light, dismissable nudge to fill in what sharpens advice
  // most (a debt's rate, an investment balance…). Purely derived from live
  // data, so once a field is filled the gap vanishes on its own — no separate
  // "stop asking" bookkeeping needed. The model gets the same ranked list in
  // its context and can ask about the top one in conversation too.
  const GAP_DISMISS_KEY = `advisor-gaps-dismissed-${user.id}`
  const [dismissedGaps, setDismissedGaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GAP_DISMISS_KEY)) ?? [] } catch { return [] }
  })
  const gaps = useMemo(
    () => getDataGaps({ profile, accounts, debts, goals }).filter(g => !dismissedGaps.includes(g.id)),
    [profile, accounts, debts, goals, dismissedGaps],
  )
  function dismissGap(id) {
    const next = [...dismissedGaps, id]
    setDismissedGaps(next)
    try { localStorage.setItem(GAP_DISMISS_KEY, JSON.stringify(next)) } catch {}
  }

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
      // tag fragments) so raw tags never flash in the bubble mid-stream.
      const reply = await callClaude(next, systemPrompt, {
        maxTokens: 1024,
        onDelta: (text) => setMessages([...next, { role: 'assistant', content: stripForStreaming(text) }]),
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
      }]
      setMessages(convo)

      // Periodically distill durable facts in the background — every 3
      // exchanges (no extra call per message, which would double cost for
      // little gain, but frequent enough that a real conversation reaches it).
      if (convo.length >= 6 && convo.length % 6 === 0) {
        distillAndSave(convo)
      }

      // After the reply, offer relevant follow-ups
      if (GUIDE_INTENT.test(text)) {
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
    await savePlan(user.id, pendingPlan)
    setPendingPlan(p => ({ ...p, saved: true }))
  }

  async function handleSaveGuide() {
    await savePlan(user.id, { title: pendingGuide.title, steps: pendingGuide.steps }, { source: 'guide' })
    setPendingGuide(p => ({ ...p, saved: true }))
  }

  // ── Memory distillation (always in the background — never blocks the UI) ────
  async function distillAndSave(convo) {
    try {
      const distilled = await distillConversation(convo)
      let added = 0
      for (const fact of distilled) {
        if (!findSimilarMemory(fact.fact, memories)) {
          const row = await createMemory(fact.fact, fact.category)
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
        : `Added ${added} step${added === 1 ? '' : 's'} to your Plan${skipped ? ` — ${skipped} already there` : ''}`)
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
      throw err
    }
  }

  const isEmpty = messages.length === 0 && !loading && !analyzing && !historyLoading && !pendingPlan && !buildingPlan

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-white/5 backdrop-blur-md px-4 md:px-6 py-3.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Back to Garden"
              className="md:hidden -ml-1.5 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-[16px] font-medium text-white leading-tight">Financial Advisor</h1>
              <p className="text-xs text-white/40">Personalized to your real data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!noKey && (
              <button
                onClick={handleBuildPlan}
                disabled={buildingPlan || loading || analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                title="Generate a saveable action plan"
              >
                {buildingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Action plan</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Start over (memories saved)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <Link to="/settings" aria-label="Settings" title="Settings"
              className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <Settings className="w-4 h-4" />
            </Link>
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
                <span className="text-xs text-emerald-200">{toast}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data-gap nudge — the single highest-value missing field, dismissable.
          Disappears on its own once the field is filled (see getDataGaps). */}
      {!noKey && !historyLoading && gaps.length > 0 && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 pt-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-400/20">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300/80 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-xs text-white/70 leading-snug">
              {gaps[0].label}
              {gaps.length > 1 && <span className="text-white/35"> +{gaps.length - 1} more</span>}
            </span>
            <Link to={gaps[0].href}
              className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 whitespace-nowrap flex-shrink-0">
              {gaps[0].cta}
            </Link>
            <button onClick={() => dismissGap(gaps[0].id)} aria-label="Dismiss"
              className="p-1 -m-1 text-white/25 hover:text-white/55 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

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
              className="fixed bottom-24 right-4 z-10 w-9 h-9 bg-white/15 backdrop-blur-md border border-white/10 shadow-lg rounded-full flex items-center justify-center text-white/70 hover:text-emerald-300 hover:border-emerald-400/50 transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className={`max-w-3xl mx-auto px-4 py-6 ${isEmpty ? 'min-h-full flex flex-col justify-center' : ''}`}>

          {isEmpty && !noKey && (
            <WelcomeScreen
              hasData={hasData}
              onSuggest={send}
              analyzing={analyzing}
              onBuildPlan={handleBuildPlan}
              building={buildingPlan}
              progressDelta={progressDelta}
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

          {/* Proposed action plan card */}
          {pendingPlan && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <PlanCard plan={pendingPlan} saved={pendingPlan.saved} onSave={handleSavePlan} />
            </motion.div>
          )}
          {buildingPlan && (
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-200/80">
              <Loader2 className="w-4 h-4 animate-spin" /> Building your action plan…
            </div>
          )}

          {/* Inline how-to guide */}
          {pendingGuide && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GuideCard guide={pendingGuide} saved={pendingGuide.saved}
                onSave={handleSaveGuide} onDismiss={() => setPendingGuide(null)} />
            </motion.div>
          )}

          {/* Inline goal suggestion */}
          {pendingGoal && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GoalSuggestionCard suggestion={pendingGoal}
                onAdd={handleSuggestedGoal}
                onDismiss={() => setPendingGoal(null)} />
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3">
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 inline-block px-3 py-2 rounded-lg">{error}</p>
            </motion.div>
          )}

          {/* Mid-conversation suggestion chips */}
          {messages.length > 0 && !loading && !analyzing && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:flex-wrap md:overflow-x-visible md:-mx-0 md:px-0 mt-2 mb-2">
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => send(s.q ?? s.label)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white/10 border border-white/[0.11] rounded-full text-xs text-white/60 hover:border-emerald-400/50 hover:text-white transition-all">
                  <s.icon className="w-3 h-3 text-emerald-300/80" /> {s.label}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — permanently flush to the bottom edge (the floating tab pill
          is hidden on this screen, so there's no clearance to reserve). */}
      <div className="flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="border-t border-white/10 bg-white/5 backdrop-blur-md">
          <form onSubmit={e => { e.preventDefault(); send(input) }} className="max-w-3xl mx-auto px-4 py-3 md:py-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 bg-white/10 border border-white/[0.11] rounded-2xl px-4 py-3 focus-within:border-emerald-400/50 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
                <textarea ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder={noKey ? 'Add your API key to start…' : 'Ask me anything…'}
                  disabled={noKey || loading || analyzing}
                  rows={1}
                  className="w-full bg-transparent text-base md:text-sm text-white placeholder-white/35 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                  style={{ maxHeight: 120, overflowY: 'auto' }}
                />
              </div>
              <button type="submit" disabled={!input.trim() || loading || analyzing || noKey}
                className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0 shadow-lg shadow-emerald-900/30">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-[10px] text-white/30 mt-2">
              Educational guidance — not a substitute for a licensed financial planner.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
