# Plan Feature Upgrade — "One list. One next step. Nothing to figure out."

**For:** any implementing agent (Claude or Kimi) · **Scope:** the Plan feature and every surface that feeds or reads it · **Do not deploy without an explicit "push".**

---

## 1. Why this plan exists

Beta feedback made "Add to my Plan" the most valued feature in the app — and simultaneously the least clear. The core promise:

> **Advisor recommends → lands in your Plan → you check steps off → the garden grows.**

Every hop works, but the Plan page itself is busy and ambiguous. This upgrade optimizes for exactly two things, in this order:

1. **Simplicity** — the page should need zero explanation. A first-time user should look at it and know what it is and what to do within two seconds.
2. **Maximum helpfulness** — every pixel that survives must either tell the user *what to do next*, *why it's worth doing*, or *what doing it earned them*. Anything else goes.

### The UI north star (read this before writing any JSX)

**One screen, one question, one answer.** The Steps tab answers "what should I do next?" with a single emphasized card. Everything else on screen is quiet.

Hard rules for the implementing agent:
- **At most ONE emphasized element** on the Steps tab: the "Up next" card. Nothing else may use accent-panel treatment, pulsing, or a filled button at rest.
- **A collapsed step row shows at most two things:** the checkbox and the text (plus a tiny due/impact hint when one exists). Everything else lives behind **tap-to-expand** — the page's only disclosure pattern. No per-row button zoos.
- **At most ONE suggestion visible at a time.** The engine can know ten things; the page whispers one.
- **No cards inside cards, no plan-title headers.** The page heading *is* the plan's name. Steps are rows in one flat list.
- If a copy string needs a subordinate clause to explain a control, redesign the control.

### The five problems being fixed (verified in code, not guessed)

**P1 — Plan fragmentation.** Every save path creates a **new** `advisor_plans` row: the advisor's "Action plan" button (`AIAdvisor.jsx handleSavePlan`), "Add this to my plan" (`handleAddToPlan`), saved guides (`handleSaveGuide`), and Smart Suggestions' first task (`Plan.jsx addSuggestedTask`). A real user accumulates 4–6 overlapping mini-plans with duplicated steps. Their mental model is *one* plan; the app stores a pile.

**P2 — No visible priority.** `computeSnapshot()` (`src/lib/finance.js`) already computes a next-dollar priority the advisor leads with, but the Plan page ignores it — steps render in insertion order inside cards sorted only "complete-last" (`Plan.jsx:203`). "What do I do first?" has no on-screen answer.

**P3 — The reward loop is invisible where the work happens.** Checking a step produces garden feedback only on stage crossings (`celebrate()`, `Plan.jsx:96`); most taps get silence. The "2 more steps → Thriving" meter exists only on the Garden page.

**P4 — Overload per row + section pile-up.** A step row can simultaneously show: detail text, resource links, a due chip, a "Show me how" toggle, an apply button, and (planned) more chips. Above the list sit three Smart Suggestion cards. The eye has nowhere to land.

**P5 — Dead ends.** `applyStep('budget')` (`src/lib/advisorPlans.js:59`) inserts into the **`budgets` table nothing reads anymore** — all money snapshots read `profiles.monthly_income/monthly_expenses` (the only `from('budgets')` reference in `src/` is this insert). Tapping "Add to Budget" changes nothing anywhere the user can see. Also: no per-step delete; done steps clutter the active list forever; steps arrive without their "why".

---

## 2. The target experience (what the user actually sees)

### Steps tab, top to bottom

```
Your Plan
Check off steps to grow your garden.

[ Steps ◉ 3 left ] [ Goals ]

●───────────────░░  Growing · 2 more → Thriving        ← one thin line, pulses on check

┌──────────────────────────────────────────────┐
│ UP NEXT                                      │
│ Pay $500/mo onto the Visa card               │      ← THE emphasized element
│ It's costing you ~$87/mo in interest.        │
│ [ ✓ Done ]              Show me how ›        │
└──────────────────────────────────────────────┘

Then
○ Set up a $200 automatic transfer on payday
○ Open a Roth IRA at Fidelity            ≈ +$1,400/yr
○ Ask HR about the 401(k) match          due Jul 15

Done · 4  ⌄                                            ← collapsed accordion

+ Add a step
```

- **Tap a quiet row** → it expands in place: the why (`detail`), impact, "Show me how" (existing `HowToInline`), the one-tap apply action if any, due-date chip, and a small delete. Tap again (or another row) → collapses. One pattern, everywhere.
- **Check the Up-next card** → satisfying check animation, the meter fills +1 and pulses, the next step slides up into the card. Stage crossings additionally fire the existing `GardenGrowthToast`.
- **One suggestion, only when useful:** when the active list has < 3 steps, a single quiet row appears under the list — `✦ Suggested: build a $1,000 starter emergency fund · Add` — the *top* suggestion from the existing engine. Never a stack of cards.
- **Empty state = one tap to a real plan.** Replace the "go talk to your advisor" detour with a primary button **"Build my starter plan"** that calls the existing `requestPlan` (same tool the advisor uses, same context) right from the Plan page and appends the result. The advisor CTA remains as the quiet secondary link. First-run user: two taps from empty page to a personalized checklist.

### Goals tab
Unchanged this round except chrome consistency — it already has one job and does it. (Do not redesign `GoalItem`.)

### Everywhere else
- **Dashboard peek** shows the same top-2 steps as the page (shared ordering — the app never disagrees with itself).
- **Advisor** appends into the one plan and reports honestly: "Added 3 steps (1 you already had)."
- **Apply actions** write to numbers the app actually displays.

---

## 3. Invariants — do not break these

1. **Never lose user data in the merge.** Existing steps, `done`, `due`, `applied` must survive Phase A exactly. Dedupe may only drop a *new incoming* step — never an existing one.
2. `milestonesToStage`, `STAGE_NAMES`, `STAGE_THRESHOLDS` (`src/context/GardenContext.jsx`) are **unchanged**.
3. Don't touch `src/components/garden/` (the 3D scene); the loop connects only through `updateGarden(...)`, signature as-is.
4. No new tables. New per-step fields (`source`, `group`, `impact`, `addedAt`, `completedAt`) are additive JSONB keys via `normalizeSteps`.
5. Design tokens: dark glass, emerald-family accents only, lucide icons, `font-display` headings, `tabular-nums` figures, ≥44px touch targets, `text-base` inputs on mobile, no chrome emoji.
6. Update `buildContext` (`AIAdvisor.jsx`) together with any `listPlans`/`getPlan` change.
7. No push to `main` without an explicit "push"; edge-function deploys need explicit user go-ahead.

---

## 4. The work, in phases

### Phase A — One plan (data + append API)

**`src/lib/advisorPlans.js`:**
- `export async function getPlan(userId)` — fetch all rows; if >1, merge client-side (steps concatenated oldest-first, `done/due/applied` preserved verbatim, inherited `group: <old title>` when the title was meaningful), write merged steps to the oldest row (title → `"Your plan"`), **verify the write succeeded, then** delete extras. Idempotent lazy migration; no SQL.
- `export async function appendSteps(userId, rawSteps, { source, group })` — normalize, **dedupe** against existing *not-done* steps (case-insensitive containment after stripping punctuation/amounts), stamp `{ source, group, addedAt }`, append, return `{ plan, added, skipped }`.
- `normalizeSteps` passes through `source`, `group`, `impact`, `addedAt`, `completedAt` (all `?? null`).
- Reimplement `savePlan` as `appendSteps` (title → `group`) so nothing can fork the model again.

**Repoint all four creators:** `handleSavePlan` (`source:'advisor'`), `handleSaveGuide` (`source:'guide'`), `handleAddToPlan` (`source:'advisor'`; toast becomes ``Added ${added} steps${skipped ? ` — ${skipped} already there` : ''}``), `addSuggestedTask` (`source:'suggestion'`, drop the plans[0]-or-create branch).

**Advisor context:** `extras.plans` becomes `[plan]` or `[]`; verify copy still reads naturally.

### Phase B — The new Steps tab (the simplicity phase — most of the UI work)

**New `src/lib/planOrder.js`** — one shared, stable ordering:
```
1. overdue (soonest first)  2. due ≤14d (soonest first)
3. priority ladder by keyword on step.text (one exported table, mirrors the
   finance engine): insurance 0 · deficit 1 · starter EF 2 · high-APR debt 3 ·
   401k match 4 · full EF 5 · roth/invest 6 · automate 7 · else 9
4. insertion order (stable sort)
```

**Rebuild the Steps tab in `Plan.jsx` + `PlanCard.jsx`** (the page variant of PlanCard effectively dissolves into the page; keep the chat variant intact for the advisor):
- **GardenMeter** (new `src/components/GardenMeter.jsx`): one thin strip — stage dot + name, progress bar filling `(done − currentThreshold) / (nextThreshold − currentThreshold)`, right-aligned `"${remaining} more → ${nextStageName}"`. Pulses on every `done` increment. Tap → navigate `/`. Reuses the `GardenHud` color ramp.
- **UpNextCard**: top step from `orderSteps`. Accent panel (`bg-emerald-500/[0.08] border-emerald-400/25`), `UP NEXT` eyebrow, step text `text-[15px] font-semibold`, the why line (detail/impact), a **large check button** (the reward moment — min 44px), and `Show me how ›`. On check: check animation → next step slides up (`framer-motion` layout animation, 0.25s).
- **Quiet rows** for the rest: checkbox + text; right-aligned single tiny hint when one exists (due meta *or* impact — due wins if both). **Tap row → expand in place** (only one row expanded at a time): detail, impact chip, `HowToInline`, apply button, `DueChip`, and a small delete (two-tap arm). Collapse on re-tap or expanding another. This replaces today's always-visible per-row chrome — `StepRow` is rewritten around collapsed/expanded, not decorated further.
- **Done accordion** at the bottom: `"Done · ${n}"` header, chevron, struck-through rows inside. Stamp `completedAt` in both `toggleStep`s (`Plan.jsx`, `Dashboard.jsx`); clear on un-toggle.
- **"Clear my plan"** lives inside a small overflow spot (not a trash icon at eye level); keep the two-tap arm.
- **No origin chips in rows.** `group` shows only inside the expanded view, as muted text ("from: Roth IRA guide").

**`Dashboard.jsx`:** replace the local due-only sort with `orderSteps(...).slice(0, 2)`.

### Phase C — One suggestion + one-tap starter plan

- **`SmartSuggestions` slims to a single row** (rename or wrap: `SuggestionRow`): the engine's top pick only, rendered as one quiet line under the active list — `✦ ${q} · [cta]` — shown **only when active (not-done) steps < 3**. Dismissable per suggestion id (localStorage), so it never nags. The `buildSuggestions` engine itself is untouched — only the presentation shrinks.
- **Empty state:** primary button **"Build my starter plan"** → sets a building state, calls `requestPlan` with the same context/system prompt the advisor uses (import `buildContext`/`buildSystemPrompt` or lift them to a shared module — lifting is cleaner: move both to `src/lib/advisorContext.js` and import from both pages), then `appendSteps(..., { source:'advisor', group: plan.title })`. Secondary quiet link: "or ask your advisor →". Loading state: skeleton rows, not a spinner.

### Phase D — Steps that carry their "why" (edge function)

`supabase/functions/chat/index.ts` `ACTION_PLAN_TOOL`:
- `detail` → required, description: `"Why this matters for THIS user, referencing their real numbers — one short sentence."`
- Add optional `impact`: `"Quantified benefit, ultra-short, e.g. '≈ $43/mo saved'. Omit rather than invent."`
- Add optional `due`: `"YYYY-MM-DD, only for genuinely time-sensitive steps. Usually omit."`
- Client renders `impact` per Phase B (collapsed hint / expanded chip). Backward compatible both directions — a stale deploy can't break anything.
- **Ask the user before deploying** (`npx supabase functions deploy chat --project-ref chvdpbnmpeuifymloqqb`).

### Phase E — Kill the dead ends

1. **Budget apply → real numbers.** Rewrite `applyStep('budget')` to read-modify-write `profiles.monthly_income` / `monthly_expenses` (the `applied` flag already guards double-taps). `applyLabel` → `"Add to my income"` / `"Add to my expenses"`; success message shows the new truth: `` `Expenses updated → $${newTotal}/mo` ``. Delete the orphaned `budgets` insert (leave the table abandoned). Update the tool's `apply.budget_*` descriptions in the same edge-function deploy as Phase D. Sanity-check callers: `Plan.jsx applyAndMark`, `AIAdvisor.jsx applyPlanStep`, `ArtifactRenderer` `'budget'` action.
2. **Advisor acknowledges specifics:** `buildContext`'s plan section adds the 2–3 most recently completed step texts (`completedAt` desc): `Recently completed: … — acknowledge this progress.`
3. **Goal linkback:** an applied `apply.type==='goal'` confirmation becomes a link to `/plan#goals` ("Goal planted → view it").

### Explicitly out of scope

Drag-to-reorder · recurring steps · due-date notifications · Goals-tab redesign · new tables/SQL · any 3D garden change.

---

## 5. Execution order

1. **Phase A** (load-bearing; everything assumes one plan).
2. **Phase B** (the page rebuild — biggest chunk; do GardenMeter → ordering → UpNext → quiet rows → done accordion, verifying layout at 375px as you go).
3. **Phase C** (suggestion row + starter-plan button; includes lifting `buildContext`/`buildSystemPrompt` into `src/lib/advisorContext.js`).
4. **Phase E items 2–3** (client-only).
5. **Phase D + E item 1** together (one edge-function change; **ask before deploying**).
6. Verification sweep, commit. **No push until the user says "push".**

---

## 6. Verification (required, live — not assumed)

Preview: `.claude/launch.json` → **"Garden Financial"** (port 5173). Test at **375×812** and desktop.

1. `npm run build` green; no dangling imports from the PlanCard/SmartSuggestions reshape.
2. **Two-second test (the point of this whole upgrade):** screenshot the Steps tab with ~6 steps → exactly one emphasized element (Up next), quiet rows show only checkbox+text+one hint, one suggestion max, no visual competition. If the screenshot looks busy, it is — fix before proceeding.
3. **Merge safety:** test user with ≥2 plans → `/plan` shows one list, all steps and `done` flags intact, extra `advisor_plans` rows gone (Supabase query), reload idempotent.
4. **Append + dedupe:** "Add this to my plan" twice for the same advice → second reports "already there," no duplicates.
5. **Ordering:** steps hitting different ladder rungs + one overdue → overdue first, debt before Roth; Dashboard peek shows the same top 2.
6. **The loop:** check the Up-next card → meter +1 and pulses, next step slides up, step lands in Done accordion; crossing a stage threshold fires `GardenGrowthToast` and `/` shows the new stage.
7. **Expand/collapse:** tap row → expands (detail, how-to, apply, due, delete); tap another → previous collapses; delete arms then removes one step, persists after reload.
8. **Starter plan:** fresh user, empty plan → "Build my starter plan" → skeleton → personalized steps appear, saved (survive reload).
9. **Budget apply:** expense-apply step → tap → `profiles.monthly_expenses` actually changes (visible on `/money`; advisor quotes the new number when asked).
10. **Advisor sync:** complete a step, ask "how am I doing?" → the reply names it.
11. **Mobile sweep:** 375px — meter, Up-next card, expanded rows, accordion: no overflow, ≥44px targets, nav-pill clearance (`pb-24`) intact.

---

## 7. Risks

- **The merge is the only risky write** — merged-steps write first, verify, then delete extras; on failure, bail and leave multi-plan state for one more session.
- Dedupe false-positives → only compare against *not-done* steps, and always report `skipped` out loud in the toast.
- The keyword ladder is heuristic — keep it one exported table in `planOrder.js` so tuning is a one-file change.
- Tap-to-expand replaces always-visible affordances; make expansion obviously discoverable (chevron affordance on the row, subtle) and test that `HowToInline` and apply flows still get used inside it.
- Edge-function schema changes are optional-field additions — compatible in both deploy orders.
