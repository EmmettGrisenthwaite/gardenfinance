import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildMoneyRoute } from '../src/lib/moneyRoute.js'
import { buildPlanModel, replacementCandidate, retireMove } from '../src/lib/focusedPlan.js'
import { stepLinks, stepProgress } from '../src/lib/stepFacts.js'

// Two years of someone actually following the plan: money arrives, transfers
// go out, debts amortize, life changes — and every month the user accepts
// whatever the Plan offers. The invariants are the promises the Plan makes
// after it is generated; each one was broken by a real sequence before.

const clone = value => JSON.parse(JSON.stringify(value))
const MONEY_KINDS = ['transfer', 'contribution', 'debt_payment']
const BAD_COPY = /undefined|NaN|\$0\/mo|\$0 monthly|\bnull\b/

const PERSONAS = {
  'student with a card, a pay cut, a raise, then a new loan': {
    profile: { age: 20, employment_type: 'w2', monthly_income: 1800, monthly_expenses: 1450, health_insurance: 'parents', employer_401k: 'none', investment_types: ['none'], onboarding_complete: true },
    accounts: [{ id: 'chk', name: 'Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 300 }],
    debts: [{ id: 'visa', name: 'Visa', lender: 'Capital One', type: 'credit_card', balance: 1900, interest_rate: 28.5, minimum_payment: 40 }],
    events: {
      3: state => { state.profile.monthly_income = 1500 },
      7: state => { state.profile.monthly_income = 2000 },
      14: state => { state.debts.push({ id: 'car', name: 'Car repair loan', type: 'personal_loan', balance: 2400, interest_rate: 18, minimum_payment: 110 }) },
    },
  },
  'two cards, rising rent, then a trip goal': {
    profile: { age: 27, employment_type: 'w2', monthly_income: 4200, monthly_expenses: 3100, health_insurance: 'employer', employer_401k: 'unsure', investment_types: ['none'], onboarding_complete: true },
    accounts: [
      { id: 'chk', name: 'Checking', institution: 'Wells Fargo', type: 'checking', subtype: 'checking', balance: 900 },
      { id: 'sav', name: 'Savings', institution: 'Wells Fargo', type: 'savings', subtype: 'standard_savings', balance: 1200, interest_rate: 0.01 },
    ],
    debts: [
      { id: 'amex', name: 'Amex', type: 'credit_card', balance: 4100, interest_rate: 24.9, minimum_payment: 120 },
      { id: 'disc', name: 'Discover it', type: 'credit_card', balance: 1600, interest_rate: 19.9, minimum_payment: 45 },
    ],
    events: {
      5: state => { state.profile.monthly_expenses = 3500 },
      12: state => { state.goals.push({ id: 'trip', name: 'Japan trip', goal_type: 'savings', target_amount: 4000, current_amount: 0, monthly_contribution: 0, deadline: '2028-06-01' }) },
    },
  },
  'match earner who takes a pay cut': {
    profile: { age: 30, employment_type: 'w2', monthly_income: 6500, monthly_expenses: 4400, health_insurance: 'employer', employer_401k: 'match', investment_types: ['401k'], onboarding_complete: true },
    accounts: [
      { id: 'chk', name: 'Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 2500 },
      { id: 'sav', name: 'Marcus Savings', institution: 'Marcus', type: 'savings', subtype: 'hysa', balance: 4000, interest_rate: 4 },
      { id: 'k', name: 'Work 401(k)', institution: 'Fidelity', type: 'brokerage', subtype: '401k', balance: 21000, contribution_percent: 2, employer_match_percent: 50, employer_match_limit_percent: 6, monthly_contribution: 130 },
    ],
    debts: [{ id: 'car', name: 'Car loan', lender: 'Toyota Financial', type: 'auto_loan', balance: 11000, interest_rate: 6.2, minimum_payment: 330 }],
    goals: [{ id: 'home', name: 'Home down payment', goal_type: 'purchase', target_amount: 30000, current_amount: 2000, monthly_contribution: 0, deadline: '2029-09-01' }],
    events: { 9: state => { state.profile.monthly_income = 5200 } },
  },
  'uninsured freelancer who finds coverage': {
    profile: { age: 26, employment_type: 'freelance', monthly_income: 4800, monthly_expenses: 3500, health_insurance: 'none', employer_401k: 'none', investment_types: ['none'], onboarding_complete: true },
    accounts: [{ id: 'chk', name: 'Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 7200 }],
    events: { 2: state => { state.profile.health_insurance = 'marketplace'; state.profile.monthly_expenses = 3850 } },
  },
  'breaking even, then a little slack': {
    profile: { age: 24, employment_type: 'w2', monthly_income: 2900, monthly_expenses: 2900, health_insurance: 'employer', employer_401k: 'none', investment_types: ['none'], onboarding_complete: true },
    accounts: [{ id: 'chk', name: 'Checking', type: 'checking', subtype: 'checking', balance: 150 }],
    debts: [{ id: 'card', name: 'Credit card', type: 'credit_card', balance: 900, interest_rate: 22, minimum_payment: 30 }],
    events: { 2: state => { state.profile.monthly_expenses = 2750 }, 10: state => { state.profile.monthly_income = 3300 } },
  },
}

// Errands a person does in the world, applied to their records the way the
// app's own completion prompts would.
function completeErrand(state, step, checking) {
  const amount = Number(step.outcome?.amount) || 0
  if (step.intentKey === 'open.investment_account' || step.intentKey === 'open.taxable_brokerage') {
    const roth = step.intentKey === 'open.investment_account'
    const moved = Math.min(amount, Math.max(0, checking.balance))
    checking.balance -= moved
    state.accounts.push({ id: roth ? 'roth' : 'brk', name: roth ? 'Roth IRA' : 'Brokerage', institution: 'Fidelity', type: 'brokerage', subtype: roth ? 'roth_ira' : 'taxable_brokerage', balance: moved })
    state.profile.investment_types = [...state.profile.investment_types.filter(type => type !== 'none'), roth ? 'roth_ira' : 'brokerage']
  }
  if (step.intentKey === 'open.cushion_savings' || step.intentKey?.startsWith('move.savings_to_hysa')) {
    const idle = state.accounts.find(account => account.subtype === 'standard_savings')
    if (idle) Object.assign(idle, { subtype: 'hysa', interest_rate: 3.8 })
    else if (!state.accounts.some(account => account.subtype === 'hysa')) {
      state.accounts.push({ id: 'newsav', name: 'Ally Savings', institution: 'Ally', type: 'savings', subtype: 'hysa', balance: 0, interest_rate: 3.8 })
    }
  }
  if (step.intentKey === 'verify.employer_match') state.profile.employer_401k = 'none'
  if (step.intentKey?.startsWith('capture.employer_match')) {
    const workplace = state.accounts.find(account => account.subtype === '401k')
    Object.assign(workplace, { contribution_percent: workplace.employer_match_limit_percent, monthly_contribution: Math.round(workplace.monthly_contribution * workplace.employer_match_limit_percent / workplace.contribution_percent) })
  }
}

function live(persona, months = 24) {
  const state = clone({ goals: [], debts: [], cashFlowItems: [], ...persona, events: undefined })
  const plan = { id: 'plan', steps: [] }
  const failures = []
  let nextId = 1
  let lastReview = null
  let silent = 0

  const model = month => {
    const snapshot = computeSnapshot(state)
    const route = buildMoneyRoute({ ...state, snapshot })
    return { route, planModel: buildPlanModel({ snapshot, plan, moneyRoute: route, activities: [], now: new Date(Date.UTC(2026, month, 1)) }) }
  }

  for (let month = 0; month < months; month++) {
    persona.events?.[month]?.(state)
    let { route, planModel } = model(month)

    let guard = 0
    while (planModel.review && guard++ < 6) {
      const review = planModel.review
      const key = `${review.kind}|${review.step.id}|${review.reason}`
      if (key === lastReview) failures.push(`m${month}: the same review twice: ${review.reason}`)
      lastReview = key
      // A review that says a debt is paid off must be true.
      if (/paid off/.test(review.reason)) {
        const ids = [review.step.outcome?.debtId, review.step.basis?.recordId, ...(review.step.outcome?.debtIds || [])].filter(Boolean)
        const referenced = state.debts.filter(debt => ids.includes(debt.id))
        const covered = referenced.length ? referenced : state.debts
        if (covered.some(debt => debt.balance > 0)) failures.push(`m${month}: "${review.reason}" while a balance remains`)
      }
      if (review.kind === 'amount_update') {
        const patches = new Map(review.updates.map(update => [update.id, update.patch]))
        plan.steps = plan.steps.map(step => patches.has(step.id) ? { ...step, ...patches.get(step.id) } : step)
      } else {
        const replacement = replacementCandidate(planModel)
        plan.steps = retireMove(plan.steps, review.step.id, { now: new Date(Date.UTC(2026, month, 1)).toISOString() })
        if (replacement) plan.steps.push({ ...clone(replacement), id: `s${nextId++}`, proposed: undefined, source: 'focus', done: false, addedMonth: month })
      }
      ;({ route, planModel } = model(month))
    }
    if (guard >= 6) failures.push(`m${month}: reviews never settled`)

    for (const candidate of planModel.routeCandidates) {
      plan.steps.push({ ...clone(candidate), id: `s${nextId++}`, proposed: undefined, source: 'money-route', done: false, addedMonth: month })
    }

    const kept = plan.steps.filter(step => !step.supersededAt)
    const active = kept.filter(step => !step.done)
    const intents = active.map(step => step.intentKey).filter(Boolean)
    const duplicate = intents.find((intent, index) => intents.indexOf(intent) !== index)
    if (duplicate) failures.push(`m${month}: ${duplicate} is in the plan twice`)

    const committed = active
      .filter(step => MONEY_KINDS.includes(step.outcome?.kind) && step.outcome?.recurrence)
      .reduce((sum, step) => sum + (Number(step.outcome.amount) || 0), 0)
    if (committed > route.availableMonthlyAmount + 1) failures.push(`m${month}: directs $${committed} of $${route.availableMonthlyAmount}`)

    for (const step of active) {
      for (const field of ['text', 'detail', 'impact', 'doneWhen']) {
        if (step[field] && BAD_COPY.test(step[field])) failures.push(`m${month}: ${field} reads "${step[field]}"`)
      }
      const schedule = kept.find(item => item.intentKey === `setup.${step.intentKey}`)
      if (schedule?.outcome?.amount && step.outcome?.amount && schedule.outcome.amount !== step.outcome.amount) {
        failures.push(`m${month}: standing order $${schedule.outcome.amount} but move $${step.outcome.amount}`)
      }
      for (const link of stepLinks(step, state)) {
        if (!/^https:\/\//.test(link.url)) failures.push(`m${month}: link ${link.url}`)
      }
    }

    const routed = route.allocations.some(item => item.amount > 0 && !['unassigned', 'hold_for_coverage'].includes(item.key))
    silent = routed && !active.some(step => Number(step.outcome?.amount) > 0) ? silent + 1 : 0
    if (silent >= 2) failures.push(`m${month}: money is routed but the plan has said nothing for ${silent} months`)

    // The month itself: pay arrives, the standing moves go out, and errands
    // that arrived last month get done.
    const checking = state.accounts.find(account => account.id === 'chk')
    checking.balance += state.profile.monthly_income - state.profile.monthly_expenses
    for (const step of active) {
      const outcome = step.outcome || {}
      const amount = Number(outcome.amount) || 0
      if (outcome.kind === 'debt_payment' && amount > 0) {
        const debt = state.debts.find(item => item.id === outcome.debtId)
        if (debt?.balance > 0) {
          const paid = Math.min(amount, Math.max(0, checking.balance))
          checking.balance -= paid
          debt.balance = Math.max(0, Math.round(debt.balance * (1 + debt.interest_rate / 1200) - paid - debt.minimum_payment))
          debt.paid = true
        }
      } else if (MONEY_KINDS.includes(outcome.kind) && amount > 0) {
        const moved = Math.min(amount, Math.max(0, checking.balance))
        checking.balance -= moved
        const destination = state.accounts.find(account => account.id === outcome.destinationAccountId)
        if (destination) destination.balance += moved
        const goal = state.goals.find(item => item.id === outcome.goalId)
        if (goal) goal.current_amount += moved
        if (!destination && !goal && /^Open a savings account/.test(step.text)) {
          state.accounts.push({ id: 'newsav', name: 'Ally Savings', institution: 'Ally', type: 'savings', subtype: 'hysa', balance: moved, interest_rate: 3.8 })
          step.done = true
        }
      } else if (month > (step.addedMonth ?? -1)) {
        step.done = true
        completeErrand(state, step, checking)
      }
    }
    for (const debt of state.debts) {
      if (!debt.paid && debt.balance > 0) debt.balance = Math.max(0, Math.round(debt.balance * (1 + debt.interest_rate / 1200) - debt.minimum_payment))
      delete debt.paid
    }
  }
  return { failures, plan, state }
}

for (const [name, persona] of Object.entries(PERSONAS)) {
  test(`two years of following the plan: ${name}`, () => {
    const { failures } = live(persona)
    assert.deepEqual(failures, [])
  })
}

test('a year in, progress on the plan matches the records it is read from', () => {
  const { plan, state } = live(PERSONAS['match earner who takes a pay cut'], 12)
  const goalStep = plan.steps.find(step => !step.done && !step.supersededAt && step.outcome?.goalId === 'home')
  assert.ok(goalStep, 'the down payment is being funded')
  const home = state.goals.find(goal => goal.id === 'home')
  assert.equal(stepProgress(goalStep, state).label, `$${home.current_amount.toLocaleString()} of $30,000`)
})
