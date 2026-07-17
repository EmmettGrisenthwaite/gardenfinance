// Compact situation snapshot for the AI "how to do this" guides — every dollar
// amount the guide writes comes from here. Existing accounts and insurance
// status matter as much as the numbers: a guide must never tell someone to
// OPEN an account they already have.
// Shared by the Plan page (goal cards) and the step detail page.

const INVEST_LABELS = { roth_ira: 'Roth IRA', trad_ira: 'Traditional IRA', '401k': '401(k)', brokerage: 'brokerage account', hsa: 'HSA' }

export function buildHowToContext({ profile, debts = [], accounts = [], goals = [], income, expenses, netWorth }) {
  const inc = income  ?? (Number(profile?.monthly_income)   || 0)
  const exp = expenses ?? (Number(profile?.monthly_expenses) || 0)
  const nw  = netWorth ?? (Number(profile?.net_worth)        || 0)
  const investTypes = Array.isArray(profile?.investment_types) ? profile.investment_types.filter(t => t !== 'none') : []
  // Variable income (freelance/gig) needs a bigger cushion — same rule as the
  // finance engine's efTargetMonths.
  const efMonths = ['freelance', 'other'].includes(profile?.employment_type) ? 6 : 3

  return [
    `Monthly income $${inc.toLocaleString()}, expenses $${exp.toLocaleString()} (surplus $${(inc - exp).toLocaleString()}/mo).`,
    `Net worth $${nw.toLocaleString()}.`,
    profile?.age ? `Age ${profile.age}.` : '',
    profile?.employment_type ? `Employment: ${profile.employment_type}.` : '',
    exp > 0
      ? `Emergency fund target: ${efMonths} months of expenses ($${(exp * efMonths).toLocaleString()})${efMonths === 6 ? ' because income varies' : ''}.`
      : '',
    investTypes.length
      ? `ALREADY HAS these accounts (do not suggest opening them again): ${investTypes.map(t => INVEST_LABELS[t] ?? t).join(', ')}.`
      : 'No investment accounts yet.',
    profile?.health_insurance === 'none' ? 'No health insurance.'
      : profile?.health_insurance ? 'Has health insurance.' : '',
    profile?.employer_401k === 'match' ? 'Employer 401(k) match available.' : '',
    debts.length
      ? `Debts: ${debts.map(d => `${d.name} $${Number(d.balance).toLocaleString()}${d.interest_rate ? ` @ ${d.interest_rate}%` : ''}`).join(', ')}.`
      : 'No debts.',
    accounts.length
      ? `Recorded accounts: ${accounts.map(account => `${account.name || account.subtype || account.type} $${Number(account.balance || 0).toLocaleString()}${account.interest_rate != null ? ` @ ${Number(account.interest_rate)}%` : ''}`).join(', ')}.`
      : '',
    goals.length
      ? `Active goals: ${goals.filter(goal => Number(goal.current_amount) < Number(goal.target_amount)).map(goal => `${goal.name} $${Number(goal.current_amount || 0).toLocaleString()} of $${Number(goal.target_amount || 0).toLocaleString()}`).join(', ')}.`
      : '',
  ].filter(Boolean).join(' ')
}
