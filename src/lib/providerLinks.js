// ─── Curated provider registry ──────────────────────────────────────────────────
// Hand-verified official links for the actions this app most often recommends.
// These are DETERMINISTIC — a step about opening a Roth IRA always gets the real
// Fidelity/Schwab/Vanguard pages, never a model-remembered URL. The model's own
// links (guide resources, web-search citations) complement these; this registry
// is the guaranteed-correct floor.
//
// One place to update when a provider moves a page.

const REGISTRY = [
  {
    id: 'roth_ira',
    match: /roth ira|\broth\b/i,
    links: [
      { label: 'Fidelity — open a Roth IRA', url: 'https://www.fidelity.com/retirement-ira/roth-ira', note: 'no minimums, no fees' },
      { label: 'Schwab — Roth IRA', url: 'https://www.schwab.com/ira/roth-ira' },
      { label: 'Vanguard — Roth IRA', url: 'https://investor.vanguard.com/accounts-plans/iras/roth-ira' },
    ],
  },
  {
    id: 'traditional_ira',
    match: /traditional ira/i,
    links: [
      { label: 'Fidelity — Traditional IRA', url: 'https://www.fidelity.com/retirement-ira/traditional-ira' },
      { label: 'Schwab — Traditional IRA', url: 'https://www.schwab.com/ira/traditional-ira' },
    ],
  },
  {
    id: 'hysa',
    match: /high[- ]yield|hysa|savings account|emergency fund|cash cushion|starter emergency/i,
    links: [
      { label: 'Ally — savings account', url: 'https://www.ally.com/bank/online-savings-account/', note: 'consistently top APY' },
      { label: 'Marcus — savings', url: 'https://www.marcus.com/us/en/savings/high-yield-savings' },
      { label: 'SoFi — savings', url: 'https://www.sofi.com/banking/savings-account/' },
    ],
  },
  {
    id: 'brokerage',
    match: /brokerage|index fund|start investing|taxable account/i,
    links: [
      { label: 'Fidelity — open an account', url: 'https://www.fidelity.com/open-account/overview', note: 'best app for beginners' },
      { label: 'Vanguard — brokerage', url: 'https://investor.vanguard.com/accounts-plans/brokerage-accounts' },
    ],
  },
  {
    id: 'hsa',
    match: /\bhsa\b|health savings account/i,
    links: [
      { label: 'Fidelity — HSA', url: 'https://www.fidelity.com/go/hsa/why-hsa', note: 'no fees, investable' },
    ],
  },
  {
    id: 'health_insurance',
    match: /health insurance|uninsured|medical coverage|aca|marketplace plan/i,
    links: [
      { label: 'Healthcare.gov — get covered', url: 'https://www.healthcare.gov/', note: 'official ACA marketplace' },
    ],
  },
  {
    id: 'credit_report',
    match: /credit report|credit score|credit check|freeze.*credit|credit.*freeze/i,
    links: [
      { label: 'AnnualCreditReport.com', url: 'https://www.annualcreditreport.com/', note: 'the official free reports' },
    ],
  },
  {
    id: 'student_loans',
    match: /student loan|fafsa|income[- ]driven|loan forgiveness/i,
    links: [
      { label: 'StudentAid.gov', url: 'https://studentaid.gov/', note: 'official federal loan portal' },
    ],
  },
  {
    id: 'i_bonds_treasury',
    match: /i[- ]bonds?|treasury|t[- ]bills?/i,
    links: [
      { label: 'TreasuryDirect', url: 'https://www.treasurydirect.gov/', note: 'buy direct from the US Treasury' },
    ],
  },
  {
    id: 'tax_filing',
    match: /file (?:my |your )?taxes|tax return|irs free file/i,
    links: [
      { label: 'IRS Free File', url: 'https://www.irs.gov/filing/irs-free-file-do-your-taxes-for-free' },
    ],
  },
]

// Official links relevant to a step/goal text. Returns [] when nothing matches —
// most steps ("track spending", "ask HR about the match") have no signup page.
export function registryLinksFor(text = '') {
  const matched = REGISTRY.filter(entry => entry.match.test(text))
  const seen = new Set()
  const links = []
  for (const entry of matched) {
    for (const link of entry.links) {
      if (seen.has(link.url)) continue
      seen.add(link.url)
      links.push(link)
    }
  }
  return links.slice(0, 4)   // never a wall of links
}

// Merge registry links with model/search-provided resources, registry first,
// deduped by URL.
export function mergeResources(text, existing = []) {
  const seen = new Set()
  const merged = []
  for (const r of [...registryLinksFor(text), ...(existing || [])]) {
    if (!r?.url || seen.has(r.url)) continue
    seen.add(r.url)
    merged.push(r)
  }
  return merged
}
