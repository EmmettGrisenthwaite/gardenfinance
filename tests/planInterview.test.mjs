import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildInitialPlan, buildMoneyRoute } from '../src/lib/moneyRoute.js'
import { INTERVIEW_MAX, applyRevisions, buildInterview, interviewQuestions } from '../src/lib/planInterview.js'

function setup(input) {
  const snapshot = computeSnapshot({ ...input, cashFlowItems: [] })
  const route = buildMoneyRoute({ snapshot, ...input })
  return { route, plan: buildInitialPlan(route), ...input }
}

const FREELANCER = {
  profile: { monthly_income: 3800, monthly_expenses: 2900, health_insurance: 'marketplace', employer_401k: 'na', age: 29, employment_type: 'freelance', onboarding_complete: true },
  accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 1500 }],
  debts: [{ id: 'promo', name: 'Store card', type: 'credit_card', balance: 1800, interest_rate: 0, minimum_payment: 40 }],
  goals: [],
}

const YOUNG_PRO = {
  profile: { monthly_income: 4200, monthly_expenses: 3400, health_insurance: 'employer', employer_401k: 'match', age: 26, employment_type: 'salaried', onboarding_complete: true },
  accounts: [
    { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 900 },
    { id: 'w', name: 'Work 401(k)', type: 'brokerage', subtype: '401k', balance: 8000, contribution_percent: 2, employer_match_percent: 100, employer_match_limit_percent: 5, monthly_contribution: 168 },
  ],
  debts: [{ id: 'visa', name: 'Visa Card', type: 'credit_card', balance: 4200, interest_rate: 23.9, minimum_payment: 110 }],
  goals: [],
}

const STUDENT = {
  profile: { monthly_income: 1450, monthly_expenses: 1450, health_insurance: 'parents', employer_401k: 'na', age: 20, employment_type: 'student', onboarding_complete: true },
  accounts: [{ id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 210 }],
  debts: [{ id: 'card', name: 'Store card', type: 'credit_card', balance: 640, interest_rate: 26.99, minimum_payment: 25 }],
  goals: [],
}

const DEADLINE = {
  profile: { monthly_income: 4000, monthly_expenses: 3100, health_insurance: 'employer', employer_401k: 'none', age: 27, employment_type: 'salaried', onboarding_complete: true },
  accounts: [
    { id: 'c', name: 'Checking', type: 'checking', subtype: 'checking', balance: 800 },
    { id: 's', name: 'Savings', type: 'savings', subtype: 'hysa', balance: 1400 },
  ],
  debts: [],
  goals: [{ id: 'rent', name: 'Semester rent', target_amount: 4800, current_amount: 600, deadline: '2026-12-01' }],
}

const PEOPLE = { FREELANCER, YOUNG_PRO, STUDENT, DEADLINE }

// ── Shape ────────────────────────────────────────────────────────────────────

test('no plan means no interview', () => {
  assert.equal(buildInterview({ route: { ready: false } }).status, 'unavailable')
  assert.equal(buildInterview({}).status, 'unavailable')
  assert.deepEqual(interviewQuestions({}), [])
})

for (const [who, input] of Object.entries(PEOPLE)) {
  test(`${who}: the interview stays short and every question earns its place`, () => {
    const context = setup(input)
    const questions = interviewQuestions(context)
    assert.ok(questions.length > 0, 'a ready plan always has something worth asking')
    assert.ok(questions.length <= INTERVIEW_MAX, `${questions.length} questions is an intake form`)
    // One per topic, so three questions attack three different things.
    assert.equal(new Set(questions.map(q => q.topic)).size, questions.length)
    for (const question of questions) {
      assert.ok(question.label && question.question && question.why)
      assert.ok(question.changes, 'a question must say what answering it will do')
      assert.ok(question.options.length >= 2, 'a tap needs somewhere to land')
      assert.equal(new Set(question.options.map(o => o.id)).size, question.options.length)
      assert.ok(question.prompt, 'the open-chat version has to survive for "talk it through"')
    }
  })

  test(`${who}: answering every question completes the interview`, () => {
    const context = setup(input)
    const questions = interviewQuestions(context)
    const answers = Object.fromEntries(questions.map(q => [q.id, q.options[0].id]))
    const done = buildInterview({ ...context, answers })
    assert.equal(done.status, 'complete')
    assert.equal(done.question, null)
    assert.equal(done.answered.length, questions.length)
    assert.equal(done.progress.index, done.progress.total)
    for (const item of done.answered) assert.ok(item.summary, 'every answer reports what it changed')
  })

  test(`${who}: walking out early still leaves a whole plan`, () => {
    const context = setup(input)
    const questions = interviewQuestions(context)
    // Answer only the first, then leave.
    const partial = buildInterview({ ...context, answers: { [questions[0].id]: questions[0].options[0].id } })
    const { steps } = applyRevisions(context.plan, partial.revisions)
    assert.ok(steps.length >= 3, 'the plan was already valid before question one')
    assert.equal(new Set(steps.map(step => step.intentKey)).size, steps.length)
  })
}

test('the interview is a pure function of the answers, so it resumes from storage', () => {
  const context = setup(YOUNG_PRO)
  const questions = interviewQuestions(context)
  const answers = { [questions[0].id]: questions[0].options[0].id }
  const first = buildInterview({ ...context, answers })
  const again = buildInterview({ ...context, answers })
  assert.deepEqual(first.answered, again.answered)
  assert.equal(first.question.id, again.question.id)
  assert.equal(first.progress.index, 1)
})

test('an unrecognised answer is ignored rather than trusted', () => {
  const context = setup(YOUNG_PRO)
  const questions = interviewQuestions(context)
  const state = buildInterview({ ...context, answers: { [questions[0].id]: 'not-an-option' } })
  assert.equal(state.answered.length, 0)
  assert.equal(state.question.id, questions[0].id)
})

// ── What answers actually do ─────────────────────────────────────────────────

test('an expiring 0% balance is asked about first, and moves the plan when it is', () => {
  const context = setup(FREELANCER)
  const questions = interviewQuestions(context)
  assert.equal(questions[0].id, 'debt_promo')

  const state = buildInterview({ ...context, answers: { debt_promo: 'soon' } })
  const { steps } = applyRevisions(context.plan, state.revisions)
  assert.match(steps[0].intentKey, /^pay\.debt\.promo/, 'the closing window outranks everything else')
  assert.ok(steps.some(step => step.intentKey === 'pay.debt.promo.before_expiry'))
  assert.match(state.answered[0].summary, /Store card/)
})

test('a genuine 0% changes nothing but the note', () => {
  const context = setup(FREELANCER)
  const state = buildInterview({ ...context, answers: { debt_promo: 'no' } })
  const before = context.plan.map(step => step.intentKey)
  const { steps, notes } = applyRevisions(context.plan, state.revisions)
  assert.deepEqual(steps.map(step => step.intentKey), before)
  assert.equal(notes.length, 1)
  assert.match(notes[0], /minimum/)
})

test('not knowing the match rate turns finding out into the first step', () => {
  const context = setup(YOUNG_PRO)
  const state = buildInterview({ ...context, answers: { match_details: 'unsure' } })
  const { steps } = applyRevisions(context.plan, state.revisions)
  assert.equal(steps[0].intentKey, 'verify.employer_match')
})

test('already claiming the full match reorders nothing', () => {
  const context = setup(YOUNG_PRO)
  const state = buildInterview({ ...context, answers: { match_details: 'full' } })
  const { steps } = applyRevisions(context.plan, state.revisions)
  assert.deepEqual(steps.map(s => s.intentKey), context.plan.map(s => s.intentKey))
})

test('swinging income puts the cushion in front', () => {
  const context = setup(YOUNG_PRO)
  const state = buildInterview({ ...context, answers: { income_stability: 'swings' } })
  const { steps } = applyRevisions(context.plan, state.revisions)
  assert.equal(steps[0].intentKey, 'fund.emergency_reserve')
  assert.ok(steps.some(step => step.intentKey === 'size.reserve_to_lean_month'))
})

test('a missed payment makes protecting the minimums the first thing in the plan', () => {
  const context = setup(STUDENT)
  const state = buildInterview({ ...context, answers: { minimums_safe: 'missed' } })
  const { steps } = applyRevisions(context.plan, state.revisions)
  assert.equal(steps[0].intentKey, 'setup.autopay_minimums')
  assert.ok(steps.some(step => step.intentKey === 'align.due_dates'))
})

test('a real deadline can outrank the cushion, and only when the user says so', () => {
  const context = setup(DEADLINE)
  const jumped = buildInterview({ ...context, answers: { goal_at_risk: 'jump' } })
  const promoted = applyRevisions(context.plan, jumped.revisions).steps
  assert.match(promoted[0].intentKey, /^fund\.goal\./)

  const kept = buildInterview({ ...context, answers: { goal_at_risk: 'keep' } })
  const unchanged = applyRevisions(context.plan, kept.revisions)
  assert.deepEqual(unchanged.steps.map(s => s.intentKey), context.plan.map(s => s.intentKey))
  assert.match(unchanged.notes[0], /deliberate trade/)
})

// ── Folding answers back into the plan ───────────────────────────────────────

test('promotions land in question order, so the biggest swing leads', () => {
  const plan = [
    { intentKey: 'fund.investment.a', text: 'a' },
    { intentKey: 'fund.emergency_reserve', text: 'b' },
    { intentKey: 'setup.autopay_minimums', text: 'c' },
  ]
  const { steps } = applyRevisions(plan, [
    { id: 'one', promote: 'setup.autopay_minimums' },
    { id: 'two', promote: 'fund.emergency_reserve' },
  ])
  assert.deepEqual(steps.map(s => s.intentKey), [
    'setup.autopay_minimums', 'fund.emergency_reserve', 'fund.investment.a',
  ])
  assert.deepEqual(steps.map(s => s.chapterOrder), [1, 2, 3])
})

test('two answers reaching for the same fix add it once', () => {
  const added = { intentKey: 'habit.subscription_audit', text: 'audit' }
  const { steps } = applyRevisions([{ intentKey: 'x', text: 'x' }], [
    { id: 'one', add: added },
    { id: 'two', add: { ...added } },
  ])
  assert.equal(steps.filter(s => s.intentKey === 'habit.subscription_audit').length, 1)
})

test('an added step never duplicates something the plan already holds', () => {
  const plan = [{ intentKey: 'habit.subscription_audit', text: 'already here' }]
  const { steps } = applyRevisions(plan, [
    { id: 'one', add: { intentKey: 'habit.subscription_audit', text: 'again' } },
  ])
  assert.equal(steps.length, 1)
  assert.equal(steps[0].text, 'already here')
})

test('promoting something the plan does not contain is a no-op, not a crash', () => {
  const plan = [{ intentKey: 'fund.investment.a', text: 'a' }]
  const { steps } = applyRevisions(plan, [{ id: 'one', promote: 'pay.debt.nothing' }])
  assert.deepEqual(steps.map(s => s.intentKey), ['fund.investment.a'])
})

// ── Grounding ────────────────────────────────────────────────────────────────

test('no tapped answer ever invents a number', () => {
  // Every dollar figure and percentage an interview step prints has to trace
  // back to a value the user actually recorded. A multiple-choice answer
  // carries no arithmetic of its own, so anything else would be a guess.
  for (const [who, input] of Object.entries(PEOPLE)) {
    const context = setup(input)
    const allowed = new Set()
    for (const debt of input.debts) {
      allowed.add(`$${Math.round(Number(debt.balance)).toLocaleString()}`)
      if (debt.interest_rate != null) allowed.add(`${Number(debt.interest_rate)}%`)
    }
    for (const goal of input.goals) {
      allowed.add(`$${Math.round(Number(goal.target_amount)).toLocaleString()}`)
      allowed.add(`$${Math.round(Number(goal.target_amount) - Number(goal.current_amount)).toLocaleString()}`)
    }

    const questions = interviewQuestions(context)
    for (const question of questions) {
      for (const option of question.options) {
        const state = buildInterview({ ...context, answers: { [question.id]: option.id } })
        for (const item of state.revisions) {
          const text = [item.add?.text, item.add?.detail, item.add?.doneWhen, item.add?.impact, item.summary, item.note]
            .filter(Boolean).join(' ')
          const claims = text.match(/\$\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g) || []
          for (const claim of claims) {
            assert.ok(allowed.has(claim.replace(/\s/g, '')),
              `${who}/${question.id}/${option.id}: invented "${claim}"`)
          }
        }
      }
    }
  }
})
