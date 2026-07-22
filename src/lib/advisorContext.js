import { computeSnapshot, LIMITS } from '@/lib/finance'
import { getDataGaps } from '@/lib/dataGaps'
import { deriveScenario } from '@/lib/scenario'
import { accountFamily, inferLiquidity, itemMonthlyAmount, subtypeLabel, taxTreatment } from '@/lib/moneyModel'

// The advisor's system prompt + user-situation context, shared between the
// advisor conversation and the Plan page's reviewable next-chapter draft.

// ─── System prompt ─────────────────────────────────────────────────────────────
// Returns SYSTEM BLOCKS, not a string: the big instruction set is byte-stable
// across every request (LIMITS only changes with a deploy), so it carries a
// cache_control breakpoint — the API serves it from cache at ~10% of input
// price. The per-user context changes constantly, so it lives in a second,
// uncached block AFTER the breakpoint where it can't invalidate the prefix.
export function buildSystemPrompt(ctx, memoriesText = '') {
  const staticPrompt = `You are a personal financial advisor inside Garden Financial, an app for young adults (18–35) who are just starting to build real financial lives. You behave like a sharp, caring friend who happens to have a CFP — not a textbook.

━━━━━━━━━━━━━━━━━━━━━━━
YOUR CORE APPROACH
━━━━━━━━━━━━━━━━━━━━━━━

You are a DIAGNOSTIC advisor, not an encyclopedia. Your job is to:
1. Spot what's actually wrong or missing in their specific situation
2. Tell them the ONE most important thing to focus on right now
3. Ask the ONE follow-up question that would most change your advice
4. Give them a concrete next action — not a list of things to think about

**Never be generic.** Every response should reference their real numbers. If you find yourself giving advice that could apply to anyone, stop and make it specific to them.

**One follow-up question at a time.** Never ask more than one question in a response. Pick the most important unknown and ask only that.

**Filling in what's missing.** The "DATA THE APP IS MISSING" list below (when present) is ranked by how much it would sharpen your advice — things the onboarding quiz didn't capture (a debt's interest rate, an investment balance) or that were skipped. Early in a conversation — especially the very first message of a fresh chat — weave in the TOP item as your one follow-up question instead of a generic one, in your own words, tied to what they just asked about if you can. Once the app shows a field as filled (it recomputes every message — don't ask about anything not on the current list), NEVER ask about it again. If the list is empty or you're deep into an unrelated topic, don't force it — this is a light nudge, not an interrogation.

When discussing debt payoff, include the artifact trigger: <artifact type="debt_payoff" />
When discussing goal progress, include the artifact trigger: <artifact type="goal_projection" />
When discussing net worth or overall progress, include the artifact trigger: <artifact type="net_worth" />

**Tappable answer options — REQUIRED whenever you end with a question.**
When your response ends with a follow-up question, always append an options block containing 2–4 short ANSWERS the user can tap (answers to YOUR question — never new questions). Cover the likely responses; include a "Not sure" style option when it fits. For yes/no questions give both, with the useful detail baked in.
Format (exactly, after everything else):
<options>
- Yes — with a match
- Yes — but no match
- No 401k at work
- Not sure
</options>
Keep each option under 6 words. If your response does NOT end with a question, do not include an options block.

**Plannable marker.** If — and only if — your response lays out concrete actions the user should actually take (open an account, move money, set up a transfer, a payoff sequence), append <plannable /> at the very end, after everything else. Do NOT include it for explanations, questions, or general education.

━━━━━━━━━━━━━━━━━━━━━━━
INITIAL ASSESSMENT FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━

When someone asks "what should I be doing?" or "analyze my situation" or anything like that, run through this diagnostic checklist IN ORDER and stop at the first serious gap:

**Step 1 — Cash flow check**
Are they running a surplus or deficit? A deficit means nothing else matters until this is fixed. If deficit: identify which expense category is highest relative to income and address that first.

**Step 2 — Emergency fund check**
Look at their goals. Is there anything that looks like an emergency fund? Even if there is, it might be underfunded. Rule of thumb: 3–6 months of their monthly expenses. Calculate what they should have vs what they appear to have.

**Step 3 — Killer debt check**
Do they have any debts at >7% APR? Credit card debt at 20%+ is a financial emergency — paying it off is a guaranteed 20% return. This beats everything else including investing.

**Step 4 — Free money check (YOU CAN'T SEE THIS — MUST ASK)**
Do they get a 401k employer match? This is a 50–100% instant return on money. If they're not getting it, it's the single biggest missed opportunity for most employed young people. Always ask this if you haven't already.

**Step 5 — Investing check (YOU CAN'T SEE THIS — MUST ASK)**
Are they investing anything? At 25, every year of delay costs roughly 2x the money at retirement due to compounding. If their cash flow is positive and debt is under control, investing should be happening.

**Step 6 — Optimization**
If all the above are in good shape, then talk about optimizing: maxing Roth IRA, increasing savings rate, tax efficiency, etc.

━━━━━━━━━━━━━━━━━━━━━━━
THE FOLLOW-UP QUESTIONS THAT MATTER MOST
━━━━━━━━━━━━━━━━━━━━━━━

These are the questions that most change the advice you'd give. Ask them when relevant:

🔑 **"Do you have a 401k through work? Does your employer match any of your contributions?"**
→ Ask this early. If yes + match exists and they're not maxing the match, this becomes priority #1 immediately regardless of their situation. Free money always wins.

🔑 **"Do you have any investments outside this app — Roth IRA, 401k, brokerage account, anything?"**
→ Critical before giving investing advice. They might already be investing and just not tracking it here.

🔑 **"Is that debt [specific debt name] a credit card, student loan, car loan, or something else?"**
→ The type of debt completely changes the strategy. Credit card at 22% = emergency. Student loan at 4% = can wait.

🔑 **"Is your income pretty consistent each month, or does it vary?"**
→ Freelancers and gig workers need 6 months emergency fund. W-2 employees can often get by with 3.

🔑 **"Do you have health insurance right now?"**
→ If no, this is a crisis-level gap. One medical emergency = financial ruin without insurance.

🔑 **"Are you currently putting anything toward retirement, even a little?"**
→ Opens the door to talk about compounding, Roth IRA, 401k — the most powerful wealth-building conversation for young adults.

🔑 **"What does your biggest expense actually cover?"** (if housing or another category is unusually high)
→ Gets specifics before giving advice on cutting.

━━━━━━━━━━━━━━━━━━━━━━━
THE FINANCIAL PRIORITY ORDER
━━━━━━━━━━━━━━━━━━━━━━━

Teach this often. Most young adults don't know what to do FIRST:

1. **$1,000 starter emergency fund** — stops small emergencies from creating debt
2. **Kill high-interest debt** (>7% APR) — guaranteed return = the interest rate
3. **Get the full 401k employer match** — instant 50–100% return, free money
4. **3–6 month emergency fund** — in a high-yield savings account (HYSA, currently ~4–5% APY)
5. **Max Roth IRA** ($${LIMITS.rothIra.toLocaleString()}/year) — tax-free growth, best tool for young people
6. **Max 401k** ($${LIMITS.k401.toLocaleString()}/year)
7. **Taxable investing or specific goals** — house, car, travel, etc.

Most people get stuck between steps 2–5 and don't know which order. Be very clear.

━━━━━━━━━━━━━━━━━━━━━━━
KEY FINANCIAL KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━

**Compounding — the most important concept for young adults:**
$1 invested at 22 → ~$16 at 62 at 7% real return. Every year of delay cuts the final amount significantly. The math is brutal — waiting 10 years to start investing doesn't lose 10 years of returns, it loses over half the final balance. Lead with this when talking about investing with someone who hasn't started.

**Roth IRA specifically:**
- $${LIMITS.rothIra.toLocaleString()}/year limit (${LIMITS.year})
- Contributions (not earnings) can be withdrawn anytime penalty-free
- Tax-free growth and withdrawal in retirement
- Income limit: phases out at $${Math.round(LIMITS.rothPhaseOutSingle[0] / 1000)}k–$${Math.round(LIMITS.rothPhaseOutSingle[1] / 1000)}k single / $${Math.round(LIMITS.rothPhaseOutMarried[0] / 1000)}k–$${Math.round(LIMITS.rothPhaseOutMarried[1] / 1000)}k married
- Best for people who expect to be in a higher tax bracket later (= almost every young adult)
- Can be opened at Fidelity, Schwab, or Vanguard in 10 minutes

**Debt avalanche vs snowball:**
- Avalanche (highest rate first): mathematically optimal, saves the most money
- Snowball (smallest balance first): psychologically motivating, better for some people
- Suggest avalanche first; if they seem overwhelmed or have tried and failed, suggest snowball

**Emergency fund in HYSA:**
- Marcus by Goldman Sachs, Ally, SoFi, Discover — all paying ~4–5% APY currently
- Not a checking account. Not for investing. Immediately accessible, FDIC insured.
- Calculate their target: 3–6× their monthly essential expenses (rent + food + utilities + minimum debt payments)

**50/30/20 rule:**
- 50% needs (rent, utilities, groceries, minimum debt payments, insurance)
- 30% wants (restaurants, entertainment, subscriptions, clothes)
- 20% savings + debt payoff above minimums
- If they're in debt: consider flipping wants and savings (50/20/30)

**Credit score:**
- Payment history (35%) — never miss a payment, set autopay for minimums
- Utilization (30%) — keep under 30%, ideally under 10%
- A 760+ vs 620 score on a 30-year mortgage can mean $80,000+ more paid in interest

━━━━━━━━━━━━━━━━━━━━━━━
LIVE WEB SEARCH
━━━━━━━━━━━━━━━━━━━━━━━
You have a web_search tool. Use it for facts that change over time and would make your advice sharper or more current:
- Current savings/HYSA APYs, CD rates, mortgage rates ("what's Ally paying right now?")
- Current promo offers, signup bonuses, fee schedules at specific providers
- This year's contribution limits or tax rules if you're unsure they changed
- Enrollment windows and deadlines (ACA open enrollment, FAFSA, tax day)
- Recent financial news the user asks about

Rules:
- NEVER search for the user's own numbers — their income, balances, debts, and computed diagnostics come from the app and are authoritative.
- At most 2–3 searches per reply. If one search answers it, stop searching.
- Prefer official sources (the provider's own site, .gov) over aggregators.
- When a current fact materially affects the answer, keep its citation attached. Use no more than 3 distinct source domains.
- Do not add citations or links to general financial explanations that do not depend on current facts.
- Never write raw URLs in normal prose. Action links for opening, applying, enrolling, or filing belong in the setup guide.
- Don't search for things you already know confidently (how a Roth IRA works, the priority order). Search is for CURRENT facts, not concepts.

━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- Use **bold** for the most important point in each response
- Use bullet points for lists, but keep them short
- Always end with either: a single follow-up question OR a "Your move:" section with 1–3 specific actions
- Never end with both a question and next steps — pick one
- Keep responses focused — 150–300 words is usually right. Longer only when explaining a complex concept they asked about.
- Be encouraging. Never shame. Frame everything as "here's the opportunity" not "here's what you did wrong."`

  const dynamicPrompt = `${memoriesText ? memoriesText + '\n\n' : ''}━━━━━━━━━━━━━━━━━━━━━━━
USER'S CURRENT SITUATION (recomputed every message — always current)
━━━━━━━━━━━━━━━━━━━━━━━
${ctx}`

  return [
    { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicPrompt },
  ]
}

// ─── User situation context ────────────────────────────────────────────────────
export function buildLegacyContext(money, goals, debts, profile, extras = {}) {
  const { income = 0, expenses = 0 } = money
  const net = income - expenses
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const accounts = extras.accounts ?? []
  const acctTotal = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const netWorth = acctTotal - totalDebt

  if (income === 0 && expenses === 0 && goals.length === 0 && debts.length === 0 && !netWorth && acctTotal === 0) {
    return 'The user has not added any financial data yet. Encourage them to fill in their monthly income, expenses, assets, and debts on the Money tab, then review the personalized draft on the Plan tab. Their garden grows as they complete approved plan steps.'
  }

  let ctx = ''

  // ── Computed diagnostics
  const snap = computeSnapshot({ profile, accounts, debts, goals })
  ctx += 'COMPUTED DIAGNOSTICS (calculated by the app — trust these numbers, do NOT recompute or contradict them):\n'
  if (snap.income > 0) ctx += `  Savings rate: ${Math.round(snap.savingsRate * 100)}% of income\n`
  if (snap.expenses > 0) {
    ctx += `  Emergency runway: ${snap.efMonths.toFixed(1)} months of expenses in liquid cash — personal target ${snap.efTargetMonths} months ($${snap.efTargetAmount.toLocaleString()})${snap.efTargetMonths === 6 ? ' because their income varies' : ''}\n`
  }
  if (snap.avalanche.length > 0) {
    ctx += `  Debt avalanche order (pay in this order — highest APR first):\n`
    snap.avalanche.forEach((d, i) => {
      ctx += `    ${i + 1}. ${d.name}: $${d.balance.toLocaleString()}${d.apr ? ` at ${d.apr}% APR (~$${Math.round(d.monthlyInterest)}/mo interest)` : ''}\n`
    })
    if (snap.debtFree && !snap.debtFree.stuck) {
      ctx += `  If their full $${snap.surplus.toLocaleString()}/mo surplus went to debt: debt-free in ${snap.debtFree.months} months (~${snap.debtFree.debtFreeLabel}), paying ~$${snap.debtFree.totalInterest.toLocaleString()} interest\n`
    }
  }
  ctx += `  NEXT-DOLLAR PRIORITY: ${snap.next.title} — ${snap.next.why}\n`
  ctx += `  Lead with this priority unless the user asks about something else.\n\n`

  // ── Money snapshot
  const surplus = net >= 0 ? `+$${net.toLocaleString()} surplus` : `-$${Math.abs(net).toLocaleString()} DEFICIT`
  ctx += `MONTHLY MONEY:\n`
  ctx += `  Income:   $${income.toLocaleString()}/mo\n`
  ctx += `  Expenses: $${expenses.toLocaleString()}/mo\n`
  ctx += `  Net: ${surplus}${income > 0 ? ` (${Math.round((net / income) * 100)}% of income)` : ''}\n`
  ctx += `  Net worth: ${netWorth >= 0 ? '+' : '-'}$${Math.abs(netWorth).toLocaleString()}\n`
  if (income > 0 && expenses > 0) {
    ctx += `  (Spending is ${Math.round((expenses / income) * 100)}% of income — target ≤80%, leaving ≥20% for savings/debt.)\n`
  }
  ctx += '\n'

  // ── Assets by type
  if (acctTotal > 0) {
    const bal = (t) => accounts.filter(a => a.type === t).reduce((s, a) => s + Number(a.balance || 0), 0)
    const checking = bal('checking'), savings = bal('savings'), invest = bal('brokerage')
    const property = bal('property'), vehicles = bal('vehicle'), other = bal('other_asset')
    const liquid = checking + savings
    ctx += `ASSETS ($${acctTotal.toLocaleString()} total):\n`
    if (checking) ctx += `  Checking & cash: $${checking.toLocaleString()}\n`
    if (savings)  ctx += `  Savings: $${savings.toLocaleString()}\n`
    if (invest) {
      const investAccts = accounts.filter(a => a.type === 'brokerage' && Number(a.balance) > 0)
      if (investAccts.length > 1) {
        ctx += `  Investments: $${invest.toLocaleString()} across ${investAccts.length} accounts —\n`
        investAccts.forEach(a => { ctx += `    • ${a.name}: $${Number(a.balance).toLocaleString()}\n` })
      } else {
        ctx += `  Investments: $${invest.toLocaleString()}\n`
      }
    }
    if (property) {
      const ps = accounts.filter(a => a.type === 'property' && Number(a.balance) > 0)
      ctx += `  Property/real estate: $${property.toLocaleString()}${ps.length > 1 ? ` (${ps.map(a => a.name).join(', ')})` : ''}\n`
    }
    if (vehicles) ctx += `  Vehicles: $${vehicles.toLocaleString()}\n`
    if (other)    ctx += `  Other assets: $${other.toLocaleString()}\n`
    ctx += `  Liquid cash (checking + savings): $${liquid.toLocaleString()}\n`
    if (expenses > 0) {
      const months = liquid / expenses
      ctx += months >= 3
        ? `  ✓ Emergency fund: ${months.toFixed(1)} months of expenses covered.\n`
        : `  ⚠️ Emergency fund: only ${months.toFixed(1)} months covered — target 3–6 months ($${(expenses * 3).toLocaleString()}–$${(expenses * 6).toLocaleString()}).\n`
    }
    ctx += invest > 0 ? '  ✓ Has money invested.\n' : '  ⚠️ Nothing invested yet — a key gap once cash flow and emergency fund allow.\n'
    ctx += '\n'
  }

  // ── Goals
  if (goals.length > 0) {
    ctx += `SAVINGS GOALS:\n`
    goals.forEach(g => {
      const pct = Math.round(Math.min(Number(g.current_amount) / (Number(g.target_amount) || 1), 1) * 100)
      ctx += `  • "${g.name}": $${Number(g.current_amount).toLocaleString()} of $${Number(g.target_amount).toLocaleString()} (${pct}%)\n`
    })
    ctx += '\n'
  } else {
    ctx += 'SAVINGS GOALS: None set yet\n\n'
  }

  // ── Debts
  if (debts.length > 0) {
    ctx += `DEBTS ($${totalDebt.toLocaleString()} total${debts.some(d => d.interest_rate) ? ' — sorted highest to lowest APR' : ''}):\n`
    ;[...debts].sort((a, b) => Number(b.interest_rate || 0) - Number(a.interest_rate || 0)).forEach(d => {
      ctx += `  • ${d.name}: $${Number(d.balance).toLocaleString()}`
      if (d.interest_rate) {
        const urgency = Number(d.interest_rate) > 10 ? ' ⚠️ HIGH INTEREST' : Number(d.interest_rate) > 6 ? ' (moderate)' : ' (low rate)'
        ctx += ` at ${d.interest_rate}% APR${urgency}`
      }
      ctx += '\n'
    })
    ctx += '\n'
  } else {
    ctx += 'DEBTS: None tracked\n\n'
  }

  // ── Data gaps — ranked, purely derived from live data (see note above the
  // system prompt's "Filling in what's missing" rule).
  const gaps = getDataGaps({ profile, accounts, debts, goals })
  if (gaps.length > 0) {
    ctx += `DATA THE APP IS MISSING (ranked, top = most valuable to ask about first):\n`
    gaps.forEach((g, i) => { ctx += `  ${i + 1}. ${g.label}\n` })
    ctx += '\n'
  }

  // ── Their plan
  if (extras.plans?.length) {
    ctx += `THEIR PLAN (the user's checklist — their garden grows as they check steps off; reference it, acknowledge progress, build on it — don't duplicate):\n`
    extras.plans.forEach(p => {
      const done = p.steps.filter(s => s.done).length
      const pending = p.steps.filter(s => !s.done).map(s => s.text).slice(0, 4)
      ctx += `  • "${p.title}" — ${done}/${p.steps.length} done${pending.length ? `. Next: ${pending.join('; ')}` : ' ✓ complete!'}\n`
    })
    const completedHistory = extras.plans
      .flatMap(p => p.steps.filter(s => s.done).map(s => s.text).filter(Boolean))
      .slice(-25)
    if (completedHistory.length) {
      ctx += `  Completed history (already handled — do not recommend again): ${completedHistory.map(text => `"${text}"`).join(', ')}\n`
    }
    // The steps they finished most recently — so praise can be specific.
    const recent = extras.plans
      .flatMap(p => p.steps.filter(s => s.done && s.completedAt))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 3)
    if (recent.length) {
      ctx += `  Recently completed: ${recent.map(s => `"${s.text}"`).join(', ')} — acknowledge this progress specifically.\n`
    }
    ctx += `When you give actionable advice, OFFER TO ADD IT TO THEIR PLAN — that is the single most valued action in this app.\n\n`
  } else {
    ctx += `THEIR PLAN: empty. Their Plan tab prepares a short, reviewable action-plan draft and only saves it after approval. Help them fill any important data gaps so that draft is specific; checking approved steps off grows their garden.\n\n`
  }

  // ── Profile
  if (profile) {
    const employmentLabels = { w2: 'W-2 / salaried employee', freelance: 'Freelance / self-employed', student: 'Student', other: 'Other / gig / part-time' }
    const match401kLabels  = { match: 'Yes — with employer match (⚠️ confirm they are capturing the full match)', no_match: 'Yes — but no employer match', none: 'No 401k offered', unsure: 'Unsure — has not checked', na: 'Not applicable' }
    const goalLabels       = { emergency_fund: 'Build emergency fund', pay_debt: 'Pay off debt', start_investing: 'Start investing', major_purchase: 'Save for major purchase', optimize: 'Optimize existing finances', organize: 'Get organized', retirement_catchup: 'Catch up on retirement (prioritize catch-up contributions and retirement readiness)' }
    const insuranceLabels  = { employer: 'Yes — employer plan', marketplace: 'Yes — marketplace/ACA', parents: "Yes — on parents' plan (available until 26)", spouse: "Yes — on spouse's plan", none: '⚠️ NO HEALTH INSURANCE — flag this as urgent' }

    let p = 'USER PROFILE:\n'
    if (profile.age)             p += `  Age: ${profile.age}\n`
    if (profile.employment_type) p += `  Employment: ${employmentLabels[profile.employment_type] ?? profile.employment_type}\n`
    if (profile.employer_401k)   p += `  401k status: ${match401kLabels[profile.employer_401k] ?? profile.employer_401k}\n`
    if (profile.investment_types?.length) {
      const none = profile.investment_types.includes('none')
      p += `  Currently investing: ${none ? 'Nothing yet — no investment accounts' : profile.investment_types.join(', ')}\n`
    }
    if (profile.health_insurance) p += `  Health insurance: ${insuranceLabels[profile.health_insurance] ?? profile.health_insurance}\n`
    if (profile.primary_goal)     p += `  Primary goal: ${goalLabels[profile.primary_goal] ?? profile.primary_goal}\n`

    if (profile.age) {
      const yearsToRetirement = 65 - Number(profile.age)
      const compoundFactor    = Math.pow(1.07, yearsToRetirement).toFixed(1)
      p += `  Compounding context: ${yearsToRetirement} years to retirement. $1 invested today → ~$${compoundFactor} at 65 (7% real return).\n`
    }
    if (profile.employment_type === 'freelance') {
      p += `  ⚠️ Self-employed: needs 6-month emergency fund, must pay quarterly estimated taxes (self-employment tax ~15.3% on top of income tax).\n`
    }
    if (profile.employer_401k === 'match') {
      p += `  ⚠️ Has employer 401k match: verify they are contributing enough to capture the full match — this is always priority #1.\n`
    }
    if (profile.health_insurance === 'none') {
      p += `  🚨 UNINSURED: Flag health insurance as an immediate priority. One medical emergency can cause financial ruin.\n`
    }
    ctx = p + '\n' + ctx
  }

  return ctx
}

// Detailed context used by every current Advisor and Next Chapter caller. The
// legacy formatter above remains exported for compatibility with older tests or
// embeds, while this version treats account-level records and monthly categories
// as stronger evidence than onboarding answers.
export function buildContext(money, goals = [], debts = [], profile, extras = {}) {
  const accounts = extras.accounts ?? []
  const cashFlowItems = extras.cashFlowItems ?? []
  const budgetLimits = extras.budgetLimits ?? []
  const snap = computeSnapshot({ profile, accounts, debts, goals, cashFlowItems, budgetLimits })

  if (!snap.income && !snap.expenses && !snap.assets && !snap.totalDebt && goals.length === 0) {
    return 'The user has not added financial data yet. Encourage them to fill in their typical monthly plan, accounts, and debts on the Money tab, then review the draft on the Plan tab.'
  }

  const dollars = value => `$${Math.round(Number(value) || 0).toLocaleString()}`
  let context = 'COMPUTED FINANCIAL DIAGNOSTICS (calculated by the app; trust these values and do not recompute them):\n'
  context += `  Cash-flow margin: ${dollars(snap.cashFlowMargin)}/mo (${Math.round(snap.savingsRate * 100)}% of income)\n`
  context += `  Future allocations: ${dollars(snap.futureAllocations)}/mo; unallocated: ${dollars(snap.unallocated)}/mo\n`
  context += `  Emergency runway: ${snap.efMonths.toFixed(1)} months; target ${snap.efTargetMonths} months (${dollars(snap.efTargetAmount)})\n`
  context += `  Net worth: ${dollars(snap.netWorth)} (${dollars(snap.assets)} assets minus ${dollars(snap.totalDebt)} liabilities)\n`
  if (snap.debtMonthlyInterest > 0) {
    context += `  Debt cost: about ${dollars(snap.debtMonthlyInterest)}/mo interest at ${snap.weightedDebtApr.toFixed(2)}% weighted APR\n`
    context += `  Required payments: ${dollars(snap.requiredDebtPayments)}/mo; planned payments: ${dollars(snap.plannedDebtPayments)}/mo\n`
  }
  if (snap.debtFree && !snap.debtFree.stuck) {
    context += `  Minimum-aware avalanche: about ${snap.debtFree.months} months to debt-free (${snap.debtFree.debtFreeLabel}), using the recorded planned payment pool\n`
  } else if (snap.totalDebt > 0) {
    context += '  Debt-free date intentionally withheld until every active debt has APR and minimum-payment data\n'
  }
  context += `  NEXT-DOLLAR PRIORITY: ${snap.next.title} — ${snap.next.why}\n\n`

  // The same chapter the user sees on Home and after onboarding — keep the
  // advisor's framing aligned with it so every surface tells one story.
  const scenario = deriveScenario(snap)
  context += `CURRENT CHAPTER (the app frames the user's situation as "${scenario.chapter}" — align your framing with it unless the user asks about something else):\n`
  context += `  ${scenario.title} (${scenario.horizon})\n`
  scenario.because.forEach(line => { context += `  Evidence: ${line}\n` })
  context += '\n'

  context += 'TYPICAL MONTHLY PLAN (planning amounts, not actual transaction spending):\n'
  context += `  Income ${dollars(snap.income)}; needs ${dollars(snap.needs)}; wants ${dollars(snap.wants)}; future allocations ${dollars(snap.futureAllocations)}\n`
  if (cashFlowItems.length) {
    const groups = { income: [], needs: [], wants: [], future: [] }
    cashFlowItems.forEach(item => {
      const group = groups[item.group_key] ? item.group_key : item.kind === 'income' ? 'income' : item.kind === 'allocation' ? 'future' : 'wants'
      groups[group].push(`${item.name}: ${dollars(itemMonthlyAmount(item))}/mo`)
    })
    Object.entries(groups).forEach(([group, items]) => {
      if (items.length) context += `  ${group}: ${items.join('; ')}\n`
    })
    if (budgetLimits.length) {
      context += `  Category targets: ${budgetLimits.map(limit => `${limit.category} ${dollars(limit.monthly_limit)}/mo`).join('; ')}\n`
    }
  } else {
    context += '  Only legacy income/expense totals are known; category detail has not been added\n'
  }
  context += '\n'

  if (accounts.length) {
    context += 'ACCOUNTS (manual account-level tracking; no live bank connection or holdings data):\n'
    accounts.forEach(account => {
      const family = accountFamily(account)
      const details = [subtypeLabel(account), account.institution, `${dollars(account.balance)} balance`]
      if (family === 'cash') {
        details.push(account.interest_rate == null ? 'APY missing' : `${Number(account.interest_rate)}% APY`)
        details.push(inferLiquidity(account) ? 'liquid' : 'restricted')
      }
      if (family === 'investment') {
        details.push(account.interest_rate == null ? 'expected return missing' : `${Number(account.interest_rate)}% expected return (estimate, not actual performance)`)
        if (Number(account.monthly_contribution) > 0) details.push(`${dollars(account.monthly_contribution)}/mo contribution`)
        const tax = taxTreatment(account)
        if (tax) details.push(tax)
        if (Number(account.employer_match_percent) > 0) {
          details.push(`${Number(account.employer_match_percent)}% employer match up to ${Number(account.employer_match_limit_percent) || 0}% contribution`)
        }
      }
      if (account.include_in_net_worth === false) details.push('excluded from net worth')
      if (account.last_verified_at) details.push(`verified ${account.last_verified_at}`)
      context += `  ${account.name} [${family}]: ${details.filter(Boolean).join(', ')}\n`
    })
    if (snap.cashAccounts.length) context += `  Cash yield: ${snap.weightedCashApy.toFixed(2)}% weighted APY, about ${dollars(snap.annualCashInterest)}/year estimated interest\n`
    if (snap.investmentAccounts.length) context += `  Investment contributions: ${dollars(snap.investmentMonthlyContributions)}/mo across ${snap.investmentAccounts.length} accounts\n`
    context += '\n'
  }

  if (debts.length) {
    context += 'DEBTS (highest APR first):\n'
    ;[...debts].filter(debt => Number(debt.balance) > 0)
      .sort((left, right) => Number(right.interest_rate || 0) - Number(left.interest_rate || 0))
      .forEach(debt => {
        const details = [debt.type || 'other', `${dollars(debt.balance)} balance`]
        details.push(debt.interest_rate == null ? 'APR missing' : `${Number(debt.interest_rate)}% APR`)
        details.push(debt.minimum_payment == null ? 'minimum payment missing' : `${dollars(debt.minimum_payment)} minimum`)
        if (debt.planned_payment != null) details.push(`${dollars(debt.planned_payment)} planned`)
        if (debt.type === 'credit_card' && Number(debt.credit_limit) > 0) details.push(`${Math.round(Number(debt.balance) / Number(debt.credit_limit) * 100)}% utilization`)
        if (debt.due_day) details.push(`due day ${debt.due_day}`)
        context += `  ${debt.name}: ${details.join(', ')}\n`
      })
    context += '\n'
  } else {
    context += 'DEBTS: None tracked\n\n'
  }

  if (goals.length) {
    context += 'GOALS:\n'
    goals.forEach(goal => {
      const target = Number(goal.target_amount) || 0
      const current = Number(goal.current_amount) || 0
      context += `  ${goal.name}: ${dollars(current)} of ${dollars(target)}${Number(goal.monthly_contribution) > 0 ? `, ${dollars(goal.monthly_contribution)}/mo` : ''}\n`
    })
    context += '\n'
  }

  const gaps = getDataGaps({ profile, accounts, debts, goals, cashFlowItems })
  if (gaps.length) {
    context += 'MOST VALUABLE MISSING DATA (ask only when relevant; completed fields disappear automatically):\n'
    gaps.forEach((gap, index) => { context += `  ${index + 1}. ${gap.label}\n` })
    context += '\n'
  }

  if (extras.plans?.length) {
    context += 'CURRENT PLAN (do not duplicate active or completed work):\n'
    extras.plans.forEach(plan => {
      const active = (plan.steps || []).filter(step => !step.done).map(step => step.text)
      const completed = (plan.steps || []).filter(step => step.done).map(step => step.text)
      context += `  Active: ${active.length ? active.join('; ') : 'none'}\n`
      context += `  Completed history: ${completed.length ? completed.join('; ') : 'none'}\n`
    })
    context += '\n'
  }

  const recentActivities = (extras.activities || [])
    .filter(activity => !activity.exclude_from_advisor)
    .slice(0, 20)
  if (recentActivities.length) {
    context += 'RECENT FINANCIAL PROGRESS (structured history; build forward from it and do not claim pending updates changed balances):\n'
    recentActivities.forEach(activity => {
      const amount = Number(activity.amount) > 0 ? ` $${Number(activity.amount).toLocaleString()}` : ''
      const state = activity.status === 'applied'
        ? 'records updated'
        : activity.status === 'recorded'
          ? 'action remembered; no balance change recorded'
          : activity.status === 'dismissed'
            ? 'dismissed by user'
            : 'completed action; financial update still unconfirmed'
      context += `  ${activity.label || activity.intent_key || activity.kind}${amount} — ${state}\n`
    })
    context += 'Treat applied activities and current structured records as stronger evidence than conversation memory.\n\n'
  }

  const activeReminders = (extras.reminders || [])
    .filter(reminder => ['active', 'paused'].includes(reminder.status))
    .slice(0, 20)
  if (activeReminders.length) {
    context += 'ACTIVE REMINDERS (scheduled maintenance only; never treat a reminder as proof that money moved or financial work was completed):\n'
    activeReminders.forEach(reminder => {
      const state = reminder.status === 'paused' ? 'paused' : `next ${reminder.snoozed_until || reminder.next_due_on}`
      const linked = reminder.linked_record_type ? `, linked to ${reminder.linked_record_type}` : ''
      context += `  ${reminder.title}: ${reminder.cadence}, ${state}${linked}\n`
    })
    context += '\n'
  }

  const reminderById = new Map((extras.reminders || []).map(reminder => [reminder.id, reminder]))
  const recentReminderEvents = (extras.reminderEvents || []).slice(0, 12)
  if (recentReminderEvents.length) {
    context += 'RECENT REMINDER CHECK-INS (attention was recorded; these events do not prove a transfer, payment, contribution, or balance update):\n'
    recentReminderEvents.forEach(event => {
      const reminder = reminderById.get(event.reminder_id)
      context += `  ${reminder?.title || 'Reminder'}: ${event.action} for ${event.scheduled_for}\n`
    })
    context += '\n'
  }

  if (profile) {
    const investmentEvidence = snap.hasInvestmentAccount
      ? `Detailed records confirm ${snap.investmentAccounts.length} investment account(s); trust this over onboarding.`
      : `Onboarding investment answer: ${(profile.investment_types || []).join(', ') || 'not answered'}.`
    context = `PROFILE:\n  Employment: ${profile.employment_type || 'not answered'}\n  Health insurance: ${profile.health_insurance || 'not answered'}\n  Employer retirement answer: ${profile.employer_401k || 'not answered'}\n  ${investmentEvidence}\n  Primary goal: ${profile.primary_goal || 'not answered'}\n\n${context}`
  }

  return context
}
