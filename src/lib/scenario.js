// The scenario spine: one deterministic engine that names the user's current
// financial chapter from their real records. It is a PRESENTATION layer over
// financialPriorities — it never re-decides what matters, it gives the top
// priority a name, evidence, and first moves so onboarding, Home, and the
// Advisor all tell the same story about the same situation.

import { computeSnapshot, THRESHOLDS } from './finance.js'

const num = value => Number(value) || 0
const money = value => `$${Math.max(0, Math.round(num(value))).toLocaleString()}`

// Every chapter reads the snapshot it was derived from, so evidence and moves
// always carry the user's own numbers — never generic advice.
const CHAPTERS = {
  deficit: {
    chapter: 'Stabilize',
    horizon: 'this week',
    title: () => 'Close the monthly gap',
    because: snapshot => [
      `Typical spending runs ${money(Math.abs(snapshot.cashFlowMargin))}/mo above income.`,
      'Nothing else compounds until more comes in than goes out.',
    ],
    firstMoves: snapshot => [
      `Trim ${money(Math.abs(snapshot.cashFlowMargin))}/mo from the Monthly Plan — start with the largest flexible category.`,
      'Check the plan weekly until the gap reads $0 or better.',
    ],
  },
  overcommitted: {
    chapter: 'Rebalance',
    horizon: 'this week',
    title: () => 'Right-size planned allocations',
    because: snapshot => [
      `Future allocations exceed available cash by ${money(Math.abs(snapshot.unallocated))}/mo.`,
      'An overcommitted plan quietly fails; a realistic one compounds.',
    ],
    firstMoves: snapshot => [
      `Reduce planned allocations by ${money(Math.abs(snapshot.unallocated))}/mo so the plan matches real cash flow.`,
      'Keep the trimmed amounts on a list to restore as income grows.',
    ],
  },
  insurance: {
    chapter: 'Protect',
    horizon: 'this week',
    title: () => 'Get covered before anything else',
    because: () => [
      'No health coverage is on file.',
      'One uncovered emergency can undo years of progress in a day.',
    ],
    firstMoves: () => [
      'Compare marketplace plans (or your employer window) and pick one this week.',
      'Record the premium in the Monthly Plan so the budget stays honest.',
    ],
  },
  starter_ef: {
    chapter: 'Foothold',
    horizon: 'this month',
    title: () => `Bank your first ${money(THRESHOLDS.starterEmergency)}`,
    because: snapshot => [
      `Liquid cash is ${money(snapshot.liquid)} — below the ${money(THRESHOLDS.starterEmergency)} starter reserve.`,
      'A small buffer keeps everyday surprises from becoming debt.',
    ],
    firstMoves: snapshot => {
      const gap = Math.max(0, THRESHOLDS.starterEmergency - Math.round(num(snapshot.liquid)))
      const pace = snapshot.cashFlowMargin > 0 ? Math.min(gap, Math.round(snapshot.cashFlowMargin)) : 0
      return [
        pace > 0
          ? `Move ${money(pace)} to savings this month — the surplus supports it.`
          : `Set aside what you can toward the ${money(gap)} still needed.`,
        'Keep it in a separate savings account so it stays untouched.',
      ]
    },
  },
  capture_match: {
    chapter: 'Free money',
    horizon: 'this month',
    title: priority => `Capture the full match in ${priority.account?.name || 'your workplace plan'}`,
    because: (snapshot, priority) => [
      `You contribute ${num(priority.account?.contribution_percent)}% — the match applies up to ${num(priority.account?.employer_match_limit_percent)}%.`,
      'Matched dollars are an instant, guaranteed return.',
    ],
    firstMoves: (snapshot, priority) => [
      `Raise the contribution to ${num(priority.account?.employer_match_limit_percent)}% in your plan portal.`,
      'Confirm the change on your next paystub.',
    ],
  },
  kill_debt: {
    chapter: 'Extinguish',
    horizon: 'this month',
    title: priority => `Pay down ${priority.debt?.name || 'the highest-rate debt'}`,
    because: snapshot => {
      const worst = snapshot.avalanche?.[0]
      return [
        worst ? `${worst.name} costs about ${money(worst.monthlyInterest)}/mo in interest at ${worst.apr}% APR.` : 'High-interest debt is the most expensive thing in the picture.',
        snapshot.cashFlowMargin > 0 ? `Your ${money(snapshot.cashFlowMargin)}/mo surplus is a guaranteed-return weapon against it.` : 'Every extra dollar sent is a guaranteed return at that rate.',
      ]
    },
    firstMoves: (snapshot, priority) => [
      snapshot.cashFlowMargin > 0
        ? `Send the ${money(snapshot.cashFlowMargin)}/mo surplus toward ${priority.debt?.name || 'this debt'} on top of the minimum.`
        : `Pay above the minimum on ${priority.debt?.name || 'this debt'} whenever cash allows.`,
      'Keep every other debt on autopay minimums so nothing slips.',
    ],
  },
  build_ef: {
    chapter: 'Cushion',
    horizon: 'this quarter',
    title: () => 'Grow the emergency reserve',
    because: snapshot => [
      `${snapshot.efMonths.toFixed(1)} of ${snapshot.efTargetMonths} months of expenses are covered (${money(snapshot.efTargetAmount)} target).`,
    ],
    firstMoves: snapshot => [
      snapshot.cashFlowMargin > 0
        ? `Automate ${money(Math.min(snapshot.cashFlowMargin, 1000))}/mo into savings the day after payday.`
        : 'Set an automatic transfer sized to whatever the month allows.',
      'Park the reserve in a high-yield savings account so it earns while it waits.',
    ],
  },
  goal: {
    chapter: 'Momentum',
    horizon: 'this quarter',
    title: priority => `Move ${priority.goal?.name || 'your goal'} forward`,
    because: (snapshot, priority) => [
      `${money(Math.max(0, num(priority.goal?.target_amount) - num(priority.goal?.current_amount)))} remains toward ${priority.goal?.name || 'the goal'}.`,
    ],
    firstMoves: (snapshot, priority) => [
      num(priority.goal?.monthly_contribution) > 0
        ? `Keep the ${money(priority.goal.monthly_contribution)}/mo contribution moving on schedule.`
        : 'Set a monthly contribution so the target has a date.',
      'Log progress weekly so the projection stays honest.',
    ],
  },
  roth: {
    chapter: 'Launch',
    horizon: 'this month',
    title: () => 'Start tax-advantaged investing',
    because: snapshot => [
      'No investment account is on file yet.',
      snapshot.profile?.age ? `At ${snapshot.profile.age}, every year of compounding is worth more than the last.` : 'Early years of compounding are worth the most.',
    ],
    firstMoves: () => [
      'Open a Roth IRA at a no-fee brokerage — it takes about 10 minutes.',
      'Start with any amount; consistency beats size at the start.',
    ],
  },
  invest: {
    chapter: 'Compound',
    horizon: 'this quarter',
    title: priority => `Raise investing in ${priority.account?.name || 'your investment account'}`,
    because: snapshot => [
      'Core protections are in place — surplus can now work long-term.',
      snapshot.unallocated > 0 ? `${money(snapshot.unallocated)}/mo is available to assign.` : null,
    ],
    firstMoves: snapshot => [
      snapshot.unallocated > 0
        ? `Direct ${money(Math.min(snapshot.unallocated, 1000))}/mo into the account automatically.`
        : 'Review the contribution rate and raise it when cash flow allows.',
      'Rebalance quarterly, not daily.',
    ],
  },
  assign_cash: {
    chapter: 'Deploy',
    horizon: 'this month',
    title: () => 'Give idle cash a job',
    because: snapshot => [
      `${money(snapshot.unallocated)}/mo is earned but unassigned.`,
      'Unassigned surplus tends to drift into spending.',
    ],
    firstMoves: snapshot => [
      `Assign the ${money(snapshot.unallocated)}/mo to your top goal or account in the Monthly Plan.`,
    ],
  },
  grow: {
    chapter: 'Cruise',
    horizon: 'this quarter',
    title: () => 'Keep the machine tuned',
    because: () => [
      'No urgent gap in the current numbers — the plan is balanced.',
    ],
    firstMoves: () => [
      'Refresh balances quarterly so recommendations stay grounded.',
      'Revisit goals when life changes, not when markets do.',
    ],
  },
  organize: {
    chapter: 'Map it out',
    horizon: 'this week',
    title: () => 'Get the full picture down',
    because: () => [
      'The picture is incomplete — income, spending, or balances are missing.',
    ],
    firstMoves: () => [
      'Add your real income, spending, accounts, and debts.',
      'Every number you add sharpens every recommendation.',
    ],
  },
}

// Name the chapter for a computed snapshot. The top financialPriorities entry
// decides the id; this only adds narrative. Falls back to `organize` when
// there is no data to reason from.
export function deriveScenario(snapshot) {
  const hasData = num(snapshot?.income) > 0 || num(snapshot?.expenses) > 0
    || num(snapshot?.assets) > 0 || num(snapshot?.totalDebt) > 0
    || (snapshot?.goals || []).length > 0
  const priority = hasData ? snapshot.next : null
  const id = priority && CHAPTERS[priority.key] ? priority.key : 'organize'
  const def = CHAPTERS[id]
  return {
    id,
    chapter: def.chapter,
    horizon: def.horizon,
    title: typeof def.title === 'function' ? def.title(priority || snapshot) : def.title,
    because: (def.because(snapshot || {}, priority) || []).filter(Boolean).slice(0, 3),
    firstMoves: (def.firstMoves(snapshot || {}, priority) || []).filter(Boolean).slice(0, 3),
  }
}

// The onboarding finale runs before any accounts exist — build a snapshot from
// the quiz answers alone so the very first thing the user sees after the last
// question is their own situation, named, in their own numbers.
//
// Quiz-stage rules differ deliberately from the live ladder: balances are not
// entered yet, so liquid-cash priorities (starter reserve, cushion) would fire
// for everyone and drown the real story — they are skipped. A claimed employer
// match and listed debts get synthetic chapters instead, because at this stage
// the quiz answer IS the best evidence available.
export function scenarioFromAnswers(answers = {}) {
  const debts = (answers.debts || [])
    .filter(debt => debt?.name?.trim() && num(debt.balance) > 0)
    .map((debt, index) => ({
      id: `onboarding-${index}`,
      name: debt.name.trim(),
      balance: num(debt.balance),
      interest_rate: debt.interest_rate ?? null,
    }))
  const snapshot = computeSnapshot({
    profile: {
      age: num(answers.age) || null,
      employment_type: answers.employment_type,
      employer_401k: answers.employer_401k,
      investment_types: answers.investment_types || [],
      health_insurance: answers.health_insurance,
      primary_goal: answers.primary_goal,
      monthly_income: num(answers.monthly_income),
      monthly_expenses: num(answers.monthly_expenses),
    },
    accounts: [],
    debts,
    goals: [],
  })
  // Walk the quiz-safe ladder (not just the top priority) so the right chapter
  // is found even when a balance-dependent one would have ranked first.
  const byKey = new Map(quizLadder(snapshot).map(priority => [priority.key, priority]))

  const scenarioFor = (id, priority) => {
    const def = CHAPTERS[id]
    return {
      id,
      chapter: def.chapter,
      horizon: def.horizon,
      title: typeof def.title === 'function' ? def.title(priority || snapshot) : def.title,
      because: (def.because(snapshot, priority) || []).filter(Boolean).slice(0, 3),
      firstMoves: (def.firstMoves(snapshot, priority) || []).filter(Boolean).slice(0, 3),
    }
  }

  if (byKey.has('deficit')) return scenarioFor('deficit', byKey.get('deficit'))
  if (byKey.has('overcommitted')) return scenarioFor('overcommitted', byKey.get('overcommitted'))
  if (byKey.has('insurance')) return scenarioFor('insurance', byKey.get('insurance'))
  if (answers.employer_401k === 'match') return quizMatchScenario(true)
  if (byKey.has('kill_debt')) return scenarioFor('kill_debt', byKey.get('kill_debt'))
  if (debts.length) return quizDebtScenario(debts)
  if (answers.employer_401k === 'unsure') return quizMatchScenario(false)
  if (byKey.has('roth')) return scenarioFor('roth', byKey.get('roth'))
  if (snapshot.income > 0 && snapshot.cashFlowMargin > 0) {
    return {
      id: 'foothold_quiz',
      chapter: 'Foothold',
      horizon: 'this month',
      title: `Put your ${money(snapshot.cashFlowMargin)}/mo surplus to work`,
      because: [
        `Income exceeds spending by about ${money(snapshot.cashFlowMargin)}/mo.`,
        'Where it goes first depends on the balances you add next.',
      ],
      firstMoves: [
        'Add your real account balances so the surplus gets a precise job.',
        `Until then, hold ${money(snapshot.cashFlowMargin)}/mo aside instead of letting it drift.`,
      ],
    }
  }
  return scenarioFor('organize', null)
}

function quizLadder(snapshot) {
  const safe = new Set(['deficit', 'overcommitted', 'insurance', 'kill_debt', 'roth'])
  const ladder = []
  if (snapshot.income > 0 && snapshot.cashFlowMargin < 0) ladder.push(snapshot.next)
  // financialPriorities already ordered these; re-derive the ones we trust at
  // quiz stage by reading the snapshot directly.
  if (snapshot.profile?.health_insurance === 'none') {
    ladder.push({ key: 'insurance' })
  }
  const worst = snapshot.avalanche?.[0]
  if (worst && worst.apr > THRESHOLDS.highApr) {
    ladder.push({ key: 'kill_debt', debt: (snapshot.debts || []).find(item => item.name === worst.name) ?? null })
  }
  const investing = (snapshot.profile?.investment_types || []).some(type => type !== 'none')
  if (!investing) ladder.push({ key: 'roth' })
  return ladder.filter(priority => priority && safe.has(priority.key))
}

function quizMatchScenario(confirmed) {
  return {
    id: 'capture_match_quiz',
    chapter: 'Free money',
    horizon: confirmed ? 'this month' : 'this week',
    title: confirmed ? 'Capture your full employer match' : 'Find out if your employer matches',
    because: confirmed
      ? ['You said your employer matches 401(k) contributions.', 'Matched dollars are an instant, guaranteed return — the best deal in personal finance.']
      : ["You're not sure whether your employer matches contributions.", 'If a match exists, it outranks nearly everything else.'],
    firstMoves: confirmed
      ? ['Check your contribution rate against the match limit on your next paystub.', 'Add the 401(k) account here so the app can track the match.']
      : ['Ask HR or check the benefits portal — it takes 20 minutes.', 'Record the answer here so your plan can build on it.'],
  }
}

function quizDebtScenario(debts) {
  const total = debts.reduce((sum, debt) => sum + num(debt.balance), 0)
  return {
    id: 'debts_quiz',
    chapter: 'Extinguish',
    horizon: 'this week',
    title: 'Get the debt picture exact',
    because: [
      `You listed ${debts.length} ${debts.length === 1 ? 'debt' : 'debts'} totaling ${money(total)}.`,
      'The payoff order depends on each APR — one missing rate can hide the most expensive debt.',
    ],
    firstMoves: [
      'Add the APR and minimum payment for each debt.',
      'The app will then sequence the payoff for the fastest, cheapest route out.',
    ],
  }
}
