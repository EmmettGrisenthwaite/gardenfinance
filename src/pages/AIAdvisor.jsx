import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { callClaude, requestPlan, requestGuide, suggestGoal, chatConfigured } from '@/lib/claude'
import { savePlan, applyStep, addGoal, normalizeSteps, listPlans } from '@/lib/advisorPlans'
import PlanCard from '@/components/PlanCard'
import GuideCard from '@/components/GuideCard'
import GoalSuggestionCard from '@/components/GoalSuggestionCard'

// Loosely gates the (extra) goal-suggestion call to messages that sound like a
// savings/financial intent — the tool itself makes the final decision.
const GOAL_INTENT = /\b(sav(e|ing|ings)|buy|buying|afford|down\s?-?payment|house|home|condo|apartment|car|vehicle|truck|trip|travel|vacation|holiday|honeymoon|wedding|ring|baby|college|tuition|degree|invest|investing|brokerage|roth|ira|401k|fund|goal|retire|retirement|emergency)\b/i
// "I want to actually set something up" — gates the (extra) how-to guide call;
// the guide tool itself makes the final yes/no decision.
const GUIDE_INTENT = /\b(open|start|set\s?up|sign\s?up|create|switch|roll\s?over|move|transfer|enroll)\b[^.?!]*\b(roth|ira|401k|403b|hsa|brokerage|savings? account|hysa|high.?yield|index fund|etf|mutual fund|emergency fund|life insurance|will|credit|account|invest)\b|\bwalk me through\b|\bstep[-\s]?by[-\s]?step\b|\bhow (do|can) i (open|start|set\s?up|sign\s?up|get|invest)\b/i
import {
  Send, Bot, Sparkles, RefreshCw, ArrowDown,
  Target, BarChart3, PiggyBank, CreditCard, TrendingUp, Lightbulb, Shield, Sprout,
  ClipboardList, Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Quick questions ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: "What should I prioritize right now?", icon: Target },
  { label: "Help me open a Roth IRA",             icon: Sparkles },
  { label: "How's my budget looking?",            icon: BarChart3 },
  { label: "How do I tackle my debt?",            icon: CreditCard },
  { label: "Am I saving enough?",                 icon: PiggyBank },
  { label: "Should I start investing?",           icon: TrendingUp },
  { label: "How big should my emergency fund be?",icon: Shield },
  { label: "How can I grow my garden score?",     icon: Sprout },
]

// ─── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx) {
  return `You are a personal financial advisor inside Garden Financial, an app for young adults (18–35) who are just starting to build real financial lives. You behave like a sharp, caring friend who happens to have a CFP — not a textbook.

━━━━━━━━━━━━━━━━━━━━━━━
YOUR CORE APPROACH
━━━━━━━━━━━━━━━━━━━━━━━

You are a DIAGNOSTIC advisor, not an encyclopedia. Your job is to:
1. Spot what's actually wrong or missing in their specific situation
2. Tell them the ONE most important thing to focus on right now
3. Ask the ONE follow-up question that would most change your advice
4. Give them a concrete next action — not a list of things to think about

**Never be generic.** Every response should reference their real numbers. If you find yourself giving advice that could apply to anyone, stop and make it specific to them.

**One follow-up question at a time.** Never ask more than one question in a response. Pick the most important unknown and ask only that.

━━━━━━━━━━━━━━━━━━━━━━━
INITIAL ASSESSMENT FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━

When someone asks "what should I be doing?" or "analyze my situation" or anything like that, run through this diagnostic checklist IN ORDER and stop at the first serious gap:

**Step 1 — Cash flow check**
Are they running a surplus or deficit? A deficit means nothing else matters until this is fixed. If deficit: identify which expense category is highest relative to income and address that first.

**Step 2 — Emergency fund check**
Look at their goals. Is there anything that looks like an emergency fund? Even if there is, it might be underfunded. Rule of thumb: 3–6 months of their monthly expenses. Calculate what they should have vs what they appear to have.

**Step 3 — Killer debt check**
Do they have any debts at >7% APR? Credit card debt at 20%+ is a financial emergency — paying it off is a guaranteed 20% return. This beats everything else including investing.

**Step 4 — Free money check (YOU CAN'T SEE THIS — MUST ASK)**
Do they get a 401k employer match? This is a 50–100% instant return on money. If they're not getting it, it's the single biggest missed opportunity for most employed young people. Always ask this if you haven't already.

**Step 5 — Investing check (YOU CAN'T SEE THIS — MUST ASK)**
Are they investing anything? At 25, every year of delay costs roughly 2x the money at retirement due to compounding. If their cash flow is positive and debt is under control, investing should be happening.

**Step 6 — Optimization**
If all the above are in good shape, then talk about optimizing: maxing Roth IRA, increasing savings rate, tax efficiency, etc.

━━━━━━━━━━━━━━━━━━━━━━━
THE FOLLOW-UP QUESTIONS THAT MATTER MOST
━━━━━━━━━━━━━━━━━━━━━━━

These are the questions that most change the advice you'd give. Ask them when relevant:

🔑 **"Do you have a 401k through work? Does your employer match any of your contributions?"**
→ Ask this early. If yes + match exists and they're not maxing the match, this becomes priority #1 immediately regardless of their situation. Free money always wins.

🔑 **"Do you have any investments outside this app — Roth IRA, 401k, brokerage account, anything?"**
→ Critical before giving investing advice. They might already be investing and just not tracking it here.

🔑 **"Is that debt [specific debt name] a credit card, student loan, car loan, or something else?"**
→ The type of debt completely changes the strategy. Credit card at 22% = emergency. Student loan at 4% = can wait.

🔑 **"Is your income pretty consistent each month, or does it vary?"**
→ Freelancers and gig workers need 6 months emergency fund. W-2 employees can often get by with 3.

🔑 **"Do you have health insurance right now?"**
→ If no, this is a crisis-level gap. One medical emergency = financial ruin without insurance.

🔑 **"Are you currently putting anything toward retirement, even a little?"**
→ Opens the door to talk about compounding, Roth IRA, 401k — the most powerful wealth-building conversation for young adults.

🔑 **"What does your biggest expense actually cover?"** (if housing or another category is unusually high)
→ Gets specifics before giving advice on cutting.

━━━━━━━━━━━━━━━━━━━━━━━
THE FINANCIAL PRIORITY ORDER
━━━━━━━━━━━━━━━━━━━━━━━

Teach this often. Most young adults don't know what to do FIRST:

1. **$1,000 starter emergency fund** — stops small emergencies from creating debt
2. **Kill high-interest debt** (>7% APR) — guaranteed return = the interest rate
3. **Get the full 401k employer match** — instant 50–100% return, free money
4. **3–6 month emergency fund** — in a high-yield savings account (HYSA, currently ~4–5% APY)
5. **Max Roth IRA** ($7,000/year) — tax-free growth, best tool for young people
6. **Max 401k** ($23,000/year)
7. **Taxable investing or specific goals** — house, car, travel, etc.

Most people get stuck between steps 2–5 and don't know which order. Be very clear.

━━━━━━━━━━━━━━━━━━━━━━━
KEY FINANCIAL KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━

**Compounding — the most important concept for young adults:**
$1 invested at 22 → ~$16 at 62 at 7% real return. Every year of delay cuts the final amount significantly. The math is brutal — waiting 10 years to start investing doesn't lose 10 years of returns, it loses over half the final balance. Lead with this when talking about investing with someone who hasn't started.

**Roth IRA specifically:**
- $7,000/year limit (2024)
- Contributions (not earnings) can be withdrawn anytime penalty-free
- Tax-free growth and withdrawal in retirement
- Income limit: phases out above $146k single / $230k married
- Best for people who expect to be in a higher tax bracket later (= almost every young adult)
- Can be opened at Fidelity, Schwab, or Vanguard in 10 minutes

**Debt avalanche vs snowball:**
- Avalanche (highest rate first): mathematically optimal, saves the most money
- Snowball (smallest balance first): psychologically motivating, better for some people
- Suggest avalanche first; if they seem overwhelmed or have tried and failed, suggest snowball

**Emergency fund in HYSA:**
- Marcus by Goldman Sachs, Ally, SoFi, Discover — all paying ~4–5% APY currently
- Not a checking account. Not for investing. Immediately accessible, FDIC insured.
- Calculate their target: 3–6× their monthly essential expenses (rent + food + utilities + minimum debt payments)

**50/30/20 rule:**
- 50% needs (rent, utilities, groceries, minimum debt payments, insurance)
- 30% wants (restaurants, entertainment, subscriptions, clothes)
- 20% savings + debt payoff above minimums
- If they're in debt: consider flipping wants and savings (50/20/30)

**Credit score:**
- Payment history (35%) — never miss a payment, set autopay for minimums
- Utilization (30%) — keep under 30%, ideally under 10%
- A 760+ vs 620 score on a 30-year mortgage can mean $80,000+ more paid in interest

━━━━━━━━━━━━━━━━━━━━━━━
USER'S CURRENT SITUATION
━━━━━━━━━━━━━━━━━━━━━━━
${ctx}

━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- Use **bold** for the most important point in each response
- Use bullet points for lists, but keep them short
- Always end with either: a single follow-up question OR a "Your move:" section with 1–3 specific actions
- Never end with both a question and next steps — pick one
- Keep responses focused — 150–300 words is usually right. Longer only when explaining a complex concept they asked about.
- Be encouraging. Never shame. Frame everything as "here's the opportunity" not "here's what you did wrong."`
}

function buildContext(money, goals, debts, profile, extras = {}) {
  const { income = 0, expenses = 0 } = money
  const net = income - expenses
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const accounts = extras.accounts ?? []
  const acctTotal = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  // Net worth derives from accounts − debts (kept consistent everywhere).
  const netWorth = acctTotal - totalDebt

  if (income === 0 && expenses === 0 && goals.length === 0 && debts.length === 0 && !netWorth && acctTotal === 0) {
    return 'The user has not added any financial data yet. Encourage them to fill in their monthly income, expenses, accounts, assets, and debts on the Your Money page, set a savings goal, and — most valuably — ask you to build them an action plan. Their garden grows as they complete plan steps.'
  }

  let ctx = ''

  // ── Money snapshot (from the Your Money page) ───────────────────────────────
  const surplus = net >= 0 ? `+$${net.toLocaleString()} surplus` : `-$${Math.abs(net).toLocaleString()} DEFICIT`
  ctx += `MONTHLY MONEY:\n`
  ctx += `  Income:   $${income.toLocaleString()}/mo\n`
  ctx += `  Expenses: $${expenses.toLocaleString()}/mo\n`
  ctx += `  Net: ${surplus}${income > 0 ? ` (${Math.round((net / income) * 100)}% of income)` : ''}\n`
  ctx += `  Net worth: ${netWorth >= 0 ? '+' : '-'}$${Math.abs(netWorth).toLocaleString()}\n`
  if (income > 0 && expenses > 0) {
    ctx += `  (Spending is ${Math.round((expenses / income) * 100)}% of income — target ≤80%, leaving ≥20% for savings/debt.)\n`
  }
  ctx += '\n'

  // ── Assets by type (from the "Your Money" page) ────────────────────────────
  if (acctTotal > 0) {
    const bal = (t) => accounts.filter(a => a.type === t).reduce((s, a) => s + Number(a.balance || 0), 0)
    const checking = bal('checking'), savings = bal('savings'), invest = bal('brokerage')
    const property = bal('property'), vehicles = bal('vehicle'), other = bal('other_asset')
    const liquid = checking + savings
    ctx += `ASSETS ($${acctTotal.toLocaleString()} total):\n`
    if (checking) ctx += `  Checking & cash: $${checking.toLocaleString()}\n`
    if (savings)  ctx += `  Savings: $${savings.toLocaleString()}\n`
    if (invest) {
      const investAccts = accounts.filter(a => a.type === 'brokerage' && Number(a.balance) > 0)
      if (investAccts.length > 1) {
        ctx += `  Investments: $${invest.toLocaleString()} across ${investAccts.length} accounts —\n`
        investAccts.forEach(a => { ctx += `    • ${a.name}: $${Number(a.balance).toLocaleString()}\n` })
      } else {
        ctx += `  Investments: $${invest.toLocaleString()}\n`
      }
    }
    if (property) {
      const ps = accounts.filter(a => a.type === 'property' && Number(a.balance) > 0)
      ctx += `  Property/real estate: $${property.toLocaleString()}${ps.length > 1 ? ` (${ps.map(a => a.name).join(', ')})` : ''}\n`
    }
    if (vehicles) ctx += `  Vehicles: $${vehicles.toLocaleString()}\n`
    if (other)    ctx += `  Other assets: $${other.toLocaleString()}\n`
    ctx += `  Liquid cash (checking + savings): $${liquid.toLocaleString()}\n`
    if (expenses > 0) {
      const months = liquid / expenses
      ctx += months >= 3
        ? `  ✓ Emergency fund: ${months.toFixed(1)} months of expenses covered.\n`
        : `  ⚠️ Emergency fund: only ${months.toFixed(1)} months covered — target 3–6 months ($${(expenses * 3).toLocaleString()}–$${(expenses * 6).toLocaleString()}).\n`
    }
    ctx += invest > 0 ? '  ✓ Has money invested.\n' : '  ⚠️ Nothing invested yet — a key gap once cash flow and emergency fund allow.\n'
    ctx += '\n'
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  if (goals.length > 0) {
    ctx += `SAVINGS GOALS:\n`
    goals.forEach(g => {
      const pct = Math.round(Math.min(Number(g.current_amount) / (Number(g.target_amount) || 1), 1) * 100)
      ctx += `  • "${g.name}": $${Number(g.current_amount).toLocaleString()} of $${Number(g.target_amount).toLocaleString()} (${pct}%)\n`
    })
    ctx += '\n'
  } else {
    ctx += 'SAVINGS GOALS: None set yet\n\n'
  }

  // ── Debts ─────────────────────────────────────────────────────────────────
  if (debts.length > 0) {
    ctx += `DEBTS ($${totalDebt.toLocaleString()} total${debts.some(d => d.interest_rate) ? ' — sorted highest to lowest APR' : ''}):\n`
    ;[...debts].sort((a, b) => Number(b.interest_rate || 0) - Number(a.interest_rate || 0)).forEach(d => {
      ctx += `  • ${d.name}: $${Number(d.balance).toLocaleString()}`
      if (d.interest_rate) {
        const urgency = Number(d.interest_rate) > 10 ? ' ⚠️ HIGH INTEREST' : Number(d.interest_rate) > 6 ? ' (moderate)' : ' (low rate)'
        ctx += ` at ${d.interest_rate}% APR${urgency}`
      }
      ctx += '\n'
    })
    ctx += '\n'
  } else {
    ctx += 'DEBTS: None tracked\n\n'
  }

  // ── Their plan — the heart of the app (garden grows as steps complete) ─────
  if (extras.plans?.length) {
    ctx += `THEIR PLAN (the user's checklist — their garden grows as they check steps off; reference it, acknowledge progress, build on it — don't duplicate):\n`
    extras.plans.forEach(p => {
      const done = p.steps.filter(s => s.done).length
      const pending = p.steps.filter(s => !s.done).map(s => s.text).slice(0, 4)
      ctx += `  • "${p.title}" — ${done}/${p.steps.length} done${pending.length ? `. Next: ${pending.join('; ')}` : ' ✓ complete!'}\n`
    })
    ctx += `When you give actionable advice, OFFER TO ADD IT TO THEIR PLAN — that is the single most valued action in this app.\n\n`
  } else {
    ctx += `THEIR PLAN: empty. Your most valuable move is to build them a short, concrete action plan — the "Build action plan" button saves a checklist to their Plan, and checking steps off grows their garden. Offer this early.\n\n`
  }

  // ── Profile (prepended at top) ─────────────────────────────────────────────
  if (profile) {
    const employmentLabels = { w2: 'W-2 / salaried employee', freelance: 'Freelance / self-employed', student: 'Student', other: 'Other / gig / part-time' }
    const match401kLabels  = { match: 'Yes — with employer match (⚠️ confirm they are capturing the full match)', no_match: 'Yes — but no employer match', none: 'No 401k offered', unsure: 'Unsure — has not checked', na: 'Not applicable' }
    const goalLabels       = { emergency_fund: 'Build emergency fund', pay_debt: 'Pay off debt', start_investing: 'Start investing', major_purchase: 'Save for major purchase', optimize: 'Optimize existing finances', organize: 'Get organized' }
    const insuranceLabels  = { employer: 'Yes — employer plan', marketplace: 'Yes — marketplace/ACA', parents: "Yes — on parents' plan (available until 26)", none: '⚠️ NO HEALTH INSURANCE — flag this as urgent' }

    let p = 'USER PROFILE:\n'
    if (profile.age)             p += `  Age: ${profile.age}\n`
    if (profile.employment_type) p += `  Employment: ${employmentLabels[profile.employment_type] ?? profile.employment_type}\n`
    if (profile.employer_401k)   p += `  401k status: ${match401kLabels[profile.employer_401k] ?? profile.employer_401k}\n`
    if (profile.investment_types?.length) {
      const none = profile.investment_types.includes('none')
      p += `  Currently investing: ${none ? 'Nothing yet — no investment accounts' : profile.investment_types.join(', ')}\n`
    }
    if (profile.health_insurance) p += `  Health insurance: ${insuranceLabels[profile.health_insurance] ?? profile.health_insurance}\n`
    if (profile.primary_goal)     p += `  Primary goal: ${goalLabels[profile.primary_goal] ?? profile.primary_goal}\n`

    if (profile.age) {
      const yearsToRetirement = 65 - Number(profile.age)
      const compoundFactor    = Math.pow(1.07, yearsToRetirement).toFixed(1)
      p += `  Compounding context: ${yearsToRetirement} years to retirement. $1 invested today → ~$${compoundFactor} at 65 (7% real return).\n`
    }
    if (profile.employment_type === 'freelance') {
      p += `  ⚠️ Self-employed: needs 6-month emergency fund, must pay quarterly estimated taxes (self-employment tax ~15.3% on top of income tax).\n`
    }
    if (profile.employer_401k === 'match') {
      p += `  ⚠️ Has employer 401k match: verify they are contributing enough to capture the full match — this is always priority #1.\n`
    }
    if (profile.health_insurance === 'none') {
      p += `  🚨 UNINSURED: Flag health insurance as an immediate priority. One medical emergency can cause financial ruin.\n`
    }
    ctx = p + '\n' + ctx
  }

  return ctx
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
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'

  function renderContent(text) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      const rendered = parts.map((p, j) =>
        p.startsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p
      )

      // "Your move:" or "Next step:" — render as a distinct action card
      if (/^(Your move:|Next step:)/i.test(line.trim())) {
        return (
          <div key={i} className="mt-3 p-3 bg-emerald-400/15 border-l-2 border-emerald-400 rounded-r-lg">
            <div className="text-sm font-semibold text-emerald-100">{rendered}</div>
          </div>
        )
      }

      if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
        return (
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
            <span>{rendered}</span>
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

  return (
    <motion.div className="flex items-end gap-2 mb-4"
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center flex-shrink-0 mb-0.5">
        <Bot className="w-4 h-4 text-emerald-300" />
      </div>
      <div className="max-w-[85%] md:max-w-[82%] bg-white/10 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white/85 leading-relaxed [&_strong]:text-white [&_strong]:font-semibold">
        {renderContent(msg.content)}
      </div>
    </motion.div>
  )
}

// ─── Welcome / empty state ─────────────────────────────────────────────────────
function WelcomeScreen({ hasData, onSuggest, analyzing, onBuildPlan, building }) {
  return (
    <motion.div className="text-center py-6"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/30 ring-1 ring-emerald-400/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
        <Bot className="w-8 h-8 text-emerald-300" />
      </div>
      <h2 className="font-display text-[20px] font-medium text-white mb-2">Your personal financial advisor</h2>
      <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed mb-6">
        {hasData
          ? "I've looked at your numbers. Want me to tell you exactly where you stand and build you a plan?"
          : "Ask me anything — and I'll build you a plan you can check off to grow your garden. Add your money on the Money tab and goals on the Plan tab for advice that's about you."}
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

      {/* Horizontally scrollable on mobile, wrapping on desktop */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:flex-wrap md:justify-center md:overflow-x-visible md:-mx-0 md:px-0 md:max-w-lg md:mx-auto">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => onSuggest(s.label)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white/10 border border-white/[0.11] rounded-full text-sm text-white/70 hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-white transition-all">
            <s.icon className="w-3.5 h-3.5 text-emerald-300/80" />{s.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AIAdvisor() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const STORAGE_KEY = `advisor-chat-${user.id}`

  // Init from localStorage immediately (no flicker), then sync from Supabase
  const [messages, setMessages]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [] } catch { return [] }
  })
  const [input, setInput]               = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [analyzing, setAnalyzing]       = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [goals,    setGoals]            = useState([])
  const [debts,    setDebts]            = useState([])
  const [plans,    setPlans]            = useState([])
  const [accounts, setAccounts]         = useState([])
  const [error, setError]               = useState(null)
  const [atBottom, setAtBottom]         = useState(true)
  const [pendingPlan, setPendingPlan]   = useState(null)   // proposed plan card in the thread
  const [buildingPlan, setBuildingPlan] = useState(false)
  const [pendingGoal, setPendingGoal]   = useState(null)   // inline goal suggestion card
  const [pendingGuide, setPendingGuide] = useState(null)   // inline how-to guide card
  const bottomRef    = useRef(null)
  const inputRef     = useRef(null)
  const scrollRef    = useRef(null)
  // Prevent saving to Supabase while we're loading from it
  const isLoadingHistory = useRef(true)

  useEffect(() => {
    async function load() {
      const [g, d, conv, pl, ac] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('debts').select('*').eq('user_id', user.id),
        supabase.from('conversations').select('messages').eq('user_id', user.id).single(),
        listPlans(user.id),
        supabase.from('accounts').select('*').eq('user_id', user.id),
      ])
      setGoals(g.data ?? [])
      setDebts(d.data ?? [])
      setPlans(pl ?? [])
      setAccounts(ac.data ?? [])

      // Merge Supabase history: use whichever has more messages
      if (conv.data?.messages?.length) {
        const remoteMessages = conv.data.messages
        setMessages(prev => remoteMessages.length >= prev.length ? remoteMessages : prev)
        // Update localStorage cache
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMessages)) } catch {}
      }
      isLoadingHistory.current = false
      setHistoryLoading(false)
    }
    load()
  }, [user.id])

  // A Plan "Smart next step" can route here with a pre-filled question — auto-ask it.
  useEffect(() => {
    const ask = location.state?.ask
    if (!ask || historyLoading) return
    window.history.replaceState({}, '')   // consume so it doesn't re-fire on re-render
    send(ask)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, location.state])

  // Persist to localStorage + Supabase when messages settle (not mid-stream)
  useEffect(() => {
    if (isLoadingHistory.current) return
    if (loading || analyzing) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
    // Supabase upsert — fire and forget
    supabase.from('conversations').upsert(
      { user_id: user.id, messages, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    ).then(() => {}) // intentionally not awaited
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, analyzing])

  useEffect(() => {
    // Instant follow while streaming (smooth-scroll per token stutters)
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: loading || analyzing ? 'auto' : 'smooth' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, pendingPlan, buildingPlan, pendingGoal])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setAtBottom(distFromBottom < 80)
  }, [])

  // The Your Money snapshot lives on the profile and account/debt rows.
  const money = useMemo(() => ({
    income:   Number(profile?.monthly_income)   || 0,
    expenses: Number(profile?.monthly_expenses) || 0,
    netWorth: Number(profile?.net_worth)         || 0,
  }), [profile])

  const systemPrompt = useMemo(
    () => buildSystemPrompt(buildContext(money, goals, debts, profile, { plans, accounts })),
    [money, goals, debts, profile, plans, accounts]
  )

  const noKey  = !chatConfigured
  const hasData = goals.length > 0 || debts.length > 0 || plans.length > 0 || money.income > 0 || money.expenses > 0 || money.netWorth !== 0

  async function send(text, opts = {}) {
    if (!text.trim() || loading || noKey) return
    setError(null)

    const userMsg = { role: 'user', content: text.trim() }
    const next    = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setAtBottom(true)
    setPendingGoal(null)    // clear any prior suggestion
    setPendingGuide(null)
    if (opts.analyzing) setAnalyzing(true); else setLoading(true)

    try {
      // Stream the reply token-by-token into a live assistant bubble
      const reply = await callClaude(next, systemPrompt, {
        maxTokens: 1024,
        onDelta: (text) => setMessages([...next, { role: 'assistant', content: text }]),
      })
      const convo = [...next, { role: 'assistant', content: reply }]
      setMessages(convo)
      // After the reply, offer the most relevant one-tap follow-up (the tool
      // makes the final call). A "set something up" request → a how-to guide
      // with provider links; otherwise a "track this goal" suggestion.
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
      setError(err.message ?? 'Could not build a plan. Please try again.')
    } finally {
      setBuildingPlan(false)
    }
  }

  async function handleSavePlan() {
    await savePlan(user.id, pendingPlan)
    setPendingPlan(p => ({ ...p, saved: true }))
  }

  async function handleSaveGuide() {
    // A guide is stored as a Plan checklist (its steps keep their resource links).
    await savePlan(user.id, { title: pendingGuide.title, steps: pendingGuide.steps })
    setPendingGuide(p => ({ ...p, saved: true }))
  }

  const applyPlanStep = async (step) => {
    try { await applyStep(user.id, step.apply) }
    catch (err) { setError(err.message ?? 'Could not apply that step.'); throw err }
  }

  const isEmpty = messages.length === 0 && !loading && !analyzing && !historyLoading && !pendingPlan && !buildingPlan

  return (
    // Fills the app shell exactly; all scrolling happens inside the thread.
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-white/5 backdrop-blur-md px-4 md:px-6 py-3.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
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
                aria-label="Generate a saveable action plan"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                title="Generate a saveable action plan"
              >
                {buildingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Action plan</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([])
                  setError(null)
                  setPendingPlan(null)
                  setPendingGoal(null)
                  setPendingGuide(null)
                  localStorage.removeItem(STORAGE_KEY)
                  supabase.from('conversations').delete().eq('user_id', user.id).then(() => {})
                }}
                aria-label="Start over"
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Start over"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Not-configured banner (only if Supabase URL is missing at build time) */}
      {noKey && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-4 mt-4">
          <div className="p-4 bg-amber-400/10 border border-amber-400/30 rounded-xl text-sm">
            <p className="font-semibold text-amber-200 mb-1">Advisor isn’t configured yet</p>
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
        {/* Scroll to bottom button */}
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
              onClick={() => { setAtBottom(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
              aria-label="Scroll to latest message"
              className="fixed bottom-36 md:bottom-24 right-4 z-10 w-9 h-9 bg-white/15 backdrop-blur-md border border-white/10 shadow-lg rounded-full flex items-center justify-center text-white/70 hover:text-emerald-300 hover:border-emerald-400/50 transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className={`max-w-3xl mx-auto px-4 py-6 ${isEmpty ? 'min-h-full flex flex-col justify-end' : ''}`}>

          {isEmpty && !noKey && (
            <WelcomeScreen
              hasData={hasData}
              onSuggest={send}
              analyzing={analyzing}
              onBuildPlan={handleBuildPlan}
              building={buildingPlan}
            />
          )}

          <AnimatePresence>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          </AnimatePresence>

          {/* Typing dots only until the first streamed token arrives */}
          {(loading || analyzing) && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}

          {/* Proposed action plan card */}
          {pendingPlan && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <PlanCard plan={pendingPlan} variant="chat" saved={pendingPlan.saved}
                onSave={handleSavePlan} onApply={applyPlanStep} />
            </motion.div>
          )}
          {buildingPlan && (
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-200/80">
              <Loader2 className="w-4 h-4 animate-spin" /> Building your action plan…
            </div>
          )}

          {/* Inline how-to guide — saveable as a Plan checklist with links */}
          {pendingGuide && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GuideCard guide={pendingGuide} saved={pendingGuide.saved}
                onSave={handleSaveGuide} onDismiss={() => setPendingGuide(null)} />
            </motion.div>
          )}

          {/* Inline goal suggestion — adds to Goals + appears in the Plan */}
          {pendingGoal && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <GoalSuggestionCard suggestion={pendingGoal}
                onAdd={(g) => addGoal(user.id, g)}
                onDismiss={() => setPendingGoal(null)} />
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3">
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 inline-block px-3 py-2 rounded-lg">{error}</p>
            </motion.div>
          )}

          {/* Mid-conversation suggestion chips — horizontal scroll on mobile */}
          {messages.length > 0 && !loading && !analyzing && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:flex-wrap md:overflow-x-visible md:-mx-0 md:px-0 mt-2 mb-2">
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => send(s.label)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white/10 border border-white/[0.11] rounded-full text-xs text-white/60 hover:border-emerald-400/50 hover:text-white transition-all">
                  <s.icon className="w-3 h-3 text-emerald-300/80" /> {s.label}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — docked to the bottom of the shell. The transparent clearance
          below leaves room for the floating mobile nav; while the field is
          focused the nav hides (Layout), so we collapse the clearance too — the
          box sits flush above the keyboard with no dead gap. */}
      <div className={`flex-shrink-0 transition-[padding] duration-200 ${inputFocused ? 'pb-0' : 'pb-[76px]'} md:pb-0`}>
        <div className="border-t border-white/10 bg-white/5 backdrop-blur-md">
        <form onSubmit={e => { e.preventDefault(); send(input) }} className="max-w-3xl mx-auto px-4 py-3 md:py-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-white/10 border border-white/[0.11] rounded-2xl px-4 py-3 focus-within:border-emerald-400/50 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder={noKey ? 'Advisor not configured yet…' : 'Ask anything about your finances…'}
                disabled={noKey || loading || analyzing}
                rows={1}
                className="w-full bg-transparent text-base md:text-sm text-white placeholder-white/35 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                style={{ maxHeight: 120, overflowY: 'auto' }}
              />
            </div>
            <button type="submit" disabled={!input.trim() || loading || analyzing || noKey}
              aria-label="Send message"
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
