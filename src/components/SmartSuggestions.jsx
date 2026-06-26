import { Shield, CreditCard, Building2, TrendingUp, PiggyBank, HeartPulse, Target, Sparkles, AlertTriangle, ArrowRight, Plus } from 'lucide-react'

// A smart, situation-aware engine: looks at the user's money, profile, goals and
// existing steps, and surfaces the most relevant next questions — each one tap
// from becoming a task, a goal, or an advisor conversation. This is what makes
// the Plan a *smart* financial task list, not just a static checklist.
function buildSuggestions({ money, profile, goals, debts, plans = [] }) {
  const income   = Number(money.income) || 0
  const expenses = Number(money.expenses) || 0
  const surplus  = income - expenses
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const p = profile || {}

  const all = []
  // Already covered by an existing goal OR a plan step? Don't prompt again.
  const corpus = [
    ...goals.map(g => g.name || ''),
    ...plans.flatMap(pl => pl.steps.map(s => s.text || '')),
  ].join(' ').toLowerCase()
  const has = (...kws) => kws.some(kw => corpus.includes(kw))

  // 1) Deficit — the #1 fire to put out.
  if (income > 0 && surplus < 0) all.push({
    id: 'deficit', urgent: true, icon: AlertTriangle,
    q: "You're spending more than you earn. Want help fixing it?",
    sub: `That's -$${Math.abs(surplus).toLocaleString()}/mo. Let's find what to trim.`,
    cta: 'Ask advisor', action: { kind: 'ask', q: 'I am spending more than I earn each month. Help me figure out what to cut.' },
  })

  // 2) No health insurance — crisis-level gap.
  if (p.health_insurance === 'none') all.push({
    id: 'insurance', urgent: true, icon: HeartPulse,
    q: "You don't have health insurance — should we fix that first?",
    sub: 'One medical emergency can wipe out years of savings.',
    cta: 'Ask advisor', action: { kind: 'ask', q: 'I don\'t have health insurance. What are my options and what should I do?' },
  })

  // 3) Starter emergency fund.
  if (!has('emergency')) all.push({
    id: 'efund', icon: Shield,
    q: 'Do you have a starter emergency fund?',
    sub: `Aim for $${Math.max(1000, Math.round(expenses * 3)).toLocaleString()} — 3 months of expenses.`,
    cta: 'Start the goal',
    action: { kind: 'goal', preset: { name: 'Emergency fund', goal_type: 'savings',
      target_amount: Math.max(1000, Math.round(expenses * 3) || 3000),
      monthly_contribution: Math.max(50, Math.round(surplus > 0 ? surplus * 0.4 : 100)) } },
  })

  // 4) High-interest / any debt without a payoff plan.
  if (totalDebt > 0 && !has('debt', 'payoff', 'pay off')) all.push({
    id: 'debt', icon: CreditCard,
    q: 'Want a plan to clear your debt faster?',
    sub: `$${totalDebt.toLocaleString()} tracked. I'll order it the smart way.`,
    cta: 'Ask advisor', action: { kind: 'ask', q: 'Build me a step-by-step plan to pay off my debt as fast as possible.' },
  })

  // 5) Full 401(k) match — free money.
  if (p.employer_401k === 'match' && !has('401', 'match')) all.push({
    id: 'match', icon: Building2,
    q: 'Are you getting your full 401(k) match?',
    sub: "It's free money — usually a 50–100% instant return.",
    cta: 'Add task', action: { kind: 'task', text: 'Contribute enough to my 401(k) to capture the full employer match' },
  })

  // 6) Roth IRA / start investing.
  const investingNothing = Array.isArray(p.investment_types) && (p.investment_types.includes('none') || p.investment_types.length === 0)
  if ((investingNothing || !Array.isArray(p.investment_types)) && !has('roth', 'ira')) all.push({
    id: 'roth', icon: TrendingUp,
    q: 'Investing for retirement yet?',
    sub: 'A Roth IRA is the best tool for most young adults. I can walk you through it.',
    cta: 'Show me how', action: { kind: 'ask', q: 'Walk me through opening a Roth IRA, step by step.' },
  })

  // 7) Automate the surplus.
  if (surplus > 100 && !has('automat', 'auto-transfer', 'transfer to savings')) all.push({
    id: 'automate', icon: PiggyBank,
    q: `You've got $${surplus.toLocaleString()}/mo spare — automate it?`,
    sub: 'Pay yourself first: a transfer that fires on payday before you can spend it.',
    cta: 'Add task', action: { kind: 'task', text: `Set up an automatic $${Math.round(surplus * 0.5).toLocaleString()}/mo transfer to savings on payday` },
  })

  // 8) No goals at all.
  if (goals.length === 0) all.push({
    id: 'firstgoal', icon: Target,
    q: 'What are you saving toward?',
    sub: 'A trip, a house, a cushion — set one and plant a tree.',
    cta: 'Set a goal', action: { kind: 'goal' },
  })

  // Keep urgent ones first, then top 3 overall.
  return all.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)).slice(0, 3)
}

export default function SmartSuggestions({ money, profile, goals, debts, plans = [], onAddTask, onAddGoal, onAsk }) {
  const suggestions = buildSuggestions({ money, profile, goals, debts, plans })
  if (suggestions.length === 0) return null

  const run = (action) => {
    if (action.kind === 'task') onAddTask(action.text)
    else if (action.kind === 'goal') onAddGoal(action.preset)
    else if (action.kind === 'ask') onAsk(action.q)
  }

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-emerald-300" /> Smart next steps
      </h2>
      <div className="space-y-2">
        {suggestions.map(s => {
          const Icon = s.icon
          return (
            <div key={s.id}
              className={`rounded-xl border p-3 ${s.urgent
                ? 'bg-amber-400/[0.08] border-amber-400/25'
                : 'bg-white/[0.075] border-white/[0.11]'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.urgent ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white leading-snug">{s.q}</p>
                  {s.sub && <p className="text-xs text-white/50 mt-0.5 leading-snug">{s.sub}</p>}
                  <button onClick={() => run(s.action)}
                    className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${s.urgent
                      ? 'bg-amber-500/90 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                    {s.action.kind === 'task' ? <Plus className="w-3.5 h-3.5" /> : s.action.kind === 'ask' ? <ArrowRight className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                    {s.cta}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
