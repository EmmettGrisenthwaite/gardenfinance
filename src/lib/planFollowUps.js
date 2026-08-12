const num = value => Number(value) || 0
const known = value => value !== null && value !== undefined && value !== ''
const money = value => `$${Math.max(0, Math.round(num(value))).toLocaleString()}`

// Every follow-up ends with this so the advisor stays in planner mode: one
// question at a time, and it says what the answer would change before asking
// the next. Without it the model answers and then dumps five more questions.
const ADVISOR_MODE = 'Answer as my planner: tell me what my answer changes about the plan, then ask me the next most useful question — one at a time.'

const followUp = (id, { topic, label, question, why, ask }) => ({
  id, topic, label, question, why,
  prompt: `${ask || question}\n\n${ADVISOR_MODE}`,
})

const plural = n => (n === 1 ? 'a month' : `${n} months`)

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44

/**
 * When a goal is due, and when this plan actually reaches it.
 *
 * `readyInMonths` reuses the schedule the route already computed: a goal funded
 * now finishes in its own etaMonths, one still queued finishes after everything
 * ahead of it. Returns nulls rather than guesses when either side is unknown,
 * so a missing deadline can never invent a deadline problem.
 */
function goalTiming(goal, route, now) {
  const key = `goal.${goal.id || goal.name}`
  const entry = (route.allocations || []).find(item => item.key === key && num(item.amount) > 0)
    || (route.upcoming || []).find(item => item.key === key)
  if (!entry) return { dueInMonths: null, readyInMonths: null }

  const due = goal.deadline ? new Date(goal.deadline) : null
  const dueInMonths = due && !Number.isNaN(due.getTime())
    ? Math.max(0, Math.round((due.getTime() - now) / MS_PER_MONTH))
    : null

  const eta = num(entry.etaMonths)
  const readyInMonths = eta > 0 ? num(entry.startsInMonths) + eta : null
  return { dueInMonths, readyInMonths }
}

/**
 * The questions a planner asks *after* seeing this particular plan.
 *
 * Deliberately not the same thing as `route.refinements`. Those are missing
 * records the app can go and collect — an APR, a balance. These are the
 * judgement calls no column can hold: whether the income is steady, what is
 * coming in six months, who else depends on the money. A plan built only from
 * stored numbers is confident about arithmetic and silent about the life it
 * belongs to, and this is the list that closes that gap.
 *
 * Every entry is gated on something true about this user, so nobody is asked
 * about an employer match they do not have. Order is by how much the answer
 * would move the plan.
 */
export function planFollowUps({ route, profile, debts = [], goals = [], now = Date.now() } = {}) {
  if (!route?.ready) return []

  const list = []
  const activeGoals = goals.filter(goal => num(goal.target_amount) > num(goal.current_amount))
  const funded = (route.allocations || []).filter(item => num(item.amount) > 0)
  const fundedKey = predicate => funded.some(item => predicate(item.key))
  const reserveFunded = fundedKey(key => key === 'starter_emergency' || key === 'full_emergency')
  const investingFunded = fundedKey(key => key.startsWith('investment.')
    || key === 'open_investment_account' || key === 'open_taxable_brokerage')
  const debtFunded = fundedKey(key => key.startsWith('debt.'))
  const liveDebts = debts.filter(debt => num(debt.balance) > 0)

  // A 0% promo ending is the single largest swing available: a balance that
  // looks harmless today becomes the most expensive thing here overnight.
  const promo = liveDebts.find(debt => known(debt.interest_rate) && num(debt.interest_rate) === 0)
  if (promo) {
    list.push(followUp('debt_promo', {
      topic: 'debt',
      label: `Is ${promo.name} on a 0% deal?`,
      question: `${promo.name} shows 0% — is that an intro rate, and when does it end?`,
      why: 'If it ends soon, it jumps ahead of everything else on this list.',
      ask: `My ${promo.name} balance of ${money(promo.balance)} is recorded at 0%. If that is a promotional rate that expires, how should my plan change before it does?`,
    }))
  }

  // The only guaranteed return in the whole ladder.
  if (profile?.employer_401k === 'match') {
    list.push(followUp('match_details', {
      topic: 'retirement',
      label: 'My employer match',
      question: 'What percent does your employer match, and what are you putting in right now?',
      why: 'A match is the one guaranteed return in this plan — it beats paying down debt.',
      ask: 'My employer offers a retirement match. Help me work out exactly what I need to contribute to capture all of it, and where that should sit in my plan.',
    }))
  }

  // Everything downstream assumes the surplus repeats. For irregular earners
  // that assumption is the plan's weakest joint.
  const irregular = ['freelance', 'student', 'other'].includes(profile?.employment_type)
  const spare = num(route.availableMonthlyAmount)
  if (spare > 0) {
    list.push(followUp('income_stability', {
      topic: 'income',
      label: 'My income moves around',
      question: `This plan moves ${money(spare)} a month. Is that the same every month, or does it swing?`,
      why: irregular
        ? 'Your work type usually means uneven months, and that changes how big the cushion should be first.'
        : 'If it swings, the cushion should be bigger before anything else starts.',
      ask: `My plan assumes ${money(spare)} spare every month. My income is not perfectly steady — how should the plan change to survive a lean month?`,
    }))
  } else {
    // "This plan moves $0 a month. Does it swing?" is a question about nothing.
    // Breaking even needs a different one — whether this month is the pattern.
    list.push(followUp('break_even', {
      topic: 'income',
      label: 'Why nothing is left over',
      question: 'Your income and spending are level right now. Is that every month, or was this one unusual?',
      why: 'A one-off month and a permanent squeeze need completely different plans.',
      ask: 'My spending currently matches my income exactly, so I have nothing left to save. Help me work out where the most realistic cut is, one category at a time.',
    }))
  }

  // A cushion sized by a formula, not by what is actually likely to go wrong.
  if (reserveFunded) {
    list.push(followUp('likely_shock', {
      topic: 'risk',
      label: 'What might go wrong',
      question: 'What is the most likely surprise cost in your life right now — car, health, pet, a flight home?',
      why: 'The cushion should be sized to the thing most likely to happen to you, not to an average.',
      ask: 'Help me size my emergency fund to what could actually go wrong in my life, rather than a generic number of months.',
    }))
  }

  if (profile?.health_insurance && profile.health_insurance !== 'none' && reserveFunded) {
    list.push(followUp('deductible', {
      topic: 'risk',
      label: 'My insurance deductible',
      question: 'If you used your health insurance tomorrow, what would you pay before it covers anything?',
      why: 'Your first cushion should at least cover that number.',
      ask: 'What should my starter emergency fund be if I want it to cover my health insurance deductible? Ask me what my deductible is if you need it.',
    }))
  }

  // Investing money you need soon is the mistake this plan could quietly cause.
  if (investingFunded) {
    list.push(followUp('investing_horizon', {
      topic: 'investing',
      label: 'When I need this money',
      question: 'Is this money for decades away, or might you need some of it in the next five years?',
      why: 'Anything you need within five years should not be invested at all.',
      ask: 'My plan sends money to investments every month. Help me work out how much of it I might need within five years, and where that portion should go instead.',
    }))
  }

  // Cutting a rate does the same work as finding extra money.
  const expensive = liveDebts
    .filter(debt => known(debt.interest_rate) && num(debt.interest_rate) > 7)
    .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))[0]
  if (expensive && debtFunded) {
    list.push(followUp('rate_reduction', {
      topic: 'debt',
      label: 'Can I cut this rate?',
      question: `Have you asked about a lower rate on ${expensive.name}, or looked at moving the balance?`,
      why: `Dropping ${num(expensive.interest_rate)}% does the same work as paying extra, without finding extra money.`,
      ask: `I owe ${money(expensive.balance)} on ${expensive.name} at ${num(expensive.interest_rate)}%. What are my realistic options for lowering that rate, and how would each change my plan?`,
    }))
  }

  // A dated goal the ladder will not reach in time is the most useful thing the
  // app can notice, and the one it stayed silent about: rent due in four months,
  // queued behind the emergency fund, arriving in seven. The ordering is right
  // in general and wrong when a real deadline is attached, which is a judgement
  // call the user has to make — so it is asked, not silently overridden.
  const late = activeGoals
    .map(goal => ({ goal, ...goalTiming(goal, route, now) }))
    .filter(item => item.dueInMonths !== null && item.readyInMonths !== null
      && item.readyInMonths > item.dueInMonths)
    .sort((left, right) => left.dueInMonths - right.dueInMonths)[0]

  if (late) {
    const { goal, dueInMonths, readyInMonths } = late
    const short = money(num(goal.target_amount) - num(goal.current_amount))
    list.push(followUp('goal_at_risk', {
      topic: 'goal',
      label: `${goal.name} may be late`,
      question: `${goal.name} is due in about ${plural(dueInMonths)}, but this plan reaches it in about ${plural(readyInMonths)}. Should it jump the queue?`,
      why: 'The order above is right when nothing has a deadline. A real due date can outrank a cushion — you know which one hurts more to miss.',
      ask: `I need ${short} for ${goal.name} in about ${plural(dueInMonths)}, but my plan funds other things first and gets there in about ${plural(readyInMonths)}. Walk me through whether to move it up the order, and what that costs me.`,
    }))
  }

  const undatedGoal = activeGoals.find(goal => !goal.deadline)
  if (undatedGoal) {
    list.push(followUp('goal_deadline', {
      topic: 'goal',
      label: `When do I need ${undatedGoal.name}?`,
      question: `When do you want ${undatedGoal.name} done by?`,
      why: 'A date turns it into a monthly number instead of a someday.',
      ask: `I am saving for ${undatedGoal.name} (${money(undatedGoal.target_amount)}) with no deadline. Help me pick a realistic date and tell me what it costs me per month.`,
    }))
  }

  if (liveDebts.length) {
    list.push(followUp('minimums_safe', {
      topic: 'debt',
      label: 'Am I safe on minimums?',
      question: 'Are you comfortably making every minimum payment right now?',
      why: 'One missed minimum costs more in fees and credit damage than this plan earns in months.',
      ask: 'Check whether my plan leaves me enough to cover every debt minimum comfortably, and tell me what to change if it is tight.',
    }))
  }

  // Only worth asking of someone who has named nothing. Asking "is anything big
  // coming?" of a user whose plan is built around "Semester Rent Payment" is
  // asking for a fact already on the screen.
  if (!activeGoals.length) {
    list.push(followUp('upcoming_cost', {
      // Not 'risk': sizing a cushion for the unknown and planning around a cost
      // you already know about are different conversations with different
      // answers. Only the first two share ground.
      topic: 'known_cost',
      label: 'Something big is coming',
      question: 'Is anything big landing in the next six months — tuition, a move, a car repair, travel?',
      why: 'A cost you already know about changes what the cushion has to absorb first.',
      ask: 'I have a known expense coming in the next few months. Help me work out whether to save for it separately or let it come out of my emergency fund.',
    }))
  }

  // Each rule below is tagged with the ground it covers. Three questions that
  // are all "what might you have to pay for?" read as one question asked three
  // ways — which is exactly what a plan built around a named upcoming cost used
  // to produce. One per topic guarantees the list attacks different things.
  const seen = new Set()
  return list.filter(item => {
    if (!item.topic) return true
    if (seen.has(item.topic)) return false
    seen.add(item.topic)
    return true
  })
}

/** The few worth showing under the plan itself, before the user has to ask. */
export function topFollowUps(input, limit = 3) {
  return planFollowUps(input).slice(0, limit)
}
