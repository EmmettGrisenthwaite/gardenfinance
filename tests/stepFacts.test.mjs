import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSnapshot } from '../src/lib/finance.js'
import { buildInitialPlan, buildMoneyRoute } from '../src/lib/moneyRoute.js'
import { institutionFor, stepFactsForGuide, stepLinks, stepProgress } from '../src/lib/stepFacts.js'

const PROVIDER_SIGNUPS = /ally\.com\/bank|marcus\.com\/us|sofi\.com\/banking/

function planFor(records) {
  const input = { goals: [], cashFlowItems: [], activities: [], ...records }
  const snapshot = computeSnapshot(input)
  return buildInitialPlan(buildMoneyRoute({ ...input, snapshot }))
}

const midCareer = {
  profile: { monthly_income: 6200, monthly_expenses: 4300, health_insurance: 'employer', employer_401k: 'match', investment_types: ['401k'], onboarding_complete: true },
  accounts: [
    { id: 'chk', name: 'Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 3100 },
    { id: 'sav', name: 'Ally Savings', institution: 'Ally', type: 'savings', subtype: 'hysa', balance: 6000, interest_rate: 4.2 },
    { id: 'k', name: 'Work 401(k)', institution: 'Fidelity', type: 'brokerage', subtype: '401k', balance: 18000, contribution_percent: 3, employer_match_percent: 100, employer_match_limit_percent: 6, monthly_contribution: 186 },
  ],
  debts: [{ id: 'car', name: 'Car loan', lender: 'Toyota Financial', type: 'auto', balance: 9000, interest_rate: 5.1, minimum_payment: 310 }],
}

test('the institution a user typed wins over a bank name buried in the account name', () => {
  assert.equal(institutionFor({ name: 'Chase Freedom' }).name, 'Chase')
  assert.equal(institutionFor({ name: 'Rainy day', institution: 'Ally' }).name, 'Ally')
  assert.equal(institutionFor({ name: 'Visa', lender: 'Capital One' }).name, 'Capital One')
  // A card network is not a bank, and a name with no bank in it links nowhere.
  assert.equal(institutionFor({ name: 'Visa' }), null)
  assert.equal(institutionFor({ name: 'Savings' }), null)
})

test('money going into an account the user already has links to their bank, never to sign-up pages', () => {
  const steps = planFor(midCareer)
  const move = steps.find(step => step.intentKey === 'fund.emergency_reserve')
  const links = stepLinks(move, midCareer)
  assert.deepEqual(links.map(link => link.label), ['Send from Checking at Chase', 'Ally Savings'])
  // The old keyword registry matched "emergency fund" and offered three
  // competitors' account-opening pages to someone who already banks at Ally.
  assert.ok(!links.some(link => PROVIDER_SIGNUPS.test(link.url)))
})

test('the match step links to the workplace plan and the autopay step to the lender', () => {
  const steps = planFor(midCareer)
  const match = steps.find(step => step.intentKey.startsWith('capture.employer_match'))
  assert.deepEqual(stepLinks(match, midCareer).map(link => link.label), ['Change your contribution at Fidelity'])
  const autopay = steps.find(step => step.intentKey === 'setup.autopay_minimums')
  assert.deepEqual(stepLinks(autopay, midCareer).map(link => link.label), ['Autopay for Car loan at Toyota Financial'])
})

test('a step that needs an account opened lists where to open it first, then where to send from', () => {
  const records = {
    profile: { monthly_income: 2600, monthly_expenses: 2100, health_insurance: 'parents', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 'chk', name: 'Chase Checking', institution: 'Chase', type: 'checking', subtype: 'checking', balance: 450 }],
    debts: [{ id: 'visa', name: 'Visa', lender: 'Capital One', balance: 2800, interest_rate: 27.9, minimum_payment: 75 }],
  }
  const move = planFor(records).find(step => step.intentKey === 'fund.emergency_reserve')
  const links = stepLinks(move, records)
  assert.equal(links.length, 3)
  assert.ok(PROVIDER_SIGNUPS.test(links[0].url), 'opening comes first')
  assert.equal(links.at(-1).label, 'Send from Chase Checking')
})

test('the health step links to HealthCare.gov and describes an errand, not a field in this app', () => {
  const records = {
    profile: { employment_type: 'freelance', monthly_income: 4800, monthly_expenses: 3500, health_insurance: 'none', employer_401k: 'none', onboarding_complete: true },
    accounts: [{ id: 'chk', name: 'Checking', type: 'checking', subtype: 'checking', balance: 7200 }],
    debts: [],
  }
  const health = planFor(records).find(step => step.intentKey === 'choose.health_insurance')
  assert.equal(health.text, 'Pick a health plan on HealthCare.gov')
  assert.ok(!/record/i.test(`${health.text} ${health.doneWhen}`))
  assert.match(health.detail, /\$1,300\/mo stays unassigned/)
  assert.deepEqual(stepLinks(health, records).map(link => link.url), ['https://www.healthcare.gov/'])
})

test('a goal is saved in the high-yield account the user has, or linked to open one', () => {
  const goal = { id: 'g', name: 'House', goal_type: 'purchase', target_amount: 40000, current_amount: 5000 }
  const step = { intentKey: 'fund.goal.g', text: 'Move $3,000/mo toward House', outcome: { kind: 'contribution', amount: 3000, goalId: 'g', recurrence: 'monthly' } }
  const withoutHysa = stepLinks(step, { accounts: [], debts: [], goals: [goal] })
  assert.ok(withoutHysa.every(link => PROVIDER_SIGNUPS.test(link.url)))
  const withHysa = stepLinks(step, { accounts: [{ id: 'm', name: 'Marcus Savings', institution: 'Marcus', subtype: 'hysa' }], debts: [], goals: [goal] })
  assert.deepEqual(withHysa.map(link => link.label), ['Marcus Savings'])
})

test('stopping a standing order links to where it was set up, never to a provider', () => {
  const step = {
    intentKey: 'stop.setup.pay.debt.card', text: 'Stop the scheduled $700 monthly payment to Freedom card',
    outcome: { kind: 'information_only', debtId: 'card', sourceAccountId: 'chk' },
    basis: { recordType: 'debt', recordId: 'card' },
  }
  const records = {
    accounts: [{ id: 'chk', name: 'Checking', institution: 'Wells Fargo' }],
    debts: [{ id: 'card', name: 'Freedom card', lender: 'Chase', balance: 0 }],
  }
  assert.deepEqual(stepLinks(step, records).map(link => link.label), [
    'Scheduled payments for Freedom card at Chase',
    'Cancel the scheduled transfer at Wells Fargo',
  ])
})

test('every link is https and the list never exceeds three', () => {
  for (const step of planFor(midCareer)) {
    const links = stepLinks(step, midCareer)
    assert.ok(links.length <= 3)
    for (const link of links) assert.match(link.url, /^https:\/\//)
  }
})

test('progress is read from live balances, so it moves when the records do', () => {
  const step = { intentKey: 'fund.emergency_reserve', outcome: { kind: 'transfer', amount: 500, targetAmount: 1000, recurrence: 'monthly' } }
  const accounts = [
    { id: 'chk', type: 'checking', subtype: 'checking', balance: 300 },
    { id: 'sav', type: 'savings', subtype: 'hysa', balance: 150 },
    // A CD is cash but not liquid, so it is not the cushion.
    { id: 'cd', type: 'savings', subtype: 'cd', balance: 5000 },
  ]
  const now = stepProgress(step, { accounts })
  assert.equal(now.label, '$450 of $1,000')
  assert.equal(now.percent, 45)
  assert.equal(now.eta, 'about 2 months to go')

  accounts[1].balance = 700
  const later = stepProgress(step, { accounts })
  assert.equal(later.complete, true)
  assert.equal(later.label, 'Your cushion reached $1,000')
})

test('debt progress counts what has been paid since the step was set, and knows when it is over', () => {
  const step = {
    intentKey: 'pay.debt.visa',
    outcome: { kind: 'debt_payment', amount: 500, debtId: 'visa', recurrence: 'monthly' },
    basis: { recordType: 'debt', recordId: 'visa', balance: 2800 },
  }
  const debts = [{ id: 'visa', name: 'Visa', balance: 1400, interest_rate: 27.9, minimum_payment: 75 }]
  const halfway = stepProgress(step, { debts })
  assert.equal(halfway.label, '$1,400 left on Visa')
  assert.equal(halfway.percent, 50)
  assert.equal(halfway.eta, 'about 3 months to go')
  debts[0].balance = 0
  assert.equal(stepProgress(step, { debts }).label, 'Visa is paid off')
})

test('goal progress follows the goal record, not the numbers on the day of approval', () => {
  const step = { intentKey: 'fund.goal.trip', outcome: { kind: 'contribution', amount: 250, goalId: 'trip', recurrence: 'monthly' } }
  const goals = [{ id: 'trip', name: 'Japan trip', target_amount: 4000, current_amount: 1000 }]
  assert.equal(stepProgress(step, { goals }).label, '$1,000 of $4,000')
  assert.equal(stepProgress(step, { goals }).eta, 'about 12 months to go')
})

test('automation, setup, habits and open-ended investing have no progress bar', () => {
  assert.equal(stepProgress({ intentKey: 'setup.fund.emergency_reserve', outcome: { kind: 'recurring_setup', amount: 500 } }, {}), null)
  assert.equal(stepProgress({ intentKey: 'habit.weekly_checkin', outcome: { kind: 'information_only' } }, {}), null)
  assert.equal(stepProgress({ intentKey: 'fund.investment.roth', outcome: { kind: 'contribution', amount: 625, destinationAccountId: 'roth', recurrence: 'monthly' } }, { accounts: [] }), null)
  assert.equal(stepProgress({ intentKey: 'fund.emergency_reserve', done: true, outcome: { kind: 'transfer', amount: 500, targetAmount: 1000 } }, {}), null)
})

test('the guide is told which banks, which accounts, and that a debt amount is extra', () => {
  const steps = planFor({
    ...midCareer,
    debts: [{ id: 'visa', name: 'Visa', lender: 'Capital One', balance: 4000, interest_rate: 24, minimum_payment: 90 }],
    accounts: midCareer.accounts.filter(account => account.id !== 'k'),
    profile: { ...midCareer.profile, employer_401k: 'none' },
  })
  const debtStep = steps.find(step => step.intentKey === 'pay.debt.visa')
  const facts = stepFactsForGuide(debtStep, { ...midCareer, debts: [{ id: 'visa', name: 'Visa', lender: 'Capital One', balance: 4000, interest_rate: 24, minimum_payment: 90 }] })
  assert.match(facts, /^THIS STEP:/)
  assert.match(facts, /From: Checking at Chase/)
  assert.match(facts, /Debt: Visa with Capital One — balance \$4,000 at 24%, minimum \$90\. The amount above is extra, on top of the minimum\./)
})
