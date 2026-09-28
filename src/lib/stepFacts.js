import { payoffMonths } from './finance.js'
import { accountFamily, inferLiquidity } from './moneyModel.js'
import { registryLinksFor } from './providerLinks.js'

// What a saved step means in terms of the user's own records, resolved fresh
// every time it is shown. A step stores ids and the numbers it was sized on;
// everything a person acts on — which bank to open, how far along they are,
// how long is left — is read from the records as they are today, so it moves
// when the balances do instead of freezing on the day the plan was approved.

const num = value => Number(value) || 0
const money = value => `$${Math.round(num(value)).toLocaleString()}`

// Home pages only. A deep link to a transfer screen breaks the day a bank
// redesigns, and a signed-in user lands on their dashboard from the home
// page anyway. Matched against the institution/lender a user typed, then the
// account or debt name ("Chase Freedom", "Ally Savings").
const INSTITUTIONS = [
  { name: 'Chase', match: /\bchase\b/i, url: 'https://www.chase.com/' },
  { name: 'Bank of America', match: /bank of america|\bbofa\b/i, url: 'https://www.bankofamerica.com/' },
  { name: 'Wells Fargo', match: /wells fargo/i, url: 'https://www.wellsfargo.com/' },
  { name: 'Citi', match: /\bciti(?:bank)?\b/i, url: 'https://www.citi.com/' },
  { name: 'Capital One', match: /capital one|\bcapone\b/i, url: 'https://www.capitalone.com/' },
  { name: 'Ally', match: /\bally\b/i, url: 'https://www.ally.com/' },
  { name: 'Marcus', match: /\bmarcus\b/i, url: 'https://www.marcus.com/' },
  { name: 'SoFi', match: /\bsofi\b/i, url: 'https://www.sofi.com/' },
  { name: 'Discover', match: /\bdiscover\b/i, url: 'https://www.discover.com/' },
  { name: 'American Express', match: /american express|\bamex\b/i, url: 'https://www.americanexpress.com/' },
  { name: 'U.S. Bank', match: /\bu\.?\s?s\.? bank\b|\busbank\b/i, url: 'https://www.usbank.com/' },
  { name: 'PNC', match: /\bpnc\b/i, url: 'https://www.pnc.com/' },
  { name: 'Truist', match: /\btruist\b/i, url: 'https://www.truist.com/' },
  { name: 'Navy Federal', match: /navy federal|\bnfcu\b/i, url: 'https://www.navyfederal.org/' },
  { name: 'USAA', match: /\busaa\b/i, url: 'https://www.usaa.com/' },
  { name: 'Synchrony', match: /\bsynchrony\b/i, url: 'https://www.synchrony.com/' },
  { name: 'Apple Card', match: /apple card/i, url: 'https://card.apple.com/' },
  { name: 'Chime', match: /\bchime\b/i, url: 'https://www.chime.com/' },
  { name: 'Fidelity', match: /\bfidelity\b/i, url: 'https://www.fidelity.com/' },
  { name: 'Schwab', match: /\bschwab\b/i, url: 'https://www.schwab.com/' },
  { name: 'Vanguard', match: /\bvanguard\b/i, url: 'https://investor.vanguard.com/' },
  { name: 'Empower', match: /\bempower\b/i, url: 'https://www.empower.com/' },
  { name: 'T. Rowe Price', match: /t\.?\s?rowe/i, url: 'https://www.troweprice.com/' },
  { name: 'Robinhood', match: /\brobinhood\b/i, url: 'https://robinhood.com/' },
  { name: 'Wealthfront', match: /\bwealthfront\b/i, url: 'https://www.wealthfront.com/' },
  { name: 'Betterment', match: /\bbetterment\b/i, url: 'https://www.betterment.com/' },
  { name: 'MOHELA', match: /\bmohela\b/i, url: 'https://www.mohela.com/' },
  { name: 'Nelnet', match: /\bnelnet\b/i, url: 'https://nelnet.studentaid.gov/' },
  { name: 'Aidvantage', match: /\baidvantage\b/i, url: 'https://aidvantage.studentaid.gov/' },
  { name: 'Toyota Financial', match: /\btoyota\b/i, url: 'https://www.toyotafinancial.com/' },
]

// The field the user filled in for this purpose wins over a name that merely
// contains a bank's name.
export function institutionFor(record) {
  if (!record) return null
  for (const field of [record.institution, record.lender, record.name]) {
    const value = String(field || '').trim()
    if (!value) continue
    const found = INSTITUTIONS.find(entry => entry.match.test(value))
    if (found) return { name: found.name, url: found.url }
  }
  return null
}

function byId(list, id) {
  return id ? (list || []).find(record => record?.id === id) || null : null
}

// The records a step acts on. Some are named by the outcome (where the money
// goes); some only by the basis the step was sized against.
export function stepRecords(step, { accounts = [], debts = [], goals = [] } = {}) {
  const outcome = step?.outcome || {}
  const basis = step?.basis || {}
  const intent = step?.intentKey || ''
  const records = {
    source: byId(accounts, outcome.sourceAccountId),
    destination: byId(accounts, outcome.destinationAccountId)
      || (basis.recordType === 'account' ? byId(accounts, basis.recordId) : null),
    debt: byId(debts, outcome.debtId) || (basis.recordType === 'debt' ? byId(debts, basis.recordId) : null),
    goal: byId(goals, outcome.goalId) || (basis.recordType === 'goal' ? byId(goals, basis.recordId) : null),
    debts: [],
    workplace: null,
  }
  if (intent === 'setup.autopay_minimums') {
    const ids = Array.isArray(outcome.debtIds) ? outcome.debtIds : []
    records.debts = (ids.length ? ids.map(id => byId(debts, id)).filter(Boolean) : debts)
      .filter(debt => num(debt.balance) > 0)
  }
  if (intent.startsWith('capture.employer_match')) {
    records.workplace = records.destination
    records.destination = null
  }
  // Moving idle savings out: the recorded account is where the money leaves,
  // not where it is going.
  if (intent.startsWith('move.savings_to_hysa')) records.destination = null
  if (records.source && records.destination && records.source.id === records.destination.id) records.source = null
  return records
}

const MONEY_MOVES = new Set(['transfer', 'contribution', 'debt_payment', 'recurring_setup'])

function isOpening(step) {
  const intent = step?.intentKey || ''
  return step?.outcome?.kind === 'account_opening' || intent.startsWith('open.') || intent.startsWith('move.savings_to_hysa')
}

/**
 * Where tapping a step's links should take the user — ordered by where the
 * work actually happens.
 *
 * A step that moves money into an account the user already has links to that
 * account's bank. It never offers "open a savings account" at three other
 * banks; the old text-keyword registry did, because "emergency fund" matched
 * the savings entry whether or not the user already had one.
 */
export function stepLinks(step, records = {}, { limit = 3 } = {}) {
  if (!step) return []
  const resolved = stepRecords(step, records)
  const kind = step.outcome?.kind
  const opening = isOpening(step)
  const own = []
  const toOpen = []
  // "Send from Checking at Chase"; an account already named for its bank
  // ("Ally Savings") does not repeat it.
  const add = (list, institution, label) => {
    if (!institution) return
    const text = label.charAt(0).toUpperCase() + label.slice(1)
    const named = text.toLowerCase().includes(institution.name.toLowerCase())
    list.push({ label: named ? text : `${text} at ${institution.name}`, url: institution.url })
  }

  // Cancelling a standing order happens where it was set up — never a
  // provider's sign-up page.
  const stopping = (step.intentKey || '').startsWith('stop.')

  for (const debt of resolved.debts) add(own, institutionFor(debt), `autopay for ${debt.name}`)
  if (resolved.debt) add(own, institutionFor(resolved.debt), stopping ? `scheduled payments for ${resolved.debt.name}` : `pay ${resolved.debt.name}`)
  if (resolved.workplace) add(own, institutionFor(resolved.workplace), 'change your contribution')
  if (resolved.source && (stopping || MONEY_MOVES.has(kind) || (opening && num(step.outcome?.amount) > 0))) {
    add(own, institutionFor(resolved.source), stopping ? 'cancel the scheduled transfer' : `send from ${resolved.source.name}`)
  }
  if (resolved.destination && !opening) add(own, institutionFor(resolved.destination), resolved.destination.name)

  const intoExisting = stopping || (!opening && Boolean(resolved.destination || resolved.debt || resolved.workplace || resolved.debts.length))
  if (!intoExisting) {
    if (resolved.goal && resolved.goal.goal_type !== 'investment') {
      // The goal step says to keep dated money in high-yield savings. If one
      // exists, that is where it goes; only otherwise is opening one the link.
      const hysa = (records.accounts || []).find(account => String(account.subtype).toLowerCase() === 'hysa')
      if (hysa) add(own, institutionFor(hysa), hysa.name)
      else toOpen.push(...registryLinksFor('high-yield savings account'))
    } else {
      toOpen.push(...registryLinksFor(step.text || ''))
    }
  }

  // Where to open comes before where to send from: the account has to exist
  // before anything can be sent into it. Two provider choices are enough when
  // the user's own bank also needs a place in the short list.
  const openShare = own.length ? Math.max(2, limit - own.length) : limit
  const links = [...toOpen.slice(0, openShare), ...own]
  for (const resource of Array.isArray(step.resources) ? step.resources : []) {
    if (resource?.url && /^https?:\/\//i.test(resource.url)) {
      links.push({ label: resource.label || resource.url, url: resource.url, note: resource.note || null })
    }
  }

  const seen = new Set()
  return links.filter(link => {
    if (seen.has(link.url)) return false
    seen.add(link.url)
    return true
  }).slice(0, limit)
}

function liquidCash(accounts = []) {
  return accounts
    .filter(account => accountFamily(account) === 'cash' && inferLiquidity(account))
    .reduce((sum, account) => sum + num(account.balance), 0)
}

function monthsLabel(months) {
  const value = Math.max(1, Math.ceil(num(months)))
  if (value === 1) return 'about a month to go'
  if (value < 24) return `about ${value} months to go`
  if (value > 120) return 'over 10 years to go'
  return `about ${Math.round(value / 12)} years to go`
}

// "Jun 2029" from the date a goal was given.
function monthLabel(isoDate) {
  const match = /^(\d{4})-(\d{2})/.exec(String(isoDate || ''))
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return match && names[Number(match[2]) - 1] ? `${names[Number(match[2]) - 1]} ${match[1]}` : null
}

function savingsProgress(current, target, monthly, name, deadline = null) {
  if (!(target > 0)) return null
  const remaining = Math.max(0, target - current)
  const percent = Math.min(100, Math.round((Math.max(0, current) / target) * 100))
  if (remaining <= 0) {
    return { current, target, remaining: 0, percent: 100, complete: true, label: `${name ? `${name} ` : ''}reached ${money(target)}`, eta: null }
  }
  const pace = monthly > 0 ? monthsLabel(remaining / monthly) : null
  const due = monthLabel(deadline)
  return {
    current, target, remaining, percent, complete: false,
    label: `${money(current)} of ${money(target)}`,
    eta: [pace, due ? `target ${due}` : null].filter(Boolean).join(' · ') || null,
  }
}

/**
 * Live distance to a step's finish line, from the records as they are now.
 * Null for steps with no finish line: automation, setup, habits, and
 * investing, which has a pace but no end.
 */
export function stepProgress(step, { accounts = [], debts = [], goals = [] } = {}) {
  if (!step || step.done) return null
  const outcome = step.outcome || {}
  const intent = step.intentKey || ''
  if (intent.startsWith('setup.') || !MONEY_MOVES.has(outcome.kind)) return null
  const monthly = num(outcome.amount)

  if (outcome.kind === 'debt_payment' && outcome.debtId) {
    const debt = byId(debts, outcome.debtId)
    if (!debt) return null
    const balance = Math.max(0, num(debt.balance))
    const start = Math.max(balance, num(step.basis?.balance))
    if (balance <= 0) {
      return { current: start, target: start, remaining: 0, percent: 100, complete: true, label: `${debt.name} is paid off`, eta: null }
    }
    const paid = start - balance
    const months = payoffMonths(balance, debt.interest_rate, monthly + num(debt.minimum_payment))
    return {
      current: paid, target: start, remaining: balance, complete: false,
      percent: start > 0 ? Math.min(100, Math.round((paid / start) * 100)) : 0,
      label: `${money(balance)} left on ${debt.name}`,
      eta: months ? monthsLabel(months) : null,
    }
  }

  if (outcome.goalId) {
    const goal = byId(goals, outcome.goalId)
    if (!goal) return null
    return savingsProgress(num(goal.current_amount), num(goal.target_amount), monthly, goal.name, goal.deadline)
  }

  if (intent === 'fund.emergency_reserve' && num(outcome.targetAmount) > 0) {
    return savingsProgress(liquidCash(accounts), num(outcome.targetAmount), monthly, 'Your cushion')
  }
  return null
}

function accountLine(label, account) {
  if (!account) return null
  const institution = institutionFor(account)
  return `${label}: ${account.name}${institution ? ` at ${institution.name}` : ''} (balance ${money(account.balance)}).`
}

/**
 * The facts a "how to do this" guide needs to be specific: which accounts,
 * which banks, which amounts. Without them the guide could only say "log into
 * your bank" — with them it can say "in the Ally app, open Transfers".
 */
export function stepFactsForGuide(step, records = {}) {
  if (!step) return ''
  const resolved = stepRecords(step, records)
  const outcome = step.outcome || {}
  const lines = []
  if (num(outcome.amount) > 0) {
    lines.push(`Amount: ${money(outcome.amount)}${outcome.recurrence === 'monthly' ? ' every month' : ''}.`)
  }
  const source = accountLine('From', resolved.source)
  const destination = accountLine('Into', resolved.destination)
  if (source) lines.push(source)
  if (destination) lines.push(destination)
  if (resolved.debt) {
    const debt = resolved.debt
    const lender = institutionFor(debt)
    lines.push(`Debt: ${debt.name}${lender ? ` with ${lender.name}` : ''} — balance ${money(debt.balance)}${debt.interest_rate ? ` at ${num(debt.interest_rate)}%` : ''}${num(debt.minimum_payment) > 0 ? `, minimum ${money(debt.minimum_payment)}` : ''}. The amount above is extra, on top of the minimum.`)
  }
  if (resolved.debts.length) {
    lines.push(`Debts to put on autopay: ${resolved.debts.map(debt => {
      const lender = institutionFor(debt)
      return `${debt.name}${lender ? ` (${lender.name})` : ''} ${num(debt.minimum_payment) > 0 ? `${money(debt.minimum_payment)} minimum` : 'minimum on the statement'}`
    }).join('; ')}.`)
  }
  if (resolved.workplace) {
    const account = resolved.workplace
    const provider = institutionFor(account)
    lines.push(`Workplace plan: ${account.name}${provider ? ` at ${provider.name}` : ''} — contributing ${num(account.contribution_percent)}%, employer matches up to ${num(account.employer_match_limit_percent)}%.`)
  }
  if (resolved.goal) {
    const goal = resolved.goal
    lines.push(`Goal: ${goal.name} — ${money(goal.current_amount)} saved of ${money(goal.target_amount)}${goal.deadline ? `, target date ${goal.deadline}` : ''}.`)
  }
  const progress = stepProgress(step, records)
  if (progress && !progress.complete && !resolved.debt && !resolved.goal) {
    lines.push(`Finish line: ${money(progress.target)} (currently ${money(progress.current)}).`)
  }
  return lines.length ? `THIS STEP:\n${lines.join('\n')}` : ''
}
