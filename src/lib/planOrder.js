// One shared ordering for plan steps, so the Plan page's "Up next" card and the
// Dashboard peek never disagree about what to do first:
//   1. overdue (soonest first)
//   2. due within 14 days (soonest first)
//   3. the financial priority ladder below (keyword match on the step text —
//      mirrors the finance engine's next-dollar priority and the advisor's
//      diagnostic checklist)
//   4. insertion order (Array.prototype.sort is stable)
//
// The ladder is deliberately one table in one file: tuning it is a one-line
// change and can never fork between surfaces.
const LADDER = [
  { rank: 0, re: /health insurance|uninsured/i },
  { rank: 1, re: /deficit|overspend|spending more than|cut (back|spending)|trim (my )?(spending|expenses)/i },
  { rank: 2, re: /starter emergency|\$1,?000 emergency/i },
  { rank: 3, re: /credit card|high[- ]interest|apr|pay(ing)? off|payoff|debt/i },
  { rank: 4, re: /401\s?\(?k\)?|employer match|full match/i },
  { rank: 5, re: /emergency fund|hysa|high[- ]yield|cushion|months of expenses/i },
  { rank: 6, re: /roth|\bira\b|invest|index fund|brokerage/i },
  { rank: 7, re: /automat|auto[- ]transfer|payday/i },
]

function ladderRank(text = '') {
  for (const l of LADDER) if (l.re.test(text)) return l.rank
  return 9
}

export function orderSteps(steps = []) {
  const today = new Date().toISOString().slice(0, 10)
  const soon  = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const bucket = s => !s.due ? 2 : s.due < today ? 0 : s.due <= soon ? 1 : 2
  return [...steps].sort((a, b) => {
    const ba = bucket(a), bb = bucket(b)
    if (ba !== bb) return ba - bb
    if (ba < 2 && a.due !== b.due) return a.due < b.due ? -1 : 1
    return ladderRank(a.text) - ladderRank(b.text)
  })
}
