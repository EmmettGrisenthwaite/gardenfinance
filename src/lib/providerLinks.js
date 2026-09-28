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
      { label: 'Open a Roth IRA at Fidelity', url: 'https://www.fidelity.com/retirement-ira/roth-ira', note: 'no minimums, no fees' },
      { label: 'Roth IRA at Schwab', url: 'https://www.schwab.com/ira/roth-ira' },
      { label: 'Roth IRA at Vanguard', url: 'https://investor.vanguard.com/accounts-plans/iras/roth-ira' },
    ],
  },
  {
    id: 'traditional_ira',
    match: /traditional ira/i,
    links: [
      { label: 'Traditional IRA at Fidelity', url: 'https://www.fidelity.com/retirement-ira/traditional-ira' },
      { label: 'Traditional IRA at Schwab', url: 'https://www.schwab.com/ira/traditional-ira' },
    ],
  },
  {
    id: 'hysa',
    match: /high[- ]yield|hysa|savings account|emergency fund|cash cushion|starter emergency/i,
    links: [
      { label: 'Savings account at Ally', url: 'https://www.ally.com/bank/online-savings-account/', note: 'consistently top APY' },
      { label: 'Savings at Marcus', url: 'https://www.marcus.com/us/en/savings/high-yield-savings' },
      { label: 'Savings at SoFi', url: 'https://www.sofi.com/banking/savings-account/' },
    ],
  },
  {
    id: 'brokerage',
    match: /brokerage|index fund|start investing|taxable account/i,
    links: [
      { label: 'Open an account at Fidelity', url: 'https://www.fidelity.com/open-account/overview', note: 'best app for beginners' },
      { label: 'Brokerage account at Vanguard', url: 'https://investor.vanguard.com/accounts-plans/brokerage-accounts' },
    ],
  },
  {
    id: 'hsa',
    match: /\bhsa\b|health savings account/i,
    links: [
      { label: 'HSA at Fidelity', url: 'https://www.fidelity.com/go/hsa/why-hsa', note: 'no fees, investable' },
    ],
  },
  {
    id: 'health_insurance',
    match: /health insurance|health plan|healthcare\.gov|uninsured|medical coverage|\baca\b|marketplace plan/i,
    links: [
      { label: 'Get covered on HealthCare.gov', url: 'https://www.healthcare.gov/', note: 'official ACA marketplace' },
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
