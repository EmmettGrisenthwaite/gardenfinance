import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Sprout, ArrowRight, ArrowLeft, Check, X } from 'lucide-react'

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
    question: 'Now the numbers — rough is fine.',
    sub: 'Income, spending, and what\'s in your accounts. This powers your dashboard and lets your advisor give advice about the real you.',
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
function DebtsStep({ debts, setDebts }) {
  const [name, setName] = useState('')
  const [bal,  setBal]  = useState('')

  function add() {
    const b = parseFloat(bal)
    if (!name.trim() || isNaN(b) || b <= 0) return
    setDebts([...debts, { name: name.trim(), balance: b }])
    setName(''); setBal('')
  }

  return (
    <div className="space-y-3">
      {debts.length > 0 && (
        <div className="space-y-1.5">
          {debts.map((d, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.075] border border-white/10 rounded-lg px-3 py-2">
              <span className="text-sm text-white/85 truncate">{d.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
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
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-white/15 bg-white/[0.075] text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
        <div className="flex items-center bg-white/[0.075] border-2 border-white/15 rounded-xl px-2.5 w-24 focus-within:border-emerald-500 transition-colors">
          <span className="text-white/40 text-sm mr-0.5">$</span>
          <input type="number" inputMode="decimal" min="0" value={bal} onChange={e => setBal(e.target.value)} placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="w-full min-w-0 bg-transparent text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        <button type="button" onClick={add} disabled={!name.trim() || !(parseFloat(bal) > 0)}
          className="px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-semibold transition-colors">
          Add
        </button>
      </div>
      <p className="text-[11px] text-white/35">No debts? Just hit Next — nice work.</p>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding({ onClose, profileOnly = false }) {
  const { user, profile, setProfile } = useAuth()
  // profileOnly (editing from Settings) shows just the profile questions — no
  // money/debts re-entry (those live on Your Money and stay untouched).
  const STEPS = profileOnly ? BASE_STEPS.filter(s => !['money', 'debts'].includes(s.id)) : BASE_STEPS
  // When opened manually (editing profile), skip preview + intro → go straight to age
  const startStep = onClose ? 2 : 0
  const [step,    setStep]    = useState(startStep)
  const [saving,  setSaving]  = useState(false)
  const [answers, setAnswers] = useState({
    age:              profile?.age             ? String(profile.age) : '',
    employment_type:  profile?.employment_type ?? '',
    employer_401k:    profile?.employer_401k   ?? '',
    investment_types: profile?.investment_types ?? [],
    health_insurance: profile?.health_insurance ?? '',
    primary_goal:     profile?.primary_goal    ?? '',
    monthly_income:   profile?.monthly_income   ? String(profile.monthly_income)   : '',
    monthly_expenses: profile?.monthly_expenses ? String(profile.monthly_expenses) : '',
    checking:         '',
    savings:          '',
    brokerage:        '',
    debts:            [],   // [{ name, balance }]
  })

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1
  const isFirst = step === 0

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
    set(field, value)
    setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 260)
  }

  async function finish() {
    setSaving(true)

    // Profile-only edit (from Settings): just save the quiz answers — money,
    // accounts, debts, and net worth are managed on Your Money and left untouched.
    const profileFields = {
      id: user.id,
      first_name: user.user_metadata?.full_name?.split(' ')[0] ?? null,
      age: Number(answers.age) || null,
      employment_type:  answers.employment_type,
      employer_401k:    answers.employer_401k,
      investment_types: answers.investment_types,
      health_insurance: answers.health_insurance,
      primary_goal:     answers.primary_goal,
      onboarding_complete: true,
    }

    if (profileOnly) {
      const { data } = await supabase.from('profiles').upsert(profileFields, { onConflict: 'id' }).select().single()
      if (data) setProfile(data)
      setSaving(false)
      onClose?.()
      return
    }

    const checking  = Number(answers.checking)  || 0
    const savings   = Number(answers.savings)   || 0
    const brokerage = Number(answers.brokerage) || 0
    const validDebts = (answers.debts || []).filter(d => d.name?.trim() && Number(d.balance) > 0)
    const totalDebt  = validDebts.reduce((s, d) => s + Number(d.balance), 0)
    // Net worth = what you own (accounts) minus what you owe (debts).
    const netWorth = checking + savings + brokerage - totalDebt

    // Seed accounts + debts FIRST, then flip the profile. The dashboard refetches
    // accounts the moment `onboarding_complete` flips, so the rows must exist by
    // then — otherwise account value shows a stale $0.

    // Typed account balances (one canonical row per type) — feeds the allocation
    // donut + advisor context. Update-or-insert so re-running setup never creates
    // duplicate rows (which would double the summed account value).
    const accountRows = [
      { type: 'checking',  name: 'Checking',    balance: checking },
      { type: 'savings',   name: 'Savings',     balance: savings },
      { type: 'brokerage', name: 'Investments', balance: brokerage },
    ].filter(a => a.balance > 0)
    if (accountRows.length) {
      try {
        const { data: existing } = await supabase.from('accounts').select('id, type').eq('user_id', user.id)
        for (const a of accountRows) {
          const match = existing?.find(e => e.type === a.type)
          if (match) await supabase.from('accounts').update({ balance: a.balance, name: a.name }).eq('id', match.id)
          else       await supabase.from('accounts').insert({ ...a, user_id: user.id })
        }
      } catch { /* non-blocking */ }
    }
    // Seed debts so the advisor can plan payoff from day one.
    if (validDebts.length) {
      await supabase.from('debts')
        .insert(validDebts.map(d => ({ user_id: user.id, name: d.name.trim(), balance: Number(d.balance) })))
        .then(() => {}, () => {})
    }

    const payload = {
      ...profileFields,
      monthly_income:   Number(answers.monthly_income)   || 0,
      monthly_expenses: Number(answers.monthly_expenses) || 0,
      net_worth:        netWorth,
    }
    const { data } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()
    setProfile(data)
    setSaving(false)
    onClose?.()
  }

  async function skip() {
    const { data } = await supabase
      .from('profiles')
      .upsert({ id: user.id, onboarding_complete: true }, { onConflict: 'id' })
      .select()
      .single()
    setProfile(data)
    onClose?.()
  }

  // Progress: exclude preview step from dot count when showing to new users
  const dotsSteps = STEPS.slice(1) // dots = everything after the preview
  const dotsStep  = Math.max(0, step - 1)

  // Portal to <body> so the modal escapes the page's z-10 stacking context and
  // sits above the floating mobile nav (z-50), which otherwise overlaps the footer.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Garden Financial setup"
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
            <span className="text-white font-bold text-sm">Garden Financial</span>
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
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>

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

              {/* Money inputs — cash flow + typed account balances */}
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
                  <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide pt-1">What&apos;s in your accounts</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { field: 'checking',  label: 'Checking',    color: 'focus-within:border-sky-400' },
                      { field: 'savings',   label: 'Savings',     color: 'focus-within:border-emerald-400' },
                      { field: 'brokerage', label: 'Investments', color: 'focus-within:border-violet-400' },
                    ].map(({ field, label, color }) => (
                      <label key={field} className="block">
                        <span className="text-xs font-medium text-white/70">{label}</span>
                        <div className={`mt-1 flex items-center bg-white/[0.075] border-2 border-white/15 rounded-lg px-2 py-2 transition-colors ${color}`}>
                          <span className="text-white/40 text-sm mr-0.5">$</span>
                          <input type="number" inputMode="decimal" min="0" step="50"
                            value={answers[field]}
                            onChange={e => set(field, e.target.value)}
                            placeholder="0"
                            className="w-full min-w-0 bg-transparent text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/35">Estimates are fine — you can fine-tune these in Your Money later.</p>
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
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isFirst && (
              <button onClick={() => setStep(s => s - 1)}
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
