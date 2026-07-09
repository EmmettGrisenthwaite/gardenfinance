# Plan Feature Upgrade — "One list that always knows what's next"

**For:** any implementing agent (Claude or Kimi) · **Scope:** the Plan feature and every surface that feeds or reads it · **Do not deploy without an explicit "push".**

---

## 1. Why this plan exists

Beta feedback made "Add to my Plan" the most valued feature in the app. But the Plan itself has grown into the *least clear* part of the loop. The core promise of the app is:

> **Advisor recommends → lands in your Plan → you check steps off → the garden grows.**

Today every hop in that chain works, but the middle is muddy. This plan makes the Plan page the single, obvious answer to one question — **"what should I do next?"** — and makes every connection to the rest of the app (advisor, garden, dashboard, money) legible.

### The five problems (verified in code, not guessed)

**P1 — Plan fragmentation.** Every save path creates a **new** `advisor_plans` row: the advisor's "Action plan" button, the "Add this to my plan" CTA, saved guides, and even the Smart Suggestions "Add task" (when no plan exists). A real user accumulates 4–6 overlapping mini-plans ("Your action plan", "Roth IRA guide", "Turn this advice into steps…") with duplicated steps and no unified order. The user's mental model is *one* financial plan; the app stores a pile.
   - Callers that create rows: `AIAdvisor.jsx` → `handleSavePlan`, `handleSaveGuide`, `handleAddToPlan`; `Plan.jsx` → `addSuggestedTask`.

**P2 — No visible priority.** `computeSnapshot()` in `src/lib/finance.js` already computes a NEXT-DOLLAR PRIORITY (the advisor's context leads with it), but the Plan page ignores it. Steps render in insertion order inside cards sorted only "complete-last" (`Plan.jsx:203`). With 3 cards × 4 steps, "what do I do first?" has no answer on screen.

**P3 — The reward loop is invisible on the page that drives it.** Checking a step only produces visible garden feedback when it crosses a stage boundary (`celebrate()` in `Plan.jsx:96`). Most taps: silence. The stage meter ("2 more steps → Thriving") exists **only** on the Garden page (`GardenHud`, `Dashboard.jsx:44`). The page where you do the work never shows what the work earns.

**P4 — Dead ends and gaps.**
   - `applyStep('budget')` (`src/lib/advisorPlans.js:59-70`) inserts into the **`budgets` table, which nothing in the app reads anymore** — every money snapshot reads `profiles.monthly_income` / `monthly_expenses` (verified: the only `from('budgets')` reference in `src/` is this insert). The user taps "Add to Budget", sees success, and their numbers change nowhere.
   - **No per-step delete.** You can delete an entire plan (two-tap arm) but not one stale step.
   - Due dates affect ordering on the Dashboard peek but **not** on the Plan page itself.
   - Completed plans collapse, but completed *steps* inside an active plan sit inline forever (struck through), burying the live ones.

**P5 — Steps don't carry their "why".** The `ACTION_PLAN_TOOL` schema (`supabase/functions/chat/index.ts:71`) has `detail` as optional one-liner and no quantified impact. Steps arrive as bare imperatives; the motivation ("saves ~$43/mo interest") lives back in the chat the user already left.

---

## 2. North star & how the Plan connects to the app

After this upgrade, the mental model is:

```
                    ┌────────────────────────────┐
  Advisor chat ───▶ │                            │ ◀─── Smart Suggestions
  (append steps)    │      YOUR PLAN (one list)  │      (finance engine)
  Guides ─────────▶ │  ordered by real priority  │ ◀─── User-added steps
                    │                            │
                    └─────────┬──────────────────┘
                              │ check a step
                              ▼
                    Garden grows (stage meter visible ON the plan page)
                              │
              Dashboard "next in your plan" = the SAME top steps,
              the advisor context reads the SAME single plan
```

- **One plan per user.** Everything appends to it; nothing creates siblings.
- **One ordering function.** Plan page, Dashboard peek, and the "Do this next" hero all use it — the app never disagrees with itself about what's next.
- **One money source.** Apply-actions write to `profiles` (the only place anything reads).
- **The garden meter lives where the checking happens.**

---

## 3. Invariants — do not break these

1. **Never lose user data in the merge.** Existing steps, `done` flags, `due` dates, and `applied` flags must all survive Phase A exactly. Dedupe may only drop a *new incoming* step that matches an existing one — never an existing step.
2. `milestonesToStage` thresholds and `STAGE_NAMES` / `STAGE_THRESHOLDS` (`src/context/GardenContext.jsx`) are **unchanged** — the garden's growth math is not part of this work.
3. Do not touch anything under `src/components/garden/` (the 3D scene) — the loop connects to it only through `updateGarden(...)`, whose signature stays as-is.
4. No new tables. `advisor_plans` with its `steps` JSONB column is enough; new per-step fields (`source`, `group`, `impact`, `completedAt`) are additive JSON keys handled by `normalizeSteps`.
5. Design system: dark glass tokens, emerald-family accents only, `lucide-react` icons, `font-display` headings, `tabular-nums` on figures, ≥44px touch targets, `text-base` inputs on mobile. No emoji in chrome.
6. The advisor context builder (`buildContext` in `AIAdvisor.jsx`) must keep working with whatever `listPlans` returns — update the two together.
7. Existing conventions stand: no push to `main` without an explicit "push"; edge-function deploys need explicit user go-ahead.

---

## 4. The work, in phases

### Phase A — One plan (merge model + append API)

**Goal:** exactly one active `advisor_plans` row per user; every save surface appends to it.

**`src/lib/advisorPlans.js`:**
- New: `export async function getPlan(userId)` — fetches all rows for the user. If **>1 row**: merge client-side (steps concatenated oldest-plan-first; each inherited step gets `group: <old plan title>` if the title isn't the generic "Your plan"/"Your action plan"; `done`/`due`/`applied` preserved verbatim), write the merged steps to the oldest row (title → `"Your plan"`), delete the extra rows, return the single merged row. If 1 row: return it. If 0: return `null`. This is the lazy migration — idempotent, no SQL needed, safe if it runs on two devices (dedupe below makes re-merge harmless).
- New: `export async function appendSteps(userId, rawSteps, { source, group } = {})` — normalize incoming steps, **dedupe** against the existing plan's steps (case-insensitive comparison after stripping punctuation/amounts; a new step is a duplicate if its normalized text is contained in — or contains — an existing *not-done* step's normalized text), stamp survivors with `{ source, group, addedAt: ISO }`, append, upsert. Returns `{ plan, added, skipped }` so callers can say "Added 3 steps (1 you already had)".
- `normalizeSteps` gains passthrough for the new keys: `source ?? null`, `group ?? null`, `impact ?? null`, `addedAt ?? null`, `completedAt ?? null`.
- Keep `savePlan` exported but reimplement it as `appendSteps` under the hood (title argument becomes the `group`) so nothing silently forks the model again.
- `applyStep`: see Phase E.

**Callers to repoint (all four):**
- `AIAdvisor.jsx handleSavePlan` → `appendSteps(user.id, pendingPlan.steps, { source: 'advisor', group: pendingPlan.title })`
- `AIAdvisor.jsx handleSaveGuide` → same with `source: 'guide'`, `group: pendingGuide.title`
- `AIAdvisor.jsx handleAddToPlan` → same with `source: 'advisor'`; the flash toast becomes count-aware: `Added ${added} steps to your Plan` (and `— ${skipped} already there` when skipped > 0).
- `Plan.jsx addSuggestedTask` → `appendSteps(user.id, [{ text }], { source: 'suggestion' })` (drop the plans[0]-or-create branch).

**`Plan.jsx` / `PlanCard.jsx`:**
- Plan page loads via `getPlan` (a single plan object or null) — delete the `sortedPlans` multi-card mapping; render **one** card body (the PlanCard chrome can slim down: no per-plan title header needed on the page variant; the page's own `<h1>` is the title). "Delete plan" becomes "Clear all steps" with the same two-tap arm.
- Each step may render a subtle origin chip when `group` is set (e.g. `Roth IRA guide` in `text-[10px] text-white/40`) — context without clutter. No chip for `source: 'user' | 'suggestion'`.
- **Per-step delete:** small `×` on each row (44px hit area, `text-white/25 hover:text-rose-300`), two-tap arm like plan delete. Wire through `editPlan`-style functional update.
- The chat-variant PlanCard save button copy: **"Add these N steps to my Plan"**; saved state: **"Added to your Plan → track it as you go"** (already close).

**Advisor context (`buildContext` extras.plans):** now receives `[plan]` or `[]` — the loop already handles it; just verify the copy still reads naturally with one plan.

### Phase B — "Do this next" ordering, shared everywhere

**Goal:** the app has one opinion about the next step, and it's visible.

**New `src/lib/planOrder.js`:**
```js
// Rank an uncompleted step. Lower = sooner. Stable sort keeps insertion order on ties.
export function orderSteps(steps) → sorted copy:
  1. overdue (due < today), soonest first
  2. due within 14 days, soonest first
  3. priority ladder by keyword match on step.text (mirrors the finance engine
     + the advisor's diagnostic checklist):
       0 health insurance        1 deficit / overspending
       2 starter emergency fund  3 high-interest / credit-card debt
       4 401(k) match            5 emergency fund (full)
       6 roth / ira / invest     7 automate / transfer
       9 everything else
  4. insertion order (stable)
```
Keyword mapping lives here in one table so Plan page and Dashboard can't drift. Done steps are excluded by callers.

**`Plan.jsx` Steps tab layout becomes:**
1. Garden meter strip (Phase C)
2. **"Do this next"** hero — the single top step from `orderSteps`, rendered as its own emphasized card: step text at `text-[15px] font-semibold`, the `detail`/`impact` line, `HowToInline`, due chip, and one large check button (the whole card is the reward moment). Emerald accent panel treatment (`bg-emerald-500/[0.08] border-emerald-400/25`).
3. Smart Suggestions (unchanged component, now *below* the hero — suggestions are "what to add", the hero is "what to do", and doing beats adding)
4. The rest of the list (ordered by `orderSteps`), then the Done section (Phase E), then "Add your own step".

**`Dashboard.jsx` nextSteps:** replace the local due-only sort with `orderSteps(...).slice(0, 2)` — the peek and the page now always agree.

### Phase C — Garden meter on the Plan page

**Goal:** every check visibly earns garden progress, not just stage-crossing ones.

**New `src/components/GardenMeter.jsx`** (compact strip, reuses `milestonesToStage`, `STAGE_NAMES`, `STAGE_THRESHOLDS`):
- Left: stage dot (same color ramp as `GardenHud`) + stage name.
- Middle: thin progress bar — fill = `(done − thresholdOfCurrentStage) / (nextThreshold − thresholdOfCurrentStage)`, `transition-all duration-500`.
- Right: `"${remaining} more → ${STAGE_NAMES[stage+1]}"` (or "fully grown" at 5), `tabular-nums`.
- On `done` increment: pulse the bar (brief brightness/scale flash, à la `GardenHud`'s shimmer).
- Tapping it navigates to `/` (go admire the garden).

Mount at the top of the Steps tab in `Plan.jsx`, fed by the same `completedSteps + goalsReached` it already computes. `GardenGrowthToast` still fires on stage crossings — the meter covers all the taps in between.

### Phase D — Steps that carry their "why" (edge function + render)

**Goal:** every advisor-generated step arrives with a reason and, where possible, a number.

**`supabase/functions/chat/index.ts` `ACTION_PLAN_TOOL`:**
- `detail` description → `"Why this matters for THIS user, referencing their real numbers — one short sentence."` and add it to the step's `required` list alongside `text`.
- New optional `impact`: `{ type: 'string', description: 'Quantified benefit if known, ultra-short, e.g. "≈ $43/mo saved" or "+$1,000 cushion". Omit if you would have to invent the number.' }`
- New optional `due`: `{ type: 'string', description: 'YYYY-MM-DD, only for genuinely time-sensitive steps (enrollment windows, promo APR expirations). Usually omit.' }`
- Mirror the `impact` addition on `CREATE_GUIDE_TOOL` steps if trivially done; otherwise skip — guides are how-tos, impact matters less.

**Client:** `normalizeSteps` already passes `impact` through after Phase A. Render in `StepRow`: tiny chip after the detail line — `bg-emerald-500/[0.1] text-emerald-200 text-[10px] font-semibold px-1.5 py-0.5 rounded` — only when `impact` is set and the step isn't done. The "Do this next" hero shows it more prominently inline.

**Deploy note:** the edge function change requires `npx supabase functions deploy chat --project-ref chvdpbnmpeuifymloqqb` — **ask the user before deploying**. The client changes are backward-compatible with the undeployed schema (impact just stays null), so ship order doesn't matter.

### Phase E — Kill the dead ends

1. **Budget apply → profile numbers.** Rewrite the `'budget'` branch of `applyStep` to update the real source of truth:
   - `budget_type === 'income'` → `profiles.monthly_income += amount`; else `profiles.monthly_expenses += amount`. Read-modify-write the profile row; the existing per-step `applied` flag already prevents double-taps.
   - `applyLabel` copy: `'Add to my income'` / `'Add to my expenses'`; success return: `` `Expenses updated → $${newTotal.toLocaleString()}/mo` `` so the user sees the before/after truth.
   - Delete the now-orphaned `budgets` insert. (Leave the DB table alone — abandoned, like the pivot plan's other retired tables.)
   - Update the `ACTION_PLAN_TOOL` `apply.budget_*` descriptions to say these adjust the user's monthly income/expense totals (same deploy as Phase D).
   - **Callers to sanity-check after the change:** `Plan.jsx applyAndMark`, `AIAdvisor.jsx applyPlanStep`, `ArtifactRenderer`'s `'budget'` action.
2. **Done section.** In the single plan card, completed steps move out of the main list into a collapsed accordion at the bottom: header `"Done · ${doneCount}"` (+ `"since ${month of oldest completedAt}"` when known), chevron expand. Stamp `completedAt: ISO` in `toggleStep` when marking done (and clear it on un-toggle). Both `Plan.jsx toggleStep` and `Dashboard.jsx toggleStep` stamp it.
3. **Advisor acknowledges specifics.** In `buildContext`'s plan section, add the last 2–3 completed step texts (most recent `completedAt` first): `Recently completed: "…", "…" — acknowledge this progress.` Cheap, and makes the advisor feel like it's watching the same list.
4. **Goal-planted linkback.** When a step's `apply.type === 'goal'` has been applied, the existing "Added to your garden" confirmation becomes a link to `/plan#goals` ("Goal planted → view it"). One-line change in `StepRow`.

### Explicitly out of scope (don't build these now)

- Drag-to-reorder steps (mobile drag is finicky; the priority ladder covers 90% of the need).
- Recurring/repeating steps ("transfer $200 every payday") — real future value, but it changes the milestone math; punt.
- Any schema migration SQL / new tables.
- Notifications/reminders for due dates.

---

## 5. Execution order

1. **Phase A** (the load-bearing change — everything else assumes one plan). Includes the four caller repoints and the lazy merge.
2. **Phase B** (`planOrder.js`, hero card, Dashboard peek swap).
3. **Phase C** (GardenMeter).
4. **Phase E** items 2–4 (done section, context, linkback) — client-only.
5. **Phase D + E item 1 together** (both touch the edge-function tool schema; one deploy, after asking the user).
6. Verification sweep (below), commit. **No push until the user says "push".**

---

## 6. Verification (required, live — not assumed)

Preview server config is `.claude/launch.json` → name **"Garden Financial"** (port 5173). Test at **375×812** and desktop.

1. `npm run build` green; no unused-import warnings from deleted paths.
2. **Merge safety:** with a test user owning ≥2 plans (create via the advisor twice), load `/plan` → exactly one card, all steps present, `done` flags intact, extra rows gone from `advisor_plans` (verify via Supabase query). Reload → still one (idempotent).
3. **Append + dedupe:** in the advisor, "Add this to my plan" twice for the same advice → second time reports steps already there; no duplicate rows in the list.
4. **Ordering:** craft steps hitting different ladder rungs (a debt step, a Roth step, one overdue due-date) → overdue first, debt before Roth; Dashboard peek shows the same top 2.
5. **Hero + meter loop:** check the "Do this next" step → meter fills/pulses immediately, done-count increments, step moves to Done accordion; crossing a threshold (e.g. 2→3 done) fires `GardenGrowthToast` AND the garden on `/` shows the new stage.
6. **Budget apply:** a step with an expense apply → tap → `profiles.monthly_expenses` actually changes (check `/money` and the advisor context by asking "what are my expenses?").
7. **Per-step delete:** arm + confirm removes one step, others untouched, persists after reload.
8. **Advisor sync:** complete a step, ask the advisor "how am I doing?" → reply references the completed step.
9. **Mobile sweep:** 375px — hero card, meter, chips, Done accordion: no overflow, no clipped tap targets, nav-pill clearance (`pb-24`) intact on the Plan page.

---

## 7. Risks

- **The merge is the only risky write.** It deletes rows; do the merged-steps write *first*, verify it succeeded, then delete extras. If the write fails, bail and leave the multi-plan state (the UI can render multi-plan for one more session; nothing corrupts).
- Dedupe false-positives could silently drop a wanted step — that's why containment matching only compares against **not-done** steps and why `appendSteps` reports `skipped` so the UI says it out loud.
- The keyword priority ladder is heuristic; keep it in one exported table (`planOrder.js`) with a comment, so tuning it is a one-file change.
- Edge-function schema changes are backward compatible both directions (new fields optional on the client, ignored by an old server), so a stale deploy can't break chat.
