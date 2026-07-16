import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Sprout, ArrowRight, ArrowLeft, Check, Landmark, X } from 'lucide-react'
import { ONBOARDING_ACCOUNTS_ROUTE } from '@/lib/routes'

// ─── Step definitions ──────────────────────────────────────────────────────────
const BASE_STEPS = [
  {
    id: 'preview',
    type: 'preview',
    question: '',
    sub: '',
  },
  {
    id: 'intro',
    question: "Before we start — a quick setup",
    sub: 'Takes about 2 minutes. Your answers unlock advice that\'s actually about you, not generic tips.',
    type: 'intro',
  },
  {
    id: 'basics',
    question: 'How old are you?',
    sub: 'Your age shapes every investment and savings recommendation.',
    type: 'age',
    field: 'age',
  },
  {
    id: 'employment',
    question: "What's your work situation?",
    sub: 'This affects tax advice and how much emergency fund you need.',
    type: 'single',
    field: 'employment_type',
    options: [
      { value: 'w2',        label: 'Salaried / W-2',            icon: '💼', sub: 'Regular paycheck, employer withholds taxes' },
      { value: 'freelance', label: 'Freelance / Self-employed',  icon: '🧑‍💻', sub: 'You pay quarterly estimated taxes' },
      { value: 'student',   label: 'Student',                    icon: '🎓', sub: 'In school, may have part-time income' },
      { value: 'other',     label: 'Other',                      icon: '🌀', sub: 'Gig work, part-time, between jobs, etc.' },
    ],
  },
  {
    id: 'retirement',
    question: 'Does your employer offer a 401k or 403b?',
    sub: "An employer match is the highest-return 'investment' available — we need to know if you have it.",
    type: 'single',
    field: 'employer_401k',
    options: [
      { value: 'match',    label: 'Yes — with employer match', icon: '🎯', sub: 'Free money — usually 3–6% of your salary' },
      { value: 'no_match', label: 'Yes — but no match',        icon: '📋', sub: 'Still useful for tax savings' },
      { value: 'none',     label: 'No / Not offered',          icon: '❌', sub: "We'll focus on IRA instead" },
      { value: 'unsure',   label: "I'm not sure",              icon: '🤷', sub: 'Worth checking your HR portal' },
      { value: 'na',       label: 'Not applicable',            icon: '—',  sub: 'Student, freelance, or other' },
    ],
  },
  {
    id: 'investing',
    question: 'Are you currently investing anywhere?',
    sub: "Pick all that apply — we won't suggest opening accounts you already have.",
    type: 'multi',
    field: 'investment_types',
    options: [
      { value: 'roth_ira',  label: 'Roth IRA',         icon: '🌱' },
      { value: 'trad_ira',  label: 'Traditional IRA',  icon: '📘' },
      { value: '401k',      label: '401(k) / 403(b)',  icon: '🏢' },
      { value: 'brokerage', label: 'Brokerage account', icon: '📈' },
      { value: 'hsa',       label: 'HSA',              icon: '🏥' },
      { value: 'none',      label: 'Not yet',          icon: '⏳' },
    ],
  },
  {
    id: 'insurance',
    question: 'Do you have health insurance?',
    sub: 'One medical emergency without insurance can wipe out years of savings.',
    type: 'single',
    field: 'health_insurance',
    options: [
      { value: 'employer',    label: 'Yes — through work',      icon: '🏢' },
      { value: 'marketplace', label: 'Yes — marketplace / ACA', icon: '🛒' },
      { value: 'parents',     label: "Yes — on parents' plan",  icon: '👨‍👩‍👧', sub: 'Available until age 26' },
      { value: 'none',        label: 'No — uninsured',          icon: '⚠️', sub: "We'll flag this as a priority" },
    ],
  },
  {
    id: 'money',
    question: 'Now your monthly picture — rough is fine.',
    sub: 'Add typical income and spending here. Detailed accounts come next in the real Accounts workspace.',
    type: 'money',
  },
  {
    id: 'debts',
    question: 'Any debts to track?',
    sub: 'Credit cards, student loans, car loans — add what you owe so your advisor can plan payoff. Skip if you have none.',
    type: 'debts',
  },
  {
    id: 'goal',
    question: "What's your #1 financial priority right now?",
    sub: "Your advisor will focus around this — you can change it anytime.",
    type: 'single',
    field: 'primary_goal',
    options: [
      { value: 'emergency_fund',  label: 'Build my emergency fund', icon: '🛡️' },
      { value: 'pay_debt',        label: 'Pay off debt',            icon: '💳' },
      { value: 'start_investing', label: 'Start investing',         icon: '📈' },
      { value: 'major_purchase',  label: 'Save for a big purchase', icon: '🏠', sub: 'House, car, travel, etc.' },
      { value: 'optimize',        label: 'Optimize what I have',    icon: '⚡', sub: "Already on track, want to do more" },
      { value: 'organize',        label: 'Just get organized',      icon: '📊', sub: "Starting from scratch" },
    ],
  },
]

// ─── Adaptive steps — the quiz reshapes itself around earlier answers ──────────
// A self-employed 50-year-old shouldn't be asked about an employer 401k or see
// "on my parents' plan" as an insurance option.
function buildSteps(answers, profileOnly) {
  const age = Number(answers.age) || 0
  const emp = answers.employment_type

  return BASE_STEPS
    // Employer 401k only makes sense for people with an employer.
    .filter(s => !(s.id === 'retirement' && (emp === 'freelance' || emp === 'student')))
    // Settings' "Edit profile" skips the money/debts re-entry (managed on /money).
    .filter(s => !(profileOnly && ['money', 'debts'].includes(s.id)))
    .map(s => {
      if (s.id === 'investing' && emp === 'freelance') {
        return {
          ...s,
          sub: "Pick all that apply. Self-employed? A SEP-IRA or Solo 401(k) may fit — your advisor can walk you through it.",
        }
      }
      if (s.id === 'insurance') {
        let options = [
          ...s.options.slice(0, 2),
          { value: 'spouse', label: "Yes — on my spouse's plan", icon: '💑' },
          ...s.options.slice(2),
        ]
        // The parents'-plan option ends at 26 — hide it for anyone older.
        if (age >= 26) options = options.filter(o => o.value !== 'parents')
        return { ...s, options }
      }
      if (s.id === 'goal' && age >= 45) {
        // Priorities shift with life stage: retirement readiness leads.
        const options = [
          { value: 'retirement_catchup', label: 'Catch up on retirement', icon: '🎯', sub: 'Make the most of catch-up contributions' },
          ...s.options.map(o => o.value === 'start_investing' ? { ...o, label: 'Grow my investments' } : o),
        ]
        return { ...s, options }
      }
      return s
    })
}

// ─── Preview step (value prop before questions) ────────────────────────────────
function PreviewStep() {
  const features = [
    {
      emoji: '🤖',
      title: 'Ask your advisor',
      desc: 'Real advice built around your actual money, goals, and debt — powered by Claude AI. It turns guidance into a plan you can follow.',
    },
    {
      emoji: '✅',
      title: 'Build your plan',
      desc: 'One tap adds the advisor’s steps to your plan. Open a Roth IRA, build an emergency fund — concrete, checkable steps.',
    },
    {
      emoji: '🌱',
      title: 'Grow your garden',
      desc: 'Every step you check off makes your living 3D garden grow — from barren to flourishing. Your progress, visualized.',
    },
  ]

  return (
    <div className="space-y-4">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.065] border border-white/[0.10]"
        >
          <div className="text-2xl flex-shrink-0 leading-none mt-0.5">{f.emoji}</div>
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">{f.title}</div>
            <div className="text-xs text-white/55 leading-relaxed">{f.desc}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ option, selected, onClick, multi }) {
  const active = multi ? selected.includes(option.value) : selected === option.value
  return (
    <button
      type="button"
      onClick={() => onClick(option.value)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/[0.12] text-white'
          : 'border-white/10 bg-white/[0.045] text-white/80 hover:border-emerald-400/40 hover:bg-emerald-500/[0.06]'
      }`}
    >
      <span className="text-xl flex-shrink-0 w-7 text-center">{option.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{option.label}</div>
        {option.sub && <div className="text-xs text-white/40 mt-0.5">{option.sub}</div>}
      </div>
      {active && !multi && <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />}
      {multi && (
        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
          active ? 'bg-emerald-500 border-emerald-500' : 'border-white/25'
        }`}>
          {active && <Check className="w-3 h-3 text-white" />}
        </div>
      )}
    </button>
  )
}

// ─── Debts step — add-as-you-go list (optional) ────────────────────────────────
// The rate is optional here too (rough is fine — Money page tightens it up
// later), but capturing it now means one less thing the advisor has to ask
// for after setup.
function DebtsStep({ debts, setDebts }) {
  const [name, setName] = useState('')
  const [bal,  setBal]  = useState('')
  const [rate, setRate] = useState('')

  function add() {
    const b = parseFloat(bal)
    if (!name.trim() || isNaN(b) || b <= 0) return
    const r = parseFloat(rate)
    setDebts([...debts, { name: name.trim(), balance: b, interest_rate: isNaN(r) ? null : r }])
    setName(''); setBal(''); setRate('')
  }

  return (
    <div className="space-y-3">
      {debts.length > 0 && (
        <div className="space-y-1.5">
          {debts.map((d, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.075] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-sm text-white/85 truncate">{d.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {d.interest_rate != null && <span className="text-xs text-amber-200/80 tabular-nums">{d.interest_rate}%</span>}
                <span className="text-sm font-semibold text-rose-300 tabular-nums">${Math.round(d.balance).toLocaleString()}</span>
                <button type="button" onClick={() => setDebts(debts.filter((_, j) => j !== i))}
                  className="text-white/30 hover:text-rose-400 transition-colors text-lg leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-stretch">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Visa, student loan"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-white/15 bg-white/[0.075] text-white text-base md:text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
        <div className="flex items-center bg-white/[0.075] border-2 border-white/15 rounded-xl px-2.5 w-24 focus-within:border-emerald-500 transition-colors">
          <span className="text-white/40 text-sm mr-0.5">$</span>
          <input type="number" inputMode="decimal" min="0" value={bal} onChange={e => setBal(e.target.value)} placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="w-full min-w-0 bg-transparent text-base md:text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        <div className="flex items-center bg-white/[0.075] border-2 border-white/15 rounded-xl px-2 w-[70px] focus-within:border-emerald-500 transition-colors">
          <input type="number" inputMode="decimal" min="0" step="0.1" value={rate} onChange={e => setRate(e.target.value)} placeholder="APR"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="w-full min-w-0 bg-transparent text-base md:text-sm font-bold text-amber-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="text-white/35 text-xs">%</span>
        </div>
        <button type="button" onClick={add} disabled={!name.trim() || !(parseFloat(bal) > 0)}
          className="px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-semibold transition-colors">
          Add
        </button>
      </div>
      <p className="text-[11px] text-white/35">Don't know the rate? Leave it blank — no debts? Just hit Next.</p>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding({ onClose, profileOnly = false }) {
  const { user, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  // profileOnly (editing from Settings) shows just the profile questions — no
  // money/debts re-entry (those live on the Plan and stay untouched).
  // When opened manually (editing profile), skip preview + intro → go straight to age
  const startStep = onClose ? 2 : 0
  const [step,    setStep]    = useState(startStep)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [answers, setAnswers] = useState({
    age:              profile?.age             ? String(profile.age) : '',
    employment_type:  profile?.employment_type ?? '',
    employer_401k:    profile?.employer_401k   ?? '',
    investment_types: profile?.investment_types ?? [],
    health_insurance: profile?.health_insurance ?? '',
    primary_goal:     profile?.primary_goal    ?? '',
    monthly_income:   profile?.monthly_income   ? String(profile.monthly_income)   : '',
    monthly_expenses: profile?.monthly_expenses ? String(profile.monthly_expenses) : '',
    debts:            [],   // [{ name, balance }]
  })

  // Steps recompute as answers change (see buildSteps). Clamp the index in case
  // an earlier answer just shortened the list.
  const STEPS = buildSteps(answers, profileOnly)
  const safeStep = Math.min(step, STEPS.length - 1)
  const current = STEPS[safeStep]
  const isLast  = safeStep === STEPS.length - 1
  const isFirst = safeStep === 0

  function set(field, value) {
    setAnswers(prev => ({ ...prev, [field]: value }))
  }

  function toggleMulti(field, value) {
    setAnswers(prev => {
      const arr = prev[field] ?? []
      if (value === 'none') return { ...prev, [field]: arr.includes('none') ? [] : ['none'] }
      const without = arr.filter(v => v !== 'none')
      return { ...prev, [field]: without.includes(value) ? without.filter(v => v !== value) : [...without, value] }
    })
  }

  function canAdvance() {
    if (current.type === 'preview') return true
    if (current.type === 'intro')   return true
    if (current.type === 'age')     return answers.age && Number(answers.age) > 0 && Number(answers.age) < 120
    if (current.type === 'money')   return true   // all optional — rough or skip
    if (current.type === 'debts')   return true   // optional
    if (current.type === 'multi')   return answers[current.field]?.length > 0
    return !!answers[current.field]
  }

  // Auto-advance on single select
  function handleSingle(field, value) {
    setAnswers(prev => {
      const next = { ...prev, [field]: value }
      // No employer → the 401k question is skipped; record it as N/A so the
      // profile is still complete.
      if (field === 'employment_type') {
        next.employer_401k = (value === 'freelance' || value === 'student') ? 'na' : prev.employer_401k
      }
      return next
    })
    setTimeout(() => setStep(s => s + 1), 260)
  }

  async function finish() {
    setSaving(true)
    setError(null)

    // Profile-only edit (from Settings): just save the quiz answers — money,
    // accounts, debts, and net worth are managed on the Plan and left untouched.
    const profileFields = {
      id: user.id,
      first_name: user.user_metadata?.full_name?.split(' ')[0] ?? null,
      age: Number(answers.age) || null,
      employment_type:  answers.employment_type,
      employer_401k:    answers.employer_401k || 'na',
      investment_types: answers.investment_types,
      health_insurance: answers.health_insurance,
      primary_goal:     answers.primary_goal,
      onboarding_complete: true,
    }

    if (profileOnly) {
      const { data, error: profileError } = await supabase.from('profiles').upsert(profileFields, { onConflict: 'id' }).select().single()
      if (profileError) {
        setError(profileError.message ?? 'Could not save your profile.')
        setSaving(false)
        return
      }
      if (data) setProfile(data)
      setSaving(false)
      onClose?.()
      return
    }

    const validDebts = (answers.debts || []).filter(d => d.name?.trim() && Number(d.balance) > 0)
    // Seed debts so the advisor can plan payoff from day one.
    if (validDebts.length) {
      const { data: existingDebts, error: debtReadError } = await supabase.from('debts')
        .select('id, name').eq('user_id', user.id)
      if (debtReadError) {
        setError(debtReadError.message ?? 'Could not read your debts.')
        setSaving(false)
        return
      }
      for (const debt of validDebts) {
        const name = debt.name.trim()
        const match = existingDebts?.find(d => d.name?.trim().toLowerCase() === name.toLowerCase())
        const result = match
          ? await supabase.from('debts').update({ name, type: 'other', balance: Number(debt.balance), interest_rate: debt.interest_rate ?? null, last_verified_at: new Date().toISOString().slice(0, 10) }).eq('id', match.id).eq('user_id', user.id)
          : await supabase.from('debts').insert({ user_id: user.id, name, type: 'other', balance: Number(debt.balance), interest_rate: debt.interest_rate ?? null, last_verified_at: new Date().toISOString().slice(0, 10) })
        if (result.error) {
          setError(result.error.message ?? 'Could not save your debts.')
          setSaving(false)
          return
        }
      }
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .upsert(profileFields, { onConflict: 'id' })
      .select()
      .single()
    if (profileError) {
      setError(profileError.message ?? 'Could not finish setup.')
      setSaving(false)
      return
    }
    const { data: existingFlow, error: flowReadError } = await supabase.from('cash_flow_items')
      .select('id').eq('user_id', user.id).limit(1)
    if (flowReadError) {
      setError(flowReadError.message ?? 'Could not prepare your monthly plan.')
      setSaving(false)
      return
    }
    let savedProfile = data
    if (!existingFlow?.length) {
      const income = Number(answers.monthly_income) || 0
      const expenses = Number(answers.monthly_expenses) || 0
      const items = [
        ...(income > 0 ? [{ kind: 'income', group_key: 'income', category_key: 'other_income', name: 'Take-home income', amount: income, frequency: 'monthly', source: 'onboarding', sort_order: 0 }] : []),
        ...(expenses > 0 ? [{ kind: 'expense', group_key: 'wants', category_key: 'other_spending', name: 'Current monthly spending', amount: expenses, frequency: 'monthly', source: 'onboarding', sort_order: 1 }] : []),
      ]
      const { data: monthlyPlan, error: flowSaveError } = await supabase.rpc('save_monthly_plan', { p_items: items, p_limits: [] })
      if (flowSaveError) {
        setError(flowSaveError.message ?? 'Could not save your monthly plan.')
        setSaving(false)
        return
      }
      savedProfile = monthlyPlan?.profile || data
    }
    // The dashboard's money-picture row greets them warmly on this first
    // landing (see MoneySetupNudge) — acknowledge the setup they just did.
    try { sessionStorage.setItem(`money-nudge-fresh-${user.id}`, '1') } catch { /* private mode */ }
    setProfile(savedProfile)
    setSaving(false)
    if (onClose) onClose()
    else navigate(ONBOARDING_ACCOUNTS_ROUTE, { replace: true })
  }

  async function skip() {
    setError(null)
    const { data, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarding_complete: true }, { onConflict: 'id' })
      .select()
      .single()
    if (profileError) {
      setError(profileError.message ?? 'Could not skip setup.')
      return
    }
    try { sessionStorage.setItem(`money-nudge-fresh-${user.id}`, '1') } catch { /* private mode */ }
    setProfile(data)
    onClose?.()
  }

  // Progress: exclude preview step from dot count when showing to new users
  const dotsSteps = STEPS.slice(1) // dots = everything after the preview
  const dotsStep  = Math.max(0, safeStep - 1)

  // Portal to <body> so the modal escapes the page's z-10 stacking context and
  // sits above the floating mobile nav (z-50), which otherwise overlaps the footer.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="bg-[#0b140e] border border-white/[0.11] w-full sm:rounded-2xl sm:shadow-2xl sm:w-full sm:max-w-md overflow-hidden rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <span className="font-brand text-white font-semibold text-sm">Garden Financial</span>
            {onClose && (
              <button onClick={onClose} aria-label="Close"
                className="ml-auto -mr-1 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {current.type === 'preview' ? (
            // Preview step: big headline, no progress dots
            <div>
              <h2 className="font-display text-[22px] font-medium text-white leading-tight">
                Your finances, visualized as a garden.
              </h2>
              <p className="text-white/70 text-xs mt-1.5">
                The better your financial health, the more your garden thrives.
              </p>
            </div>
          ) : (
            // All other steps: show progress dots
            <>
              <div className="flex items-center gap-1.5">
                {dotsSteps.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < dotsStep ? 'bg-white w-4' : i === dotsStep ? 'bg-white w-6' : 'bg-white/30 w-3'
                  }`} />
                ))}
              </div>
              <div className="text-white/70 text-xs mt-2">Step {dotsStep + 1} of {dotsSteps.length}</div>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto" style={{ minHeight: 300, maxHeight: '60dvh' }}>
          {/* No AnimatePresence mode="wait" here: it gates the NEXT question
              behind the previous step's exit animation, so a throttled rAF
              (backgrounded tab, low-power mode) freezes the whole wizard on
              stale content. A keyed enter-only animation can't get stuck. */}
            <motion.div key={current.id}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}>

              {current.type !== 'preview' && (
                <>
                  <h2 className="font-display text-xl font-medium text-white mb-1 tracking-tight">{current.question}</h2>
                  {current.sub && <p className="text-sm text-white/50 mb-5">{current.sub}</p>}
                </>
              )}

              {/* Preview */}
              {current.type === 'preview' && <PreviewStep />}

              {/* Intro */}
              {current.type === 'intro' && (
                <div className="space-y-3 mt-2">
                  {[
                    'Age → compounding math gets real',
                    '401k match → free money check',
                    'Investment status → no repeat advice',
                    'Health insurance → critical gap check',
                    'Your #1 goal → focused conversations',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-white/65">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-300" />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Age input */}
              {current.type === 'age' && (
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="16" max="99"
                    value={answers.age}
                    onChange={e => set('age', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && canAdvance() && setStep(s => s + 1)}
                    placeholder="e.g. 24"
                    autoFocus
                    className="w-32 px-4 py-3 text-2xl font-bold text-white bg-white/[0.075] border-2 border-white/15 rounded-xl focus:outline-none focus:border-emerald-500 text-center tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-white/40 text-sm">years old</span>
                </div>
              )}

              {/* Money inputs — cash flow now, detailed accounts immediately after setup */}
              {current.type === 'money' && (
                <div className="space-y-3">
                  {[
                    { field: 'monthly_income',   label: 'Monthly income',   hint: 'after tax', auto: true },
                    { field: 'monthly_expenses', label: 'Monthly expenses', hint: 'rent, food, bills…' },
                  ].map(({ field, label, hint, auto }) => (
                    <label key={field} className="block">
                      <span className="text-sm font-medium text-white/80">{label}</span>
                      <span className="text-xs text-white/40 ml-1.5">{hint}</span>
                      <div className="mt-1 flex items-center bg-white/[0.075] border-2 border-white/15 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 transition-colors">
                        <span className="text-white/40 text-lg mr-1">$</span>
                        <input type="number" inputMode="decimal" min="0" step="50"
                          autoFocus={auto}
                          value={answers[field]}
                          onChange={e => set(field, e.target.value)}
                          placeholder="0"
                          className="w-full bg-transparent text-lg font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    </label>
                  ))}
                  <div className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-100">
                      <Landmark className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">Your accounts are next</p>
                      <p className="mt-1 text-xs leading-5 text-readable-secondary">After setup, Accounts opens automatically so you can add checking, savings, retirement, and brokerage accounts with their real details. Every save updates Home and your Advisor.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Debts — optional list */}
              {current.type === 'debts' && (
                <DebtsStep debts={answers.debts} setDebts={d => set('debts', d)} />
              )}

              {/* Single select */}
              {current.type === 'single' && (
                <div className="space-y-2">
                  {current.options.map(opt => (
                    <OptionCard key={opt.value} option={opt}
                      selected={answers[current.field]}
                      onClick={v => handleSingle(current.field, v)}
                      multi={false}
                    />
                  ))}
                </div>
              )}

              {/* Multi select */}
              {current.type === 'multi' && (
                <div className="space-y-2">
                  {current.options.map(opt => (
                    <OptionCard key={opt.value} option={opt}
                      selected={answers[current.field]}
                      onClick={v => toggleMulti(current.field, v)}
                      multi={true}
                    />
                  ))}
                </div>
              )}
            </motion.div>
        </div>

        {error && (
          <p role="alert" className="px-6 pb-3 text-xs text-rose-300">{error}</p>
        )}

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isFirst && (
              <button onClick={() => setStep(Math.max(0, safeStep - 1))}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {isFirst && (
              <button onClick={skip} className="text-xs text-white/30 hover:text-white/55 transition-colors">
                Skip for now
              </button>
            )}
          </div>

          {/* Show Next/Finish for non-auto-advance steps */}
          {(current.type === 'preview' || current.type === 'intro' || current.type === 'age' || current.type === 'multi' || current.type === 'money' || current.type === 'debts') && (
            isLast ? (
              <button onClick={finish} disabled={!canAdvance() || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30">
                {saving ? 'Saving…' : 'Finish setup'}
                {!saving && <Check className="w-4 h-4" />}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30">
                {current.type === 'preview' ? 'Get started' : 'Next'} <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}

          {/* For single-select last step */}
          {current.type === 'single' && isLast && answers[current.field] && (
            <button onClick={finish} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30 ml-auto">
              {saving ? 'Saving…' : 'Finish setup'}
              {!saving && <Check className="w-4 h-4" />}
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
