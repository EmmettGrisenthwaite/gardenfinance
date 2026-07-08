# Garden Upgrade Plan — graphics + function, mobile-first

**Audience:** an AI coding agent (Kimi) working on this repo without prior session context.
**Goal:** make the 3D garden look dramatically better and feel interactive/alive on a phone
(375×812 is the reference viewport — the garden IS the mobile dashboard), without breaking
the systems described below or blowing the mobile perf budget.

Everything lives in `src/components/garden/Garden3D.jsx` (~1,435 lines) unless noted.
Line numbers below are approximate anchors — search for the symbol names.

---

## 1. How the garden works today (read before touching anything)

- **It's a milestone reward system.** `src/context/GardenContext.jsx` maps
  `completedSteps + goalsReached` → `stage` 0–5 (Barren → Flourishing). Weather
  (clouds/wind) comes from budget surplus. `netWorthTier` adds birds/sparkles.
  The garden **never** drives financial logic — display only.
- **Goals are trees.** `QUADRANT_SLOTS` (~line 1106) defines 8 positions — one per
  quadrant first, then an outer ring. `GoalSlot` (~859) plants a tree that grows with
  goal progress (`SavingsPlant`/`InvestPlant` stages 0–5); at 100% `CementedBase` (~838)
  adds a stone plinth + gold plaque ("cemented accomplishment"). `EmptyPlot` (~818)
  renders exactly one "Add a goal" invitation in the next free slot. Tap handlers
  navigate to `/plan#goals` (see `Garden3D` memo component, ~1405).
- **Scene composition** (`Scene` ~1300, `IslandGroup` ~1229): floating island disc
  (radius ≈ 8.3 wu, top surface y ≈ 0.95), stream running E–W at z=0 with a center
  bridge, stone paths N–S, fence ring, lanterns, orchards keyed to tiers, flower beds +
  mushrooms + animals (`FarmLife`, stage ≥ 3) + `Birds` keyed to stage/netWorthTier.
- **Time of day**: `getTimeOfDay()` (~144) computes `isNight/isDusk/isDawn` once at load
  (`const TOD`, ~163) and drives sun color/intensity, fog, sparkles, lantern emissive,
  tone-mapping exposure.
- **Camera**: orthographic, position ≈ [18, 28, 18], `ResponsiveCamera` (~171) fits the
  island on BOTH axes (`min(width/19.8, height/21)`, clamped 12–56) and adds a gentle
  living drift, `lookAt(0, -0.8, 0)`. There is currently **no user camera interaction**.
- **Host page**: `src/pages/Dashboard.jsx` — greeting + stat strip + nudges on top, the
  garden fills the rest full-bleed with an edge-fade `maskImage`, `GardenHud` pill shows
  "Stage · N more steps → NextStage", and `GardenGrowthToast` fires when a check-off
  crosses a stage boundary (state `growth` in Dashboard/Plan).

## 2. Hard invariants — DO NOT BREAK

1. **`<EffectComposer multisampling={0}>` stays 0.** Multisampled render targets
   flicker/black-flash on mobile GLES + iOS Safari. This was a shipped bug; do not
   "fix" it back to 4.
2. **`dpr={[1, 1.5]}`, `<AdaptiveDpr pixelated />`, `<PerformanceMonitor>` stay.**
   Do not raise the dpr cap.
3. **No new post-processing passes** (no SSAO, DoF, bloom, god-rays). The existing
   HueSaturation + Vignette are the whole budget.
4. **`ResponsiveCamera`'s both-axis fit stays** — tall/narrow viewports must never clip
   the island. If you change framing constants, verify at 375×812 AND desktop.
5. **Goal slot system stays**: slots must remain in the four lawn quadrants, clear of the
   stream band (|z| ≥ ~1.6 near the water) and the N–S path (|x| ≥ ~1.6), inside the
   fence (r ≤ ~6.2). `SLOT_SIGN_OFFSET` exists because HTML markers in the same screen
   column collide — re-check marker overlap after ANY reposition (screen-x ≈ x − z in
   this iso view).
6. **HTML markers (`Signpost`, ~739) keep `zIndexRange={[20, 0]}` and
   `pointerEvents: 'none'`** — they must never block the nav or intercept taps meant
   for the canvas.
7. **Keep GLTF assets from `/public/models/*.glb` via the existing `GltfToon` loader**
   (it clones + re-materials to toon). Don't add heavy new model downloads (> ~150 KB
   total new assets).
8. **Don't reintroduce zone labels/pillars** (Savings/Debt/Emergency banners were
   deliberately removed) and don't rename stage copy in `GardenHud`.
9. Verify with `npm run build` + the preview at **375×812** after every phase.
   Zero new console errors/warnings.

## 3. Perf budget (mobile)

- New particles: **instanced or `<Sparkles>` only**; hard caps below.
- At most **1 new light** total (the celebration pulse), `distance`-bounded, decay 2.
- No per-frame React setState; animate via `useFrame` refs only.
- Target: no visible fps drop on `PerformanceMonitor` (wire `onDecline` to
  `console.warn('[garden] perf decline')` while developing; remove before commit).

---

## Phase A — Fill the void (the biggest visual win on phones)

On tall phone viewports the island floats in flat darkness; top/bottom thirds are dead.

**A1. In-canvas sky backdrop.** Add a large inverted sphere or gradient plane behind the
island (`Scene`, before `IslandGroup`): vertical gradient using `TOD.skyTop`→`TOD.bgColor`
(those constants already exist, ~150–160). At night add a sparse starfield
(`<Sparkles count={40} …>` far behind the island, slow speed). Keep the Dashboard's CSS
edge-fade mask working — the canvas clear color should still blend into the page
(`bgColor` already matches; the sky must fade toward it at the edges, e.g. a radial
alpha falloff or simply keep the gradient subtle).

**A2. Waterfalls off the stream ends.** The stream (E–W, control points ±6.4) ends
abruptly at the island rim. At each end add a small waterfall: 2–3 narrow vertical
planes with animated opacity/scroll (toon blue `#41d6ee` family) falling ~2.5 wu below
the rim, plus a `<Sparkles>` mist puff (count ≤ 10 each) at the base. Instantly sells
"floating island".

**A3. Dress the island underside.** `FloatingIsland` (~243) has a plain dirt drum.
Add 4–6 hanging roots (thin tapered cones, trunk brown) and 3 small floating rock
shards (icosahedrons, earth tones) slowly bobbing below/beside the island
(`useFrame` sine on refs). Cheap, huge silhouette improvement.

**A4. Cloud framing.** Existing `CloudShape`s drift near the horizon. Add 2 higher,
larger, fainter clouds positioned to occupy the upper third on tall viewports
(y ≈ 7–9). At night make them near-invisible (opacity by `TOD`).

Acceptance: at 375×812, top and bottom thirds contain visible atmosphere (sky gradient,
clouds/stars, waterfall + roots below); island no longer floats in a black void; desktop
still frames correctly.

## Phase B — Make it feel alive

**B1. Falling leaves** (stage ≥ 2): one instanced mesh, ≤ 14 quads, spawning above the
orchard trees, gentle sway + fall + fade, respawn loop. Autumn tones by day, dimmed at
night.

**B2. Fireflies at night** (`TOD.isNight`, stage ≥ 1): reuse `<Sparkles>` — warm yellow,
count ≤ 20, low near the lawns (y 1.2–2.2), slow. Pairs with the existing lantern glow.

**B3. Stream ripples**: 2–3 expanding ring meshes (`ringGeometry`, additive opacity
fade) looping at random points along the water. ≤ 3 concurrent.

**B4. Grass wind sync**: `GrassBlades` (~288) already takes `windStrength` — verify the
new leaves/clouds use the same `weather.windStrength` so a deficit-storm visibly stirs
everything together.

Acceptance: idle garden at stage ≥ 2 shows at least two kinds of ambient motion beyond
current baseline; night mode shows fireflies; no fps decline.

## Phase C — Touch interaction (mobile function)

**C1. Drag-to-peek orbit.** Horizontal drag on the canvas rotates the camera azimuth
±22° around the island (offset added to the base [18,28,18] orbit angle inside
`ResponsiveCamera`), with inertia and a slow spring back to center after release.
Vertical drag does nothing (page shouldn't scroll here — the garden owns its area).
Implement with pointer events on the canvas (`onPointerDown/Move/Up` on `Scene`'s
invisible ground plane or the gl dom element); keep the existing living drift additive.
**Must not** hijack taps: a press that moves < 8 px within 250 ms is a tap, not a drag.

**C2. Tap feedback on plots.** `InteractivePlot` already scales 1.07 on hover; hover
doesn't exist on touch. Add an active-press pop (scale 0.94 on pointerdown → spring to
1.07 → navigate on pointerup-as-tap). Also enlarge each plot's invisible hit area to
≥ 44 px equivalent (add a transparent `circleGeometry` r=1.5 hit mesh).

**C3. Tap a goal tree → contextual sheet instead of blind navigation** (function
upgrade): instead of navigating straight to `/plan#goals`, raise a compact bottom card
inside Dashboard (reuse dark-glass tokens: `bg-black/45 backdrop-blur-md border
border-white/10 rounded-2xl`) showing the goal name, progress bar, $current of $target,
and two buttons: "Add money" (→ `/plan#goals`) and a ✕. `Garden3D` already receives
`onSelectGoal` — extend it to pass the goal object up to Dashboard (it currently just
navigates; see the `goToGoals` wiring at the bottom of Garden3D.jsx and
`onSelectGoal={goToGoals}`). Keep "Add a goal" (EmptyPlot) navigating directly.
The sheet must clear the floating nav (`bottom-24`) and dismiss on backdrop tap.

Acceptance: drag peeks left/right and springs back; taps still open things reliably
(no dead taps, no accidental navigations after a drag); goal sheet shows correct data
at 375×812 and dismisses cleanly.

## Phase D — Reward moments (the emotional payoff)

**D1. In-scene growth burst.** When the user checks a step that grows the garden,
`GardenGrowthToast` already appears (Dashboard `growth` state / Plan `celebrate()`).
Add a scene-side celebration: in `GardenContext`, add a `burstAt` timestamp set by a
new `triggerBurst()` exposed from the provider; call it wherever `setGrowth(...)` fires
(Dashboard toggleStep, Plan celebrate). In `Scene`, watch `burstAt` via context and run
a 1.6 s one-shot: ~16 instanced leaf/petal sprites bursting upward from the island
center + a single warm `pointLight` pulse (intensity 0→2.4→0, distance 8). No React
state inside the canvas — drive with refs + `useFrame` and the timestamp.

**D2. Cement-stamp animation.** When a goal hits 100% and `CementedBase` first mounts,
animate it: plinth scales 0→1.15→1 with a dust puff (6 small gray sprites fading out).
Gate with a `useRef` "hasAnimated" so it only plays on mount transitions, not on every
re-render or initial page load of an already-cemented goal (skip animation if the goal
was already complete when the page loaded — pass an `animateIn` prop from `GoalSlot`
tracking previous pct in a ref).

**D3. HUD progress shimmer.** In `Dashboard.jsx`'s `GardenHud`, when `done` increases,
flash a brief emerald shimmer across the pill (CSS animation, 600 ms). Pure CSS, no
canvas work.

Acceptance: checking a step on the Plan then returning to the garden (or checking via
the dashboard's "Next in your plan") produces a visible in-scene burst in sync with the
toast; completing a goal plays the stamp once; nothing plays on plain page load.

## Phase E — QA gates (run all before every commit)

1. `npm run build` green.
2. Preview at **375×812**: screenshot Barren-ish state (test account with few
   milestones if available) and Thriving state; nothing clipped, markers readable and
   non-overlapping, nav not obstructed, no raw dark void top/bottom.
3. Desktop (≥ 1280 px): same screenshots; framing correct.
4. Console: zero new errors/warnings.
5. Interaction pass: 10 rapid taps on plots (all navigate/open), drag left-right-release
   (springs back), drag-then-release-on-plot (does NOT navigate).
6. Night mode: temporarily force `isNight` in `getTimeOfDay()` to verify fireflies/
   stars/waterfall read well in the dark, then revert.
7. Perf: `PerformanceMonitor` shows no decline during 30 s idle + one celebration burst.

## Commit conventions

- One commit per phase, message prefix `garden:`.
- Do not push to `main` unless the repo owner says to deploy; work on the current branch.
- If a phase forces touching an invariant from §2, STOP and ask instead of proceeding.
