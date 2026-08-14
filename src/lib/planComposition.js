/**
 * What goes in the first plan, and how many.
 *
 * The waterfall in moneyRoute decides the ORDER money should move in. It does
 * not decide what a plan should contain, and left alone it produces two shapes
 * that both read badly:
 *
 *   - Too few. Someone breaking even gets "free up $50" and nothing else. One
 *     line is a suggestion, not a plan.
 *   - Too samey. Someone with three cards gets five variations on "pay a card".
 *     Every one is correct and the whole thing still reads like the app only
 *     noticed one fact about them.
 *
 * So a plan is composed, not just truncated: between three and five steps, and
 * spanning both kinds of advice a planner actually gives —
 *
 *   PERSONAL  — this exists because of a number in YOUR file, and would say
 *               something different (or vanish) if that number changed.
 *               "Pay $340/mo to Visa Card." "Move $250/mo toward your
 *               emergency fund." "Raise Work 401(k) to 5%."
 *
 *   PRACTICE  — this is what almost anyone in your position should do. Your
 *               data decided WHETHER to show it, not what it says.
 *               "Put every debt minimum on autopay." "Keep your cushion in a
 *               separate account." "Check your credit report."
 *
 * A plan of only personal steps is a calculator. A plan of only practice steps
 * is a listicle. The guarantee below is that you get some of each.
 */

const num = value => Number(value) || 0

export const PLAN_MIN = 3
export const PLAN_MAX = 5

/**
 * At most this many steps may share one topic. Three cards is a real
 * situation; a five-step plan about nothing but cards is a failure to look at
 * the rest of someone's money.
 */
export const MAX_PER_TOPIC = 3

/**
 * Steps whose wording is the same for everyone it applies to. Everything not
 * listed here is personal — the default is the safer one, because miscounting
 * a personal step as practice would let a plan satisfy the "spans both" rule
 * without actually containing any general guidance.
 */
const PRACTICE_INTENTS = new Set([
  'setup.autopay_minimums',
  'open.cushion_savings',
  'name.first_goal',
  'verify.employer_match',
  'open.investment_account',
  'open.taxable_brokerage',
  'choose.health_insurance',
])

const PRACTICE_PREFIXES = [
  'move.savings_to_hysa.', // "move it to a high-yield account" — same advice, any balance
  'habit.',                // the backfill bank below
]

const TOPIC_BY_PRIORITY = {
  deficit: 'budget',
  overcommitted: 'budget',
  insurance: 'insurance',
  starter_ef: 'reserve',
  build_ef: 'reserve',
  capture_match: 'retirement',
  kill_debt: 'debt',
  goal: 'goal',
  roth: 'invest',
  invest: 'invest',
  assign_cash: 'habit',
  grow: 'habit',
}

export function stepKind(step) {
  // A dollar figure settles it before the intent key gets a say. "Open a Roth
  // IRA and set up $625/mo" has a generic verb and a number that exists only
  // because of this user's surplus and this year's contribution cap — reading
  // it as boilerplate let a plan made entirely of their own arithmetic count
  // as containing no personal advice at all.
  if (num(step?.outcome?.amount) > 0) return 'personal'
  const intent = String(step?.intentKey || '')
  if (PRACTICE_INTENTS.has(intent)) return 'practice'
  if (PRACTICE_PREFIXES.some(prefix => intent.startsWith(prefix))) return 'practice'
  return 'personal'
}

export function stepTopic(step) {
  return TOPIC_BY_PRIORITY[step?.priorityKey] || 'habit'
}

/**
 * An automation step ("Schedule $340 monthly toward Visa Card") is not a
 * second opinion about debt — it is the same move, made durable. It rides
 * along with its parent rather than competing for a slot or counting against
 * the topic cap, which is why it is identified structurally instead of being
 * special-cased by name.
 */
function parentIntent(step) {
  const intent = String(step?.intentKey || '')
  if (!intent.startsWith('setup.')) return null
  const parent = intent.slice('setup.'.length)
  return PRACTICE_INTENTS.has(intent) ? null : parent
}

// ── The practice bank ─────────────────────────────────────────────────────────
//
// Used only to reach PLAN_MIN when the ladder has less than three things to
// say — a fully-set-up user with no debt, no gap, and everything automated.
// These are deliberately boring: universally sound, free, finishable in an
// evening, and impossible to get wrong. Each gate answers "is this already
// true of them?", so nobody is told to do something they have done.

export const PRACTICE_BACKFILL = [
  {
    key: 'weekly_checkin',
    intentKey: 'habit.weekly_checkin',
    priorityKey: 'grow',
    text: 'Put a 10-minute money check-in on your calendar every week',
    detail: 'Plans fail from inattention far more often than from bad arithmetic. Ten minutes a week is enough to catch a missed payment, a surprise charge, or a balance drifting the wrong way while it is still small.',
    doneWhen: 'A repeating weekly money check-in is scheduled on your calendar.',
    impact: 'Catches problems while they are still small',
    gate: () => true,
  },
  {
    key: 'credit_report',
    intentKey: 'habit.credit_report',
    priorityKey: 'grow',
    text: 'Pull your free credit report and read it once',
    detail: 'Your report decides what you pay to borrow for the next decade — rent applications, car loans, a mortgage, sometimes a job. It is free, and errors on it are common enough that reading it once is worth the half hour.',
    doneWhen: 'You have read your current credit report and know what is on it.',
    impact: 'Finds errors that quietly cost you the best rates',
    gate: () => true,
  },
  {
    key: 'subscription_audit',
    intentKey: 'habit.subscription_audit',
    priorityKey: 'grow',
    text: 'List every subscription and cancel one you do not use',
    detail: 'Recurring charges are the easiest money in any budget to free up, because cancelling one costs you nothing you would notice. Most people find at least one they had forgotten they were paying for.',
    doneWhen: 'Every recurring subscription is written down and at least one is cancelled.',
    impact: 'Frees up money without changing how you live',
    gate: context => num(context?.expenses) > 0,
  },
  {
    key: 'autopay_bills',
    intentKey: 'habit.autopay_bills',
    priorityKey: 'grow',
    // Only offered when there is no debt, because the debt version of this
    // advice ("autopay every minimum") is already a funded rung on the ladder
    // and saying both would be the same instruction twice.
    text: 'Put your fixed monthly bills on autopay',
    detail: 'Rent, utilities, phone, insurance. Anything with a fixed amount and a fixed date should not depend on you remembering it, and a single late fee usually costs more than a month of what this plan saves.',
    doneWhen: 'Every fixed monthly bill is set to pay automatically.',
    impact: 'Removes late fees from the list of things that can go wrong',
    gate: context => !(context?.debts || []).some(debt => num(debt.balance) > 0),
  },
]

/**
 * Which bank entries apply to this user and are not already represented.
 * `taken` is the set of intent keys the plan (or their history) already holds.
 */
export function eligibleBackfill(context = {}, taken = new Set()) {
  return PRACTICE_BACKFILL
    .filter(entry => !taken.has(entry.intentKey))
    .filter(entry => {
      try { return entry.gate(context) } catch { return false }
    })
}

/**
 * Pick the plan out of an ordered pool of candidates.
 *
 * `pool` arrives in the order the money should move — that ordering is the
 * waterfall's job and is never rearranged here, so the first funded move stays
 * the first thing the user reads. Composition only decides what gets a slot:
 *
 *   1. Walk the pool in order, admitting steps until PLAN_MAX.
 *   2. Refuse a step that would put a fourth item on one topic.
 *   3. Guarantee at least one personal and one practice step whenever both
 *      exist, trading out the most over-represented topic to make room.
 *   4. Top up from the practice bank if there are still fewer than PLAN_MIN.
 *
 * Returns the chosen steps, plus the reasoning, so the UI and the tests can
 * both see why a plan looks the way it does.
 */
export function composePlan(pool = [], { backfill = [], min = PLAN_MIN, max = PLAN_MAX } = {}) {
  const chosen = []
  const topicCount = new Map()
  const skipped = []

  const countsToward = step => !parentIntent(step)
  const bump = (topic, delta) => topicCount.set(topic, Math.max(0, (topicCount.get(topic) || 0) + delta))

  const admit = step => {
    chosen.push(step)
    if (countsToward(step)) bump(stepTopic(step), 1)
  }

  for (const step of pool) {
    if (chosen.length >= max) { skipped.push(step); continue }
    // A rider only earns its slot if the move it automates got one.
    const parent = parentIntent(step)
    if (parent && !chosen.some(item => item.intentKey === parent)) { skipped.push(step); continue }
    if (countsToward(step) && (topicCount.get(stepTopic(step)) || 0) >= MAX_PER_TOPIC) {
      skipped.push(step)
      continue
    }
    admit(step)
  }

  // ── Guarantees ──────────────────────────────────────────────────────────────
  //
  // Two ways a technically-correct plan still reads as the app having noticed
  // one fact about someone: every step the same KIND (pure arithmetic, or pure
  // listicle), and every step the same TOPIC (five ways of saying "you have
  // credit card debt"). Both are repaired the same way — find a candidate that
  // supplies what is missing, and take a slot for it.

  const missingKind = () => {
    const kinds = new Set(chosen.map(stepKind))
    if (!kinds.has('practice')) return 'practice'
    if (!kinds.has('personal')) return 'personal'
    return null
  }

  const oneTopicOnly = () => new Set(chosen.map(stepTopic)).size < 2

  const dropCandidate = () => {
    // Give up whichever step sits deepest in the most crowded topic, and never
    // a step something else depends on.
    const removable = chosen.filter(step => !chosen.some(other => parentIntent(other) === step.intentKey))
    return [...removable].sort((left, right) => {
      const byTopic = (topicCount.get(stepTopic(right)) || 0) - (topicCount.get(stepTopic(left)) || 0)
      if (byTopic) return byTopic
      return chosen.indexOf(right) - chosen.indexOf(left)
    })[0] || null
  }

  // Take a slot for `replacement`, freeing one only if the plan is already full.
  const makeRoom = (replacement, improves) => {
    if (!replacement) return false
    if (chosen.length < max) { admit(replacement); return true }
    const victim = dropCandidate()
    if (!victim || !improves(victim)) return false
    const at = chosen.indexOf(victim)
    chosen.splice(at, 1)
    if (countsToward(victim)) bump(stepTopic(victim), -1)
    admit(replacement)
    return true
  }

  const wantedKind = missingKind()
  if (wantedKind) {
    makeRoom(
      [...skipped, ...backfill].find(step => stepKind(step) === wantedKind && !parentIntent(step)),
      victim => stepKind(victim) !== wantedKind,
    )
  }

  // A three-card plan funds one card, automates that payment, and autopays the
  // minimums — three correct steps that between them look at exactly one
  // corner of someone's money. Anything from a different corner is worth more
  // here than a fourth sentence about the same card.
  if (oneTopicOnly()) {
    const only = stepTopic(chosen[0])
    makeRoom(
      [...skipped, ...backfill].find(step => stepTopic(step) !== only && !parentIntent(step)),
      victim => stepTopic(victim) === only,
    )
  }

  // ── Floor ───────────────────────────────────────────────────────────────────
  // Better a short plan than an invented one: only the vetted bank is used, so
  // running out of honest things to say leaves the plan short rather than
  // padded with something that does not apply.
  const used = new Set(chosen.map(step => step.intentKey))
  for (const step of backfill) {
    if (chosen.length >= min) break
    if (used.has(step.intentKey)) continue
    used.add(step.intentKey)
    admit(step)
  }

  return {
    steps: chosen,
    kinds: { personal: chosen.filter(step => stepKind(step) === 'personal').length,
             practice: chosen.filter(step => stepKind(step) === 'practice').length },
    topics: [...new Set(chosen.map(stepTopic))],
    // Honest when a guarantee could not be met — a user with literally nothing
    // personal to act on is a real state, not a bug to paper over.
    unmetKind: missingKind(),
    singleTopic: oneTopicOnly(),
  }
}
