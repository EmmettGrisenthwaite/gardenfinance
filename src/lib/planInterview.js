import { planFollowUps } from './planFollowUps.js'

/**
 * The short interview between "here is your plan" and "this plan is yours".
 *
 * planFollowUps already works out WHICH judgement calls matter for a given
 * plan — the ones no stored column can answer. What it produces is chat
 * prompts: open questions that land the user in a conversation with no
 * defined end, and no guarantee the plan is any different when they leave.
 *
 * This turns the same questions into a bounded flow. Three questions, tapped
 * not typed, each showing what it will change BEFORE it is answered, and each
 * answer producing a deterministic revision — a reorder, an extra step, a
 * note. It ends by handing back a plan ready to save.
 *
 * Two rules hold the whole thing together:
 *
 *   Never more than INTERVIEW_MAX questions. A planner who asks six questions
 *   before saying anything useful is doing an intake form, not advising. The
 *   plan is already valid before question one — the interview sharpens it, and
 *   skipping out at any point still leaves a complete plan.
 *
 *   No answer ever invents a number. Revisions reorder steps, add steps built
 *   from records the user already gave, or annotate. Nothing here computes a
 *   new dollar figure from a tapped option, because a number produced by a
 *   multiple-choice answer would be a guess wearing arithmetic's clothes.
 */

export const INTERVIEW_MAX = 3

const num = value => Number(value) || 0
const money = value => `$${Math.max(0, Math.round(num(value))).toLocaleString()}`

/**
 * A revision is what an answer DOES. Anything that cannot be expressed as one
 * of these three has no business being a tappable question — it belongs in the
 * open chat with the advisor, where an answer can be discussed rather than
 * silently applied.
 */
function revision({ id, summary, promote = null, add = null, note = null }) {
  return { id, summary, promote, add, note }
}

function step({ text, detail, doneWhen, impact = null, intentKey, priorityKey }) {
  return { text, detail, doneWhen, impact, intentKey, priorityKey, source: 'interview' }
}

// ── What each follow-up becomes when it is asked as a real question ───────────
//
// Keyed by planFollowUps id. Anything without an entry here stays a chat
// prompt: it is a good question whose answer cannot be reduced to two taps,
// and pretending otherwise would collect a shrug and call it a decision.

const SPECS = {
  debt_promo: {
    changes: 'Moves this balance up or down the order.',
    options: context => {
      const debt = context.promoDebt
      return [
        { id: 'soon',  label: 'Yes — it ends within 6 months',
          revise: () => revision({
            id: 'debt_promo',
            summary: `${debt.name} jumps to the front — the 0% window closes first.`,
            promote: `pay.debt.${debt.id || 'highest_apr'}`,
            add: step({
              text: `Clear ${debt.name} before the 0% rate ends`,
              detail: `Once the promotional rate expires, the remaining ${money(debt.balance)} starts charging the card's normal rate — which is usually the highest rate in this plan. Paying it off inside the window costs nothing extra in interest.`,
              doneWhen: `${debt.name} is cleared in full, or you know the exact date the rate changes.`,
              impact: 'Avoids the rate jump entirely',
              intentKey: `pay.debt.${debt.id || 'promo'}.before_expiry`,
              priorityKey: 'kill_debt',
            }),
          }) },
        { id: 'later', label: 'Yes — more than 6 months away',
          revise: () => revision({
            id: 'debt_promo',
            summary: `${debt.name} stays where it is, with the end date noted.`,
            note: `${debt.name} is on a promotional 0% that expires later this year. It moves to the top of the plan when the window is within six months.`,
          }) },
        { id: 'no',    label: "No, it's genuinely 0%",
          revise: () => revision({
            id: 'debt_promo',
            summary: `${debt.name} stays on minimums — nothing cheaper to pay off.`,
            note: `${debt.name} charges no interest, so paying it early earns you nothing. Keep paying the minimum.`,
          }) },
      ]
    },
  },

  match_details: {
    changes: 'Decides whether claiming the match leads your plan.',
    options: () => [
      { id: 'under', label: "I'm putting in less than they match",
        revise: () => revision({
          id: 'match_details',
          summary: 'Claiming the full match becomes your first move.',
          promote: 'capture.employer_match',
        }) },
      { id: 'full',  label: "I'm already getting all of it",
        revise: () => revision({
          id: 'match_details',
          summary: 'Match already captured — the plan skips ahead to the next rung.',
          note: 'Employer match is already fully claimed, so the plan starts below it.',
        }) },
      { id: 'unsure', label: "I don't know what they match",
        revise: () => revision({
          id: 'match_details',
          summary: 'Finding out becomes a step — it outranks everything else here.',
          promote: 'verify.employer_match',
          add: step({
            text: 'Find your employer match rate on a pay stub or benefits page',
            detail: 'A match is the only guaranteed return in this plan — better than paying off even an expensive card. You cannot claim it without knowing the percentage, and it takes one message to HR.',
            doneWhen: 'You know the match percentage and how much you currently contribute.',
            impact: 'Unlocks the highest-return money available to you',
            intentKey: 'verify.employer_match',
            priorityKey: 'capture_match',
          }),
        }) },
    ],
  },

  income_stability: {
    changes: 'Changes how big your cushion needs to be before anything else starts.',
    options: () => [
      { id: 'steady', label: "It's the same most months",
        revise: () => revision({
          id: 'income_stability',
          summary: 'Plan stays as calculated — a steady income supports it.',
        }) },
      { id: 'swings', label: 'It swings month to month',
        revise: () => revision({
          id: 'income_stability',
          summary: 'Cushion moves ahead of everything that is not urgent.',
          promote: 'fund.emergency_reserve',
          add: step({
            text: 'Work out your leanest realistic month and size the cushion to it',
            detail: 'Every amount in this plan assumes the surplus repeats. When income swings, the number that matters is not the average month — it is the worst one you can expect, because that is the month the plan has to survive without new debt.',
            doneWhen: 'You have written down your lowest likely monthly income and what the cushion needs to cover it.',
            impact: 'Keeps a thin month from undoing months of progress',
            intentKey: 'size.reserve_to_lean_month',
            priorityKey: 'starter_ef',
          }),
        }) },
      { id: 'seasonal', label: 'It comes in bursts or seasons',
        revise: () => revision({
          id: 'income_stability',
          summary: 'Plan switches to funding from the good months, not every month.',
          promote: 'fund.emergency_reserve',
          add: step({
            text: 'Move a fixed share of every payment to savings on the day it arrives',
            detail: 'Money that arrives in bursts disappears if it waits for a monthly schedule. Taking a set percentage off the top the day it lands is the only version of this that survives a quiet stretch.',
            doneWhen: 'You have set the percentage and moved it from your most recent payment.',
            impact: 'Turns uneven income into a steady cushion',
            intentKey: 'setup.percentage_sweep',
            priorityKey: 'starter_ef',
          }),
        }) },
    ],
  },

  break_even: {
    changes: 'Decides whether the plan looks for a cut or waits it out.',
    options: () => [
      { id: 'always', label: 'This is every month',
        revise: () => revision({
          id: 'break_even',
          summary: 'Freeing up your first spare money becomes the plan.',
          promote: 'budget.find_first_margin',
          add: step({
            text: 'List every recurring charge and cancel the one you would miss least',
            detail: 'When income and spending are level, the first dollar has to come from somewhere, and a subscription is the only cut that costs you nothing you would notice day to day.',
            doneWhen: 'Every recurring charge is written down and at least one is cancelled.',
            impact: 'Creates the first money this plan can actually direct',
            intentKey: 'habit.subscription_audit',
            priorityKey: 'deficit',
          }),
        }) },
      { id: 'unusual', label: 'This month was unusual',
        revise: () => revision({
          id: 'break_even',
          summary: 'Plan holds — it will re-read your numbers next month.',
          note: 'This month was atypical, so the plan is built on a one-off rather than the pattern. Update your spending when the normal month lands.',
        }) },
    ],
  },

  minimums_safe: {
    changes: 'Decides whether protecting your payments comes before growing anything.',
    options: () => [
      { id: 'fine',  label: 'Yes, comfortably',
        revise: () => revision({
          id: 'minimums_safe',
          summary: 'Plan stays as calculated.',
        }) },
      { id: 'tight', label: "It's tight some months",
        revise: () => revision({
          id: 'minimums_safe',
          summary: 'Autopay on every minimum moves to the front.',
          promote: 'setup.autopay_minimums',
        }) },
      { id: 'missed', label: "I've missed one recently",
        revise: () => revision({
          id: 'minimums_safe',
          summary: 'Protecting your payments becomes the first thing in the plan.',
          promote: 'setup.autopay_minimums',
          add: step({
            text: 'Call each lender and move your due dates to just after payday',
            detail: 'A missed payment costs a late fee now and a worse rate for years. Most lenders will move a due date on request, and lining every date up behind payday removes the gap where the miss happens.',
            doneWhen: 'Every due date falls in the week after you get paid.',
            impact: 'Removes the most expensive avoidable mistake',
            intentKey: 'align.due_dates',
            priorityKey: 'kill_debt',
          }),
        }) },
    ],
  },

  goal_at_risk: {
    changes: 'Decides whether your deadline outranks your cushion.',
    options: context => {
      const goal = context.lateGoal
      return [
        { id: 'jump', label: `Yes — ${goal.name} has a real deadline`,
          revise: () => revision({
            id: 'goal_at_risk',
            summary: `${goal.name} moves ahead of the cushion.`,
            promote: `fund.goal.${goal.id || 'primary'}`,
            // The goal is queued behind the cushion, so the ladder never made a
            // step for it. Promoting alone would move nothing and the summary
            // would be a promise the plan does not keep — the answer has to
            // bring the step it claims to raise.
            add: step({
              text: `Fund ${goal.name} first, ahead of the cushion`,
              detail: `${money(Math.max(0, num(goal.target_amount) - num(goal.current_amount)))} still to find by ${goal.deadline}. A fixed date outranks a cushion that has no date, so this takes the monthly money until it is met.`,
              doneWhen: `${goal.name} is fully funded, or its deadline has passed.`,
              impact: 'Meets the deadline instead of missing it',
              intentKey: `fund.goal.${goal.id || 'primary'}.by_deadline`,
              priorityKey: 'goal',
            }),
            note: `${goal.name} is funded first because its deadline is fixed. The emergency cushion resumes once it is met.`,
          }) },
        { id: 'keep', label: 'No, keep the safer order',
          revise: () => revision({
            id: 'goal_at_risk',
            summary: 'Cushion stays first — the goal lands later than planned.',
            note: `${goal.name} will arrive after its target date under this order. That is the deliberate trade for keeping the cushion first.`,
          }) },
      ]
    },
  },

  investing_horizon: {
    changes: 'Decides how much of this should be invested at all.',
    options: () => [
      { id: 'long',  label: "It's for decades away",
        revise: () => revision({
          id: 'investing_horizon',
          summary: 'Investing stays as planned.',
        }) },
      { id: 'soon',  label: 'Some of it within five years',
        revise: () => revision({
          id: 'investing_horizon',
          summary: 'The near-term portion is redirected out of investments.',
          add: step({
            text: 'Split out the money you need within five years and keep it in savings',
            detail: 'Investments can be down for years at a stretch, which is survivable at a thirty-year horizon and ruinous at a three-year one. Anything with a date inside five years belongs in cash, earning interest rather than risking the timeline.',
            doneWhen: 'The five-year money sits in a savings account, separate from anything invested.',
            impact: 'Protects money you have a date for',
            intentKey: 'split.short_horizon_cash',
            priorityKey: 'build_ef',
          }),
        }) },
    ],
  },

  rate_reduction: {
    changes: 'Can cut what this debt costs without finding extra money.',
    options: context => {
      const debt = context.expensiveDebt
      return [
        { id: 'not_yet', label: "I haven't asked",
          revise: () => revision({
            id: 'rate_reduction',
            summary: 'Asking for a lower rate joins the plan.',
            add: step({
              text: `Call ${debt.name} and ask for a lower rate`,
              detail: `You currently pay ${num(debt.interest_rate)}% on ${money(debt.balance)}. A rate cut does the same work as paying extra every month, without finding the extra money — and a customer who has paid on time has real leverage to ask.`,
              doneWhen: 'You have asked, and either the rate is lowered or you know it was declined.',
              impact: 'Costs one phone call, works like a raise',
              intentKey: `reduce.rate.${debt.id || 'primary'}`,
              priorityKey: 'kill_debt',
            }),
          }) },
        { id: 'asked',  label: 'Asked already — no luck',
          revise: () => revision({
            id: 'rate_reduction',
            summary: 'Plan sticks with paying it down fastest.',
            note: `A lower rate on ${debt.name} has already been requested and declined, so paying it down is the remaining lever.`,
          }) },
        { id: 'done',   label: 'Already lowered it',
          revise: () => revision({
            id: 'rate_reduction',
            summary: 'Noted — update the rate so the order stays honest.',
            note: `${debt.name}'s rate has changed. Update it so this plan ranks it correctly.`,
          }) },
      ]
    },
  },

  upcoming_cost: {
    changes: 'Decides whether the cushion has to absorb a known bill.',
    options: () => [
      { id: 'yes', label: 'Yes, within six months',
        revise: () => revision({
          id: 'upcoming_cost',
          summary: 'A separate fund for it joins the plan.',
          add: step({
            text: 'Name the upcoming cost and save for it separately from your cushion',
            detail: 'An expense you already know about is not an emergency, and paying for it out of the emergency fund leaves you with no emergency fund on the day after. Two pots, two jobs.',
            doneWhen: 'The expense has a name, an amount, a date, and its own destination.',
            impact: 'Keeps a known bill from emptying your cushion',
            intentKey: 'name.sinking_fund',
            priorityKey: 'goal',
          }),
        }) },
      { id: 'no',  label: 'Nothing I know of',
        revise: () => revision({
          id: 'upcoming_cost',
          summary: 'Plan stays as calculated.',
        }) },
    ],
  },
}

/**
 * The records a spec needs to word its options. Pulled once, so a question is
 * only ever offered when the thing it talks about actually exists.
 */
function questionContext({ debts = [], goals = [], route }) {
  const live = debts.filter(debt => num(debt.balance) > 0)
  const funded = (route?.allocations || []).filter(item => num(item.amount) > 0)
  return {
    promoDebt: live.find(debt => debt.interest_rate !== null && debt.interest_rate !== undefined
      && debt.interest_rate !== '' && num(debt.interest_rate) === 0) || null,
    expensiveDebt: live.filter(debt => num(debt.interest_rate) > 7)
      .sort((left, right) => num(right.interest_rate) - num(left.interest_rate))[0] || null,
    lateGoal: goals.find(goal => goal.deadline && num(goal.target_amount) > num(goal.current_amount)) || null,
    funded,
  }
}

/** Does this follow-up have everything it needs to be asked as a tap? */
function askable(followUp, context) {
  const spec = SPECS[followUp.id]
  if (!spec) return false
  if (followUp.id === 'debt_promo' && !context.promoDebt) return false
  if (followUp.id === 'rate_reduction' && !context.expensiveDebt) return false
  if (followUp.id === 'goal_at_risk' && !context.lateGoal) return false
  return true
}

/**
 * The full question queue for this plan, already bounded and ordered by how
 * much the answer would move things. planFollowUps handles the ranking and the
 * one-per-topic rule; this layer only drops anything that cannot be answered
 * with a tap.
 */
export function interviewQuestions({ route, profile, debts = [], goals = [], now = Date.now() } = {}) {
  if (!route?.ready) return []
  const context = questionContext({ debts, goals, route })
  return planFollowUps({ route, profile, debts, goals, now })
    .filter(followUp => askable(followUp, context))
    .slice(0, INTERVIEW_MAX)
    .map(followUp => {
      const spec = SPECS[followUp.id]
      return {
        id: followUp.id,
        topic: followUp.topic,
        label: followUp.label,
        question: followUp.question,
        why: followUp.why,
        changes: spec.changes,
        // The open-chat version, kept so "talk it through instead" can hand the
        // same question to the advisor without losing the wording.
        prompt: followUp.prompt,
        options: spec.options(context).map(option => ({ id: option.id, label: option.label })),
      }
    })
}

/**
 * The interview as the UI sees it: where we are, what to ask next, and what
 * the answers so far have changed.
 *
 * `answers` is a plain `{ [questionId]: optionId }` map, so the whole flow is
 * resumable from storage and has no hidden state of its own.
 */
export function buildInterview({ route, profile, debts = [], goals = [], answers = {}, now = Date.now() } = {}) {
  const questions = interviewQuestions({ route, profile, debts, goals, now })
  if (!questions.length) {
    return { status: 'unavailable', question: null, questions: [], answered: [], revisions: [], progress: { index: 0, total: 0 } }
  }

  const context = questionContext({ debts, goals, route })
  const answered = []
  const revisions = []

  for (const question of questions) {
    const choice = answers[question.id]
    if (!choice) continue
    const option = SPECS[question.id].options(context).find(item => item.id === choice)
    if (!option) continue
    const result = option.revise()
    answered.push({ id: question.id, label: question.label, choice, choiceLabel: option.label, summary: result.summary })
    revisions.push(result)
  }

  // Keyed on what was actually understood, not on what was submitted. A stale
  // or malformed answer would otherwise count as progress and silently skip the
  // question it failed to answer.
  const resolved = new Set(answered.map(item => item.id))
  const next = questions.find(question => !resolved.has(question.id)) || null
  return {
    status: next ? 'asking' : 'complete',
    question: next,
    questions,
    answered,
    revisions,
    progress: { index: answered.length, total: questions.length },
  }
}

/**
 * Fold the interview's revisions into the composed plan.
 *
 * Promotions are applied in question order, so the highest-impact answer ends
 * up first — the reverse would let a minor third question outrank the reason
 * the interview started. Added steps go in after the promoted ones and are
 * deduped against what the plan already holds, because several answers can
 * legitimately reach for the same fix.
 */
export function applyRevisions(steps = [], revisions = []) {
  const promoted = []
  const promotedAdds = []
  const taken = new Set(steps.map(step => step.intentKey))

  for (const item of revisions) {
    if (!item.promote) continue
    const found = steps.find(step => String(step.intentKey || '').startsWith(item.promote))
    if (found) {
      if (!promoted.includes(found)) promoted.push(found)
      continue
    }
    // The rung being promoted is not in the plan — usually because the ladder
    // had no reason to rank it until this answer arrived (a 0% balance the
    // waterfall skipped, a match nobody had confirmed). The step the answer
    // brings with it *is* the promotion, so it leads rather than trailing at
    // the bottom where it would contradict "this jumps to the front".
    if (item.add && !taken.has(item.add.intentKey)) {
      taken.add(item.add.intentKey)
      promotedAdds.push(item.add)
    }
  }

  const ordered = [
    ...promotedAdds,
    ...promoted,
    ...steps.filter(step => !promoted.includes(step)),
  ]

  const added = []
  for (const item of revisions) {
    if (!item.add || taken.has(item.add.intentKey)) continue
    taken.add(item.add.intentKey)
    added.push(item.add)
  }

  return {
    steps: [...ordered, ...added].map((step, index) => ({ ...step, chapterOrder: index + 1 })),
    notes: revisions.map(item => item.note).filter(Boolean),
  }
}
