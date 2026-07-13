// Completing a step updates the durable profile facts that the work proves.
// The rest of the app reads these facts, not just the plan checkbox.
export function profilePatchForCompletedStep(stepText, profile) {
  const text = (stepText || '').toLowerCase()
  const patch = {}

  // Got covered. Prefer an explicit source in the step; otherwise use the most
  // plausible option so the profile records that they are no longer uninsured.
  const coverageAction = /(?:get|obtain|secure|buy|purchase|enroll|sign up|activate).{0,60}(?:health insurance|health plan|medical coverage|healthcare\.gov|aca|marketplace)/
  if (coverageAction.test(text) &&
      (!profile?.health_insurance || profile.health_insurance === 'none')) {
    if (/parent(?:s|'s)? (?:plan|insurance)|on (?:my )?parents/.test(text)) {
      patch.health_insurance = 'parents'
    } else if (/healthcare\.gov|aca|marketplace/.test(text)) {
      patch.health_insurance = 'marketplace'
    } else if (/through (?:my )?work|employer|benefits/.test(text)) {
      patch.health_insurance = 'employer'
    } else {
      patch.health_insurance = profile?.employment_type === 'w2' ? 'employer' : 'marketplace'
    }
  }

  // Record a newly opened account and remove the mutually exclusive "none"
  // answer. This also makes the 401(k)-match priority ladder advance.
  const types = Array.isArray(profile?.investment_types) ? profile.investment_types : []
  const withoutNone = types.filter(type => type !== 'none')
  let completedInvestment = null
  if (/roth ira/.test(text)) completedInvestment = 'roth_ira'
  else if (/traditional ira/.test(text)) completedInvestment = 'trad_ira'
  else if (/\bhsa\b/.test(text)) completedInvestment = 'hsa'
  else if (/brokerage|index fund/.test(text)) completedInvestment = 'brokerage'
  else if (/401\s*\(?k\)?|403\s*\(?b\)?|employer match|full match/.test(text)) completedInvestment = '401k'

  if (completedInvestment && !withoutNone.includes(completedInvestment)) {
    patch.investment_types = [...withoutNone, completedInvestment]
  }

  return Object.keys(patch).length ? patch : null
}

// Fold old completed steps into one patch. Applying each result to the working
// profile preserves multiple account facts (for example, Roth IRA plus 401(k)).
export function profilePatchForCompletedSteps(stepTexts = [], profile) {
  let working = profile || {}
  let combined = {}

  for (const text of stepTexts) {
    const patch = profilePatchForCompletedStep(text, working)
    if (!patch) continue
    combined = { ...combined, ...patch }
    working = { ...working, ...patch }
  }

  return Object.keys(combined).length ? combined : null
}

// A fact-backed nudge should stay quiet while its action is already represented
// in the plan. Completed steps count: finished work should not be suggested again.
const SUGGESTION_PLAN_PATTERNS = {
  deficit: [
    /spend(?:ing)? more than (?:i |you )?earn/,
    /cash[ -]?flow/,
    /budget deficit/,
    /cut (?:my |your )?(?:spending|expenses)/,
  ],
  insurance: [
    /health insurance/,
    /healthcare\.gov/,
    /aca(?: marketplace)?/,
    /medical coverage/,
    /uninsured/,
  ],
  efund: [/emergency fund/, /rainy day fund/, /cash (?:cushion|buffer)/],
  debt: [/pay(?:ing)? off .*debt/, /debt pay(?:off|down)/, /credit card payoff/, /avalanche/],
  match: [/401\s*\(?k\)?.*match/, /403\s*\(?b\)?.*match/, /employer match/, /full match/],
  roth: [/roth ira/, /traditional ira/, /open an? ira/, /start investing/],
  automate: [
    /automat\w*.*?(?:saving|savings|transfer)/,
    /recurring transfer/,
    /transfer .* on payday/,
  ],
  firstgoal: [/set (?:a |my |your )?(?:saving|savings|financial)? ?goal/, /create (?:a |my |your )?goal/],
}

function normalizedWords(text) {
  return new Set((text || '')
    .toLowerCase()
    .replace(/\$?[\d,.]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2))
}

function sameTask(a, b) {
  const left = normalizedWords(a)
  const right = normalizedWords(b)
  if (!left.size || !right.size) return false
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / Math.min(left.size, right.size) >= 0.6
}

export function suggestionAlreadyInPlan(suggestion, plans = []) {
  const stepTexts = plans.flatMap(plan =>
    Array.isArray(plan?.steps) ? plan.steps.map(step => step?.text || '').filter(Boolean) : [],
  )
  if (!stepTexts.length) return false

  const patterns = SUGGESTION_PLAN_PATTERNS[suggestion?.id] || []
  if (patterns.some(pattern => stepTexts.some(text => pattern.test(text.toLowerCase())))) return true

  const taskText = suggestion?.action?.kind === 'task' ? suggestion.action.text : ''
  return Boolean(taskText && stepTexts.some(text => sameTask(text, taskText)))
}
