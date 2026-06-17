import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Sprout, ArrowRight, ArrowLeft, Check } from 'lucide-react'

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
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
      { value: 'employer',    label: 'Yes — through work',      icon: '✅' },
      { value: 'marketplace', label: 'Yes — marketplace / ACA', icon: '✅' },
      { value: 'parents',     label: "Yes — on parents' plan",  icon: '👨‍👩‍👧', sub: 'Available until age 26' },
      { value: 'none',        label: 'No — uninsured',          icon: '⚠️', sub: "We'll flag this as a priority" },
    ],
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
      emoji: '🌱',
      title: 'Your garden grows with you',
      desc: 'A living 3D garden that reflects your financial health in real time — lush when things are good, stormy when they need attention.',
    },
    {
      emoji: '🤖',
      title: 'An advisor who knows your numbers',
      desc: 'Not generic tips. Real advice built around your actual income, goals, and debt — powered by Claude AI.',
    },
    {
      emoji: '📈',
      title: 'Net worth tracking, automatically',
      desc: 'Your wealth is charted every day. Watch the line go up as your habits improve.',
    },
    {
      emoji: '🎯',
      title: 'Goals, debt, and budget — unified',
      desc: 'Everything in one place. Set goals, model debt payoff strategies, and see exactly where your money goes.',
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
          className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
        >
          <div className="text-2xl flex-shrink-0 leading-none mt-0.5">{f.emoji}</div>
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-0.5">{f.title}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
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
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
        active
          ? 'border-green-500 bg-green-50 text-green-900'
          : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/40'
      }`}
    >
      <span className="text-xl flex-shrink-0 w-7 text-center">{option.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{option.label}</div>
        {option.sub && <div className="text-xs text-gray-400 mt-0.5">{option.sub}</div>}
      </div>
      {active && !multi && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
      {multi && (
        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
          active ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}>
          {active && <Check className="w-3 h-3 text-white" />}
        </div>
      )}
    </button>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Onboarding({ onClose }) {
  const { user, profile, setProfile } = useAuth()
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
    const payload = {
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:w-full sm:max-w-md overflow-hidden rounded-t-3xl shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">Garden Financial</span>
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
        <div className="px-6 py-6 overflow-y-auto" style={{ minHeight: 300, maxHeight: '60vh' }}>
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>

              {current.type !== 'preview' && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">{current.question}</h2>
                  {current.sub && <p className="text-sm text-gray-500 mb-5">{current.sub}</p>}
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
                    <div key={i} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-green-600" />
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
                    className="w-32 px-4 py-3 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 text-center"
                  />
                  <span className="text-gray-400 text-sm">years old</span>
                </div>
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
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {isFirst && (
              <button onClick={skip} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
                Skip for now
              </button>
            )}
          </div>

          {/* Show Next/Finish for non-auto-advance steps */}
          {(current.type === 'preview' || current.type === 'intro' || current.type === 'age' || current.type === 'multi') && (
            isLast ? (
              <button onClick={finish} disabled={!canAdvance() || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                {saving ? 'Saving…' : 'Finish setup'}
                {!saving && <Check className="w-4 h-4" />}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                {current.type === 'preview' ? 'Get started' : 'Next'} <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}

          {/* For single-select last step */}
          {current.type === 'single' && isLast && answers[current.field] && (
            <button onClick={finish} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm ml-auto">
              {saving ? 'Saving…' : 'Finish setup'}
              {!saving && <Check className="w-4 h-4" />}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
