# Garden Financial — Action Plan

A working roadmap scoped for **Claude (me) to execute autonomously**. Every item below
is self-contained, has an acceptance check I can verify (build clean, `/garden-preview`,
screenshot, or a test), and is sized for a focused work session.

## Legend
- **Size:** `S` < ~1hr · `M` half-session · `L` multi-session
- 🔴 **Needs you** — a secret, an SQL run, a product decision, or a deploy I can't do alone
- ✅ **Already built** — verified this exists and is solid; listed so we don't rebuild it

## Honest baseline (verified Jun 2026)
The app is mature. These are **done and high quality** — do not rebuild:
- ✅ Goals: type selector, timeline projection, inline progress, summary cards
- ✅ Budget: recurring/one-time, category limits, transaction logging, actual-vs-budget, CSV export
- ✅ Debt: avalanche/snowball payoff simulator, extra-payment slider, payment recorder, cleared milestones
- ✅ Accounts: grouped accounts, **net-worth history chart with daily auto-snapshots**
- ✅ AI Advisor: diagnostic system prompt, full financial context, conversation persistence, profile-aware
- ✅ Garden 3D: Hay Day-style art, tap-to-open plots, organized layout (polished this session)

So this plan is **hardening + cohesion + a few genuinely new features**, not a rewrite.

---

## Track 0 — Ship-blockers (do these first)

### 0.1 🔴 Move the Claude API key off the client `M`
**Problem:** `src/lib/claude.js` calls Anthropic directly from the browser with
`anthropic-dangerous-direct-browser-access: true`. The key ships in the bundle — anyone
can extract and abuse it. This blocks any real/public deploy.
**Do:** Add a serverless proxy (Supabase Edge Function or a `/api/chat` function for the
host platform). Move the key to a server env var. `callClaude` posts to the proxy; the
proxy injects the key and forwards to Anthropic. Optionally stream the response.
**Needs you:** confirm hosting target (Supabase Edge Functions vs Vercel/Netlify) + set the server-side secret.
**Acceptance:** advisor still replies; `VITE_ANTHROPIC_API_KEY` no longer referenced in client code; key absent from built bundle.

### 0.2 🔴 Reconcile the database schema + migrations `S`
**Problem:** `supabase/migrations.sql` is missing tables the code already uses
(`transactions`, `conversations`, `profiles`) and the `goal_type` column may not be applied.
**Do:** Write the full, idempotent migration set (all tables + RLS policies) so a fresh
Supabase project can be stood up from the file. Keep the pending `goal_type` ALTER.
**Needs you:** run the SQL in the Supabase SQL editor.
**Acceptance:** migrations.sql, run on a clean project, produces a schema that boots the app with no missing-column/table errors.

### 0.3 Fix the nested-`<button>` in DailyInsight `S`
**Problem:** `DailyInsight.jsx:~59` renders a `<button>` inside a `<button>` (invalid HTML, React warns, can break clicks).
**Do:** Make the outer container a non-button (div with role/handlers) or move the inner action out.
**Acceptance:** no `validateDOMNesting` warning in console; expand/collapse + inner action still work.

### 0.4 Remove dead code `S`
**Do:** Delete `src/components/garden/GardenVisual.jsx` and `GardenBackground.jsx` (the old
2D garden — imported nowhere). Prune now-unused exports in `gardenUtils.js`
(`getGrassColors`, `getSunStyle`, `getCloudStyle`, `WEED_POSITIONS`, `getPlantStage`,
`getWeedCount` — confirm each is unreferenced first).
**Acceptance:** build clean, app renders identically, bundle slightly smaller.

### 0.5 App-wide error boundary + 404 route `S`
**Do:** Wrap routes in a top-level error boundary (friendly fallback) and add a catch-all
`*` route. Only the garden Canvas is currently protected.
**Acceptance:** throwing in a page shows the fallback, not a white screen; unknown URLs render the 404.

---

## Track 1 — Garden (the centerpiece)

### 1.1 Live-update the garden when data changes `M`
**Problem:** `GardenContext` only updates on Dashboard mount. Editing a goal elsewhere
won't reflect until remount.
**Do:** Have mutations (goal/account/debt save) refresh the shared garden state, or move
the data fetch into context with an invalidate function.
**Acceptance:** add/edit a goal on Goals page → return to Dashboard → garden reflects it without a hard reload.

### 1.2 Tap a plot → quick "add contribution" `M`
**Now:** tapping a plot navigates to `/goals`.
**Do:** Open a small in-place modal to add to that goal's `current_amount` (and watch the
tree grow), with a link to full edit. Reuse the existing update mutation.
**Acceptance:** tap plot → modal → enter amount → tree stage updates live.

### 1.3 Tie more garden signals to real data `M`
**Do:** Map more finance state to garden visuals already scaffolded: debt load → weeds,
emergency-fund months → pond/stream fullness, surplus → sun/sky, retirement → birds.
Some exist (weather/tiers); make the mapping intentional and documented.
**Acceptance:** scenario switcher in `/garden-preview` shows each signal visibly changing the scene.

### 1.4 Mobile performance budget `M`
**Do:** Audit draw calls/instancing, cap DPR on low-end, lazy-mount the Canvas when in
view, and honor `prefers-reduced-motion` with a static/low-motion fallback.
**Acceptance:** mid-tier phone profile holds ~60fps or degrades gracefully; reduced-motion users get a calm scene.

### 1.5 Garden polish backlog `S–M`
Fence gap where the stream would meet it · subtle seasonal tint option · optional
low-detail toggle. Cherry-pick as desired.

---

## Track 2 — UX & UI cohesion

### 2.1 Global toasts for actions `S`
**Do:** Wire `sonner` (already present) for save/delete/error feedback across pages
(currently silent). Consolidate to one toast system (sonner) and drop the unused radix one.
**Acceptance:** saving/deleting a goal/debt/account/budget shows a toast; one toast lib in the bundle.

### 2.2 Route transitions `S`
**Do:** Add tasteful page-level enter/exit animation (framer-motion + `AnimatePresence`) at the router.
**Acceptance:** navigating between tabs animates smoothly; no layout jank.

### 2.3 Empty + loading state audit `S`
**Do:** Make skeletons/empty states consistent in tone and layout across all pages.
**Acceptance:** every page has a deliberate empty state and a matching skeleton.

### 2.4 Accessibility pass `M`
**Do:** Visible focus rings, `aria` labels on icon buttons, color-contrast check, keyboard
nav for modals (focus trap + Esc), `prefers-reduced-motion` for animations.
**Acceptance:** keyboard-only can complete add-goal flow; axe shows no critical issues.

### 2.5 Design-token consistency `S`
**Do:** Audit glass cards, spacing scale, and typography for one consistent system; factor
repeated patterns into shared components.
**Acceptance:** spot-check shows consistent radii/spacing/weights; less duplicated class soup.

### 2.6 Mobile responsiveness audit `S`
**Do:** Safe-area insets, 44px tap targets (mostly done), no horizontal overflow, modal
behavior on small screens.
**Acceptance:** 360px-wide profile shows no overflow; bottom HUD never overlaps content.

---

## Track 3 — Features / value (genuinely new)

### 3.1 Settings / Profile page `M`
**Gap:** profile is only editable via the Onboarding modal; no `/settings` route.
**Do:** A page to edit profile fields (age, employment, 401k, insurance, primary goal),
manage account (sign out, delete data/danger zone), and app prefs (currency/locale).
**Acceptance:** new `/settings` route; edits persist to `profiles`; advisor context reflects changes.

### 3.2 Monthly summary / report `M`
**Do:** A "this month" recap — income vs spend, net-worth delta, goal progress, top
category, one advisor takeaway. Surfaceable on Dashboard and/or its own view.
**Acceptance:** renders from real data; handles sparse/empty months gracefully.

### 3.3 Recurring → actuals automation (opt-in) `M`
**Do:** Optionally auto-create monthly transactions from recurring budget items so
actual-vs-budget isn't all manual. Guard against duplicates per month.
**Acceptance:** toggling on generates this month's recurring expenses once; no dupes on revisit.

### 3.4 Net-worth chart enhancements `S–M`
**Do:** Range selector (30/90/all), simple projection line from monthly net + contributions,
optional contributions overlay.
**Acceptance:** range changes redraw; projection is clearly labeled as an estimate.

### 3.5 Shareable garden image `M`
**Do:** Capture the Canvas to a PNG with a tasteful frame (score/net-worth caption) for sharing.
**Acceptance:** a "Share garden" action exports a clean image.

### 3.6 🔴 Reminders / notifications `L`
Bill-due and goal-nudge reminders. **Needs you:** decision on channel (web push vs email)
and infra. Scaffold only after that.

---

## Track 4 — Onboarding & growth

### 4.1 Onboarding polish + demo data `M`
**Do:** Tighten the first-run flow; offer a "load sample data" toggle so a new user sees a
living garden + populated pages instantly (clearly removable).
**Acceptance:** brand-new account can choose demo data and explore a full app in one tap.

### 4.2 First-run garden coach marks `S`
**Do:** Light guidance over an empty garden pointing to "plant your first goal."
**Acceptance:** empty-state garden invites the first goal; dismissable, shown once.

### 4.3 Profile-completeness → advisor unlocks `S`
**Do:** Use the existing completeness meter to nudge the few profile fields that most
improve advisor quality (401k match, insurance).
**Acceptance:** completing a field updates the meter and visibly enriches advisor context.

---

## Track 5 — Platform & quality

### 5.1 Tests `M`
**Do:** Add Vitest. Unit-test pure logic first (`computeScores`, `simulatePayoff`,
goal projection, `goalIcon`) + a couple of render smoke tests. No test setup exists today.
**Acceptance:** `npm test` runs green in CI and locally; core money math is covered.

### 5.2 PWA / installable `M`
**Do:** Manifest, icons, service worker (offline app shell), iOS meta. Makes the mobile-first app installable.
**Acceptance:** Lighthouse PWA checks pass; installs to home screen.

### 5.3 Performance / bundle `S–M`
**Do:** Lazy-load the 3D garden and recharts, code-split routes, verify asset/glb sizes.
**Acceptance:** initial JS drops meaningfully; Dashboard interactive faster on cold load.

### 5.4 🔴 Supabase RLS audit `S`
**Do:** Verify every table has row-level security scoped to `auth.uid()`. **Needs you:** run any policy fixes.
**Acceptance:** documented policy per table; no table world-readable.

### 5.5 🔴 Error monitoring + analytics `S`
**Do:** Add privacy-respecting error reporting (e.g., Sentry) and minimal product analytics.
**Needs you:** choose vendor + provide DSN/key.

---

## Suggested sequence
1. **Phase 1 — Harden:** Track 0 in full, then 2.1 (toasts) and 5.1 (tests for money math).
2. **Phase 2 — Garden depth:** 1.1 → 1.2 → 1.3 → 1.4.
3. **Phase 3 — Cohesion:** Track 2 (2.2–2.6).
4. **Phase 4 — Value:** 3.1 (Settings) → 3.2 (Monthly summary) → 3.3/3.4 → Track 4.
5. **Phase 5 — Platform:** 5.2 (PWA) → 5.3 (perf) → 5.4/5.5.

Tell me a track/phase (or a single item ID) and I'll execute it end-to-end and verify.
