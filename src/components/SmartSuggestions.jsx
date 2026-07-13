import { Shield, CreditCard, Building2, TrendingUp, PiggyBank, HeartPulse, Target, AlertTriangle } from 'lucide-react'
import { computeSnapshot, THRESHOLDS } from '@/lib/finance'
import { suggestionAlreadyInPlan } from '@/lib/stepEffects'

// The situation-aware suggestion ENGINE, driven by the shared finance snapshot —
// the same numbers the advisor reads, so suggestions and advice always agree.
// The engine can know many things; the Plan page whispers exactly ONE of them
// (see SuggestionRow in PlanSteps.jsx) — ranked list returned here, presentation
// decided by the caller.
export function buildSuggestions({ profile, goals, debts, accounts = [], plans = [] }) {
  const s = computeSnapshot({ profile, accounts, debts, goals })
  const { income, expenses, surplus } = s
  const p = profile || {}

  const all = []
  // Already covered by an existing goal OR a plan step? Don't prompt again.
  const corpus = [
    ...goals.map(g => g.name || ''),
    ...plans.flatMap(pl => pl.steps.map(st => st.text || '')),
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

  // 3) Emergency fund — personalized target (6 months for variable income).
  if (!has('emergency') && expenses > 0 && s.efMonths < s.efTargetMonths) all.push({
    id: 'efund', icon: Shield,
    q: s.liquid < THRESHOLDS.starterEmergency
      ? 'Do you have a starter emergency fund?'
      : `Your cushion covers ${s.efMonths.toFixed(1)} months — grow it to ${s.efTargetMonths}?`,
    sub: `Aim for $${s.efTargetAmount.toLocaleString()} — ${s.efTargetMonths} months of expenses${s.efTargetMonths === 6 ? ' (your income varies)' : ''}.`,
    cta: 'Start the goal',
    action: { kind: 'goal', preset: { name: 'Emergency fund', goal_type: 'savings',
      target_amount: Math.max(THRESHOLDS.starterEmergency, s.efTargetAmount || 3000),
      current_amount_hint: s.liquid,
      monthly_contribution: Math.max(50, Math.round(surplus > 0 ? surplus * 0.4 : 100)) } },
  })

  // 4) Debt — name the worst offender with its real monthly interest cost.
  const worst = s.avalanche[0]
  if (worst && !has('debt', 'payoff', 'pay off', worst.name.toLowerCase())) all.push({
    id: 'debt', icon: CreditCard,
    urgent: worst.apr >= THRESHOLDS.crisisApr,
    q: worst.apr > THRESHOLDS.highApr
      ? `${worst.name} at ${worst.apr}% APR is your costliest debt.`
      : 'Want a plan to clear your debt faster?',
    sub: worst.apr > 0
      ? `It costs you ~$${Math.round(worst.monthlyInterest).toLocaleString()}/mo in interest${s.debtFree && !s.debtFree.stuck ? ` — your surplus could make you debt-free by ${s.debtFree.debtFreeLabel}` : ''}.`
      : `$${s.totalDebt.toLocaleString()} tracked. I'll order it the smart way.`,
    cta: 'Ask advisor', action: { kind: 'ask', q: 'Build me a step-by-step plan to pay off my debt as fast as possible, highest interest rate first.' },
  })

  // 5) Full 401(k) match — free money.
  if (p.employer_401k === 'match' && !has('401', 'match')) all.push({
    id: 'match', icon: Building2,
    q: 'Are you getting your full 401(k) match?',
    sub: "It's free money — usually a 50–100% instant return.",
    cta: 'Add task', action: { kind: 'task', text: 'Contribute enough to my 401(k) to capture the full employer match' },
  })

  // 6) Roth IRA / start investing — lands as a plan step; tapping into it
  // reveals the decisive in-place how-to (no advisor detour for a known move).
  const investingNothing = Array.isArray(p.investment_types) && (p.investment_types.includes('none') || p.investment_types.length === 0)
  if ((investingNothing || !Array.isArray(p.investment_types)) && !has('roth', 'ira')) all.push({
    id: 'roth', icon: TrendingUp,
    q: 'Investing for retirement yet?',
    sub: 'A Roth IRA is the best tool for most young adults.',
    cta: 'Add the step', action: { kind: 'task', text: `Open a Roth IRA and set up an automatic monthly contribution${surplus > 50 ? ` of $${Math.min(625, Math.max(50, Math.round(surplus * 0.25 / 25) * 25)).toLocaleString()}` : ''}` },
  })

  // 7) Automate the surplus.
  if (surplus > THRESHOLDS.autoTransferMin && !has('automat', 'auto-transfer', 'transfer to savings')) all.push({
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

  // The engine's next-dollar priority floats to the front; urgent first overall.
  const rank = (x) => (x.urgent ? 2 : 0) + (s.next.key.startsWith(x.id) || x.id.startsWith(s.next.key.split('_')[0]) ? 1 : 0)
  return all
    .filter(suggestion => !suggestionAlreadyInPlan(suggestion, plans))
    .sort((a, b) => rank(b) - rank(a))
}
