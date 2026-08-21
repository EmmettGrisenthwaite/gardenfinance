# How the plan and the advisor operate

The contract this system keeps: **the numbers are decided by rules, the words are
decided by the model, and nothing reaches the user's Plan without their approval.**

Everything below follows from that.

---

## The four stages

```
  1. COLLECT          2. GENERATE            3. REFINE              4. COMMIT
  onboarding    →     money route      →     interview        →     Plan tab
  (facts)             (3–5 steps)            (≤3 taps)              (approved steps)
                                                  │                      ↑
                                                  └──────────────────────┘
                                              revisions fold in at save time
```

A question is only worth asking if the answer changes the plan — every question
carries what it will change, and the plan that reaches stage 4 is the revised
one, not the one the ladder first produced.

---

## 1. Collect — onboarding

Six steps gather the minimum needed to route money honestly: age and work, income
and spending, cash balances, debts, coverage and existing investment accounts,
and one starting priority.

**The plan is withheld until every required input exists.** `missingPlanInputs()`
is the gate. A plan built on half the picture is worse than no plan, because it
confidently routes money past whatever it was never told about.

Balances entered here become real `accounts` rows, so the plan can see them
immediately and the user is never asked the same thing twice.

## 2. Generate — the money route

`buildMoneyRoute()` is a deterministic waterfall. **No model participates in
ordering or amounts.** The ladder:

| Rung | Fires when |
|---|---|
| Repair a deficit / find a first margin | spending ≥ income |
| Hold for coverage | no health insurance on file |
| Starter cushion → $1,000 | liquid cash below it |
| Employer match | a match exists and is unclaimed |
| High-APR debt (> 7%) | such a debt exists |
| Full emergency fund (3–6 months) | cushion below target |
| Goal, then investing | everything above is handled |

`buildInitialPlan()` turns the funded rungs into **3–5 steps**, deliberately
mixing two kinds:

- **Specific to them** — "Move $250/mo toward your emergency fund", "Pay $1,000/mo
  to Visa". Derived from their balances and rates.
- **Standard practice they happen to need** — autopay every minimum, keep the
  cushion out of the spending account, move idle savings to a high-yield account.
  Each is **gated on their records**, so nobody is told to open a savings account
  they already have.

One priority usually absorbs the whole surplus. Without the second kind, the plan
would be a single transfer plus its automation — which is what it used to be.

Every rung also carries **why** it is there and **how long** it takes
(`etaMonths`, amortized for debt). Anything the plan deliberately skips — a
low-rate loan, a debt with no rate on file — is named in `notes` rather than
silently dropped.

## 3. Refine — follow-ups

`planFollowUps()` generates the questions a planner would ask *about this
specific plan*. These are **not** `route.refinements`, which are missing records
the app can go and collect. These are the judgement calls no column holds.

Rules:

1. **Every question is gated on something true of this user.** No employer-match
   question without an employer match.
2. **One question per topic.** Topics are `debt`, `income`, `risk`, `goal`,
   `retirement`, `investing`. Three questions that all mean "what might you have
   to pay for?" read as one question asked three times.
3. **Ordered by how much the answer moves the plan.** An expiring 0% balance
   outranks a deductible.

### The interview

`planInterview.js` turns those questions into a bounded flow: at most
`INTERVIEW_MAX` (3), tapped rather than typed, each showing what it will change
*before* it is answered.

Only questions whose answer reduces to two taps get one — a question without a
`SPECS` entry stays a chat prompt, because pretending a shrug is a decision is
worse than asking properly. "Talk it through" hands any question to the advisor
mid-flow without losing its wording.

Each answer produces a **revision**: a promotion, an added step, or a note.
Nothing computes a new dollar figure, because a number derived from a
multiple-choice answer would be a guess wearing arithmetic's clothes.

Revisions fold in at the moment of saving, so what reaches the Plan is the plan
the user agreed to rather than the one the ladder first produced.

### Keeping the result clean

Three passes run over a revised plan, in order:

1. **`dedupeByFamily`** — one errand per family. The ladder offers a savings
   account for the cushion, an uneven-income answer offers one for lean months,
   a known-bill answer offers one for the bill; each is correct alone and
   together they say "open three savings accounts". The best-informed member
   survives — an interview step outranks one generated before asking.
2. **`trimToMax`** — the interview may sharpen a plan, never inflate it.
   Generic practice gives way first, never an answer the user just gave, and a
   rider never outlives the move it automates.
3. **`orderPrerequisitesFirst`** — only ever moves a step earlier, and only when
   leaving it would produce an impossible instruction.

Where the account-opening *is* the money move, the two are one step ("Open a
savings account and move $900 into it") rather than a transfer ranked above the
errand that makes it possible.

## 4. Commit — the Plan tab

`appendSteps()` writes the approved steps with `source: 'money-route'`. The whole
plan is saved, not just the three that fit the focus view, so nothing recommended
is silently dropped.

Steps are deduplicated by `intentKey` and tracked by `completionPolicy`
(`once` vs `repeatable`). Guides produced by the advisor carry the same two
fields for the same reason — a step without them cannot be deduped or marked done.

---

## Invariants

Enforced by tests; break one and the suite fails.

1. Funded allocations sum exactly to `availableMonthlyAmount`.
2. The plan is **never empty** — every state, including breaking even, has a move.
3. The plan is **3–5 steps** wherever the user's records support it.
4. Money moves lead; setup work follows.
5. The automation step sits immediately after the transfer it automates.
6. No follow-up repeats another's topic.
7. No copy contains `undefined`, `NaN`, or a `$0` monthly figure.
8. Durations read in months under two years, then years, capped at "over 10
   years"; a *start* date beyond ten years is dropped rather than shown.
9. No step reads as app housekeeping, and no completion criterion describes a
   record in this app rather than something true in the world.
10. One errand per family, for every profile against every combination of
    interview answers — and the interview never pushes a plan past 5 steps.

## Where things live

```
src/lib/moneyRoute.js      the waterfall, steps, durations
src/lib/planFollowUps.js   the questions, their gating and topics
src/lib/planInterview.js   the three questions, and what answers do
src/lib/planComposition.js 3-5 steps, families, trimming, ordering
src/lib/finance.js         snapshot, thresholds, amortization
src/components/MoneyRouteCard.jsx   the plan and its refinement
src/pages/AIAdvisor.jsx    conversation, guides, committing to Plan
```
