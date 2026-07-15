import { useEffect, useMemo, useRef, useState } from 'react'
import { Flower2, Sprout } from 'lucide-react'
import {
  illustratedGardenSummary,
  illustratedGoalLayout,
  illustratedStage,
} from '@/lib/illustratedGarden'
import { stageProgress, STAGE_COLORS, STAGE_NAMES } from '@/lib/gardenModel'
import './IllustratedGarden.css'

function GoalPlant({ placement }) {
  const investment = placement.species === 'investment'
  return (
    <span
      aria-hidden="true"
      className={`illustrated-goal-plant illustrated-goal-plant--${placement.species}`}
      style={{ left: `${placement.slot.x}%`, top: `${placement.slot.y}%`, '--goal-scale': placement.scale }}
    >
      <svg viewBox="0 0 76 94" role="presentation">
        <ellipse cx="38" cy="86" rx="24" ry="6" fill="rgba(7,18,13,.34)" />
        <path d="M38 84C36 65 38 47 40 27" stroke={investment ? '#b58a58' : '#7f9d55'} strokeWidth="5" strokeLinecap="round" />
        <path d="M39 58C25 52 20 42 22 34C33 34 41 43 40 55" fill={investment ? '#4d8e67' : '#689b5b'} />
        <path d="M40 48C51 43 58 35 57 27C47 26 39 35 39 46" fill={investment ? '#5fa176' : '#78ac61'} />
        {investment ? (
          <>
            <circle cx="41" cy="24" r="13" fill="#295c49" />
            <circle cx="30" cy="30" r="10" fill="#34725a" />
            <circle cx="52" cy="32" r="11" fill="#3d8062" />
            <circle cx="40" cy="37" r="12" fill="#4a8f68" />
          </>
        ) : (
          <>
            <path d="M40 28C27 24 22 15 24 7C35 7 43 14 43 26" fill="#5d9e5d" />
            <path d="M41 29C50 23 57 16 56 8C47 7 39 15 39 26" fill="#75b56a" />
          </>
        )}
        {placement.flowering && <>
          <circle cx="25" cy="24" r="5" fill="#e9c880" />
          <circle cx="54" cy="22" r="5" fill="#f0d7a1" />
          <circle cx="40" cy="12" r="5" fill="#f2c6aa" />
        </>}
      </svg>
    </span>
  )
}

// ─── The scene itself — fully hand-drawn, no photography ───────────────────────
// A flat, storybook dusk landscape painted in the app's emerald language. Drawn
// on the same 1000×563 canvas as the stage layers, so every sprout, tree, and
// goal plant keeps its coordinates. Clouds drift, the sun breathes, the stream
// flows, fireflies rise — all CSS-driven and silenced by reduced motion.
function SceneBase() {
  return (
    <svg className="garden-scene" viewBox="0 0 1000 563" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="gf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2731" />
          <stop offset="48%" stopColor="#143f3a" />
          <stop offset="78%" stopColor="#2a5c48" />
          <stop offset="100%" stopColor="#3c6b4b" />
        </linearGradient>
        <radialGradient id="gf-sun-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6d992" stopOpacity=".5" />
          <stop offset="55%" stopColor="#f0c778" stopOpacity=".16" />
          <stop offset="100%" stopColor="#f0c778" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gf-stream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c9aa0" />
          <stop offset="100%" stopColor="#2c6f7c" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="1000" height="563" fill="url(#gf-sky)" />

      {/* Sun, low and warm */}
      <g className="scene-sun">
        <circle className="scene-sun-halo" cx="712" cy="196" r="105" fill="url(#gf-sun-halo)" />
        <circle cx="712" cy="196" r="30" fill="#f4d38a" />
        <circle cx="712" cy="196" r="30" fill="#f9e7b5" opacity=".45" />
      </g>

      {/* Drifting clouds — group opacity keeps overlaps seamless (translucent
          children would double up where the puffs intersect) */}
      <g className="garden-cloud garden-cloud--far" opacity=".1" fill="#e2f3ec">
        <ellipse cx="180" cy="88" rx="74" ry="15" /><ellipse cx="222" cy="76" rx="44" ry="15" /><ellipse cx="146" cy="78" rx="34" ry="12" />
      </g>
      <g className="garden-cloud garden-cloud--mid" opacity=".13" fill="#e2f3ec">
        <ellipse cx="560" cy="120" rx="88" ry="16" /><ellipse cx="602" cy="107" rx="50" ry="15" /><ellipse cx="518" cy="110" rx="38" ry="12" />
      </g>
      <g className="garden-cloud garden-cloud--near" opacity=".11" fill="#e2f3ec">
        <ellipse cx="852" cy="66" rx="58" ry="12" /><ellipse cx="886" cy="56" rx="34" ry="10" />
      </g>

      {/* Distant hills */}
      <path d="M0 262C120 216 258 204 400 236C512 260 610 258 706 232C806 206 908 210 1000 240V320H0Z" fill="#11362c" />
      <path d="M0 292C150 258 300 252 452 278C596 302 740 296 872 268C918 258 962 256 1000 262V352H0Z" fill="#164434" />

      {/* Meadow */}
      <path d="M0 322C160 296 330 292 500 306C670 320 840 316 1000 296V563H0Z" fill="#1d5a3e" />
      <path d="M0 388C180 366 380 362 560 376C724 388 872 386 1000 370V563H0Z" fill="#236747" />
      {/* soft hummock shading */}
      <path d="M60 430c90-22 200-24 292-8M640 442c96-18 196-18 288 0" fill="none" stroke="#1b5138" strokeWidth="10" strokeLinecap="round" opacity=".55" />

      {/* Winding stream — a ribbon from the horizon dip down to the seedbed,
          narrow at the back, widening as it nears the viewer */}
      <path d="M556 302
               C544 332 524 356 492 376
               C458 396 424 412 396 432
               C374 448 358 462 350 478
               L488 478
               C486 458 496 438 516 418
               C538 396 554 372 562 348
               C568 330 570 314 568 302 Z"
        fill="url(#gf-stream)" opacity=".92" />
      <path d="M560 306
               C550 334 532 358 502 378
               C472 398 442 414 418 434
               C402 448 392 460 386 472
               L444 472
               C446 454 456 436 474 418
               C496 396 516 372 528 348
               C536 332 540 316 540 306 Z"
        fill="#63b3b7" opacity=".26" />
      <path className="garden-stream-flow" d="M562 308C552 336 532 360 502 380C472 400 442 418 418 438C404 450 394 462 388 472"
        fill="none" stroke="rgba(219,248,255,.42)" strokeWidth="5" strokeLinecap="round" strokeDasharray="12 30" />

      {/* Foreground tilled seedbed */}
      <path d="M0 470C140 452 320 446 500 452C690 458 860 456 1000 444V563H0Z" fill="#38281a" />
      <path d="M0 500c170-14 360-18 520-12 180 6 330 6 480-4" fill="none" stroke="#2a1e12" strokeWidth="7" strokeLinecap="round" opacity=".8" />
      <path d="M20 532c180-12 380-16 540-10 170 6 300 6 430-2" fill="none" stroke="#2a1e12" strokeWidth="7" strokeLinecap="round" opacity=".6" />
      {/* grassy lip where meadow meets the bed */}
      <path d="M0 470c150-18 330-24 510-18 190 7 350 5 490-8" fill="none" stroke="#2c7550" strokeWidth="9" strokeLinecap="round" opacity=".7" />

      {/* Fireflies — quiet sparks of life; count/speed follow momentum via CSS */}
      {[[168, 396], [318, 358], [452, 318], [608, 372], [742, 340], [860, 392], [530, 262]].map(([x, y], i) => (
        <circle key={i} className="garden-firefly" cx={x} cy={y} r="2.6" fill="#ffe9a8" />
      ))}
    </svg>
  )
}

function LandscapeLayers({ layers, legacyFlowerCount }) {
  const has = layer => layers.includes(layer)
  return (
    <svg className="illustrated-garden-layers" viewBox="0 0 1000 563" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {has('groundCover') && <g className="garden-reveal garden-ground-cover">
        <path d="M126 382c68-18 134-19 196-4M668 379c65-16 128-14 188 4M380 332c83-14 171-14 254 0" fill="none" stroke="#6e9a54" strokeWidth="12" strokeLinecap="round" strokeDasharray="2 20" />
      </g>}
      {has('sprouts') && <g className="garden-reveal garden-sprouts" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[[186,368],[258,395],[766,384],[825,357],[462,322],[614,326]].map(([x,y]) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 14V0M0 7C-9 7-14 2-14-5C-5-6 1-1 0 7M0 5C8 5 13 0 13-7C5-8-1-2 0 5" stroke="#91bf6a" strokeWidth="4" fill="#668f52" />
        </g>)}
      </g>}
      {has('youngTrees') && <g className="garden-reveal garden-young-trees">
        <g transform="translate(150 304)">
          <path d="M0 74l8-56h8l8 56" fill="#6d4b32"/>
          <circle cx="12" cy="16" r="32" fill="#25573f"/>
          <circle cx="-6" cy="28" r="20" fill="#2f6a4b"/>
          <circle cx="28" cy="30" r="18" fill="#398057"/>
          <circle cx="8" cy="8" r="16" fill="#438f60"/>
        </g>
        <g transform="translate(807 307)">
          <path d="M0 72l8-53h8l8 53" fill="#6d4b32"/>
          <circle cx="12" cy="17" r="31" fill="#22503a"/>
          <circle cx="30" cy="30" r="18" fill="#2e6747"/>
          <circle cx="-4" cy="28" r="17" fill="#377a53"/>
          <circle cx="16" cy="8" r="15" fill="#418a5d"/>
        </g>
      </g>}
      {has('flowers') && <g className="garden-reveal garden-flowers">
        {[[118,401],[144,419],[335,398],[650,395],[858,413],[891,394],[398,330],[640,338]].map(([x,y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 13V2" stroke="#73a45e" strokeWidth="3" />
          <circle cy="0" r="7" fill={index % 2 ? '#e9c47b' : '#e6a9a2'} /><circle r="2.5" fill="#f7e5a5" />
        </g>)}
      </g>}
      {has('matureTrees') && <g className="garden-reveal garden-mature-trees">
        <g transform="translate(87 273)"><path d="M20 120l13-84h18l12 84" fill="#6b4a35"/><circle cx="40" cy="27" r="52" fill="#214f3c"/><circle cx="9" cy="48" r="35" fill="#2c6548"/><circle cx="72" cy="50" r="39" fill="#357653"/></g>
        <g transform="translate(846 267)"><path d="M16 116l12-82h18l13 82" fill="#694936"/><circle cx="38" cy="29" r="50" fill="#204a39"/><circle cx="6" cy="52" r="34" fill="#2a6045"/><circle cx="70" cy="48" r="38" fill="#397957"/></g>
      </g>}
      {has('legacyGrove') && <g className="garden-reveal garden-legacy-grove">
        {/* a hedge of remembrance blooms rooted on the meadow, not the sky */}
        <path d="M688 352c42-14 84-16 124-4" stroke="#2e6647" strokeWidth="14" fill="none" strokeLinecap="round" />
        {Array.from({ length: Math.max(3, legacyFlowerCount) }, (_, index) => {
          const x = 702 + (index % 5) * 24
          const y = 342 + Math.floor(index / 5) * 15 + (index % 2) * 6
          return <g key={index} transform={`translate(${x} ${y})`}><circle r="7" fill={index % 2 ? '#f0bf8d' : '#eab1b1'} /><circle r="2.5" fill="#fff0b6" /></g>
        })}
      </g>}
      {has('sanctuary') && <g className="garden-reveal garden-sanctuary" transform="translate(426 208)">
        <path d="M0 81h148v12H0z" fill="#6e5a43"/><path d="M18 38h112v48H18z" fill="#c4b28d"/><path d="M4 42L74 0l70 42" fill="#365f49"/><path d="M58 52h32v34H58z" fill="#5b4637"/><path d="M27 52h20v18H27zm74 0h20v18h-20z" fill="#d5c891"/>
      </g>}
    </svg>
  )
}

export default function IllustratedGarden({
  stage = 0,
  milestones = [],
  milestoneTotal = milestones.length,
  goals = [],
  momentum = 'resting',
  sceneTone = 'calm',
  reducedMotion = false,
  onSelectGoal,
  onSelectOverflow,
}) {
  const rootRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const manifest = illustratedStage(stage)
  const progress = stageProgress(milestoneTotal)
  const layout = useMemo(() => illustratedGoalLayout(goals, milestones), [goals, milestones])
  const summary = illustratedGardenSummary({ stage, milestoneTotal, goals, milestones })

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(document.visibilityState === 'visible' && entry.isIntersecting), { threshold: 0.08 })
    if (rootRef.current) observer.observe(rootRef.current)
    return () => { document.removeEventListener('visibilitychange', updateVisibility); observer.disconnect() }
  }, [])

  const moving = visible && !reducedMotion
  return (
    <section ref={rootRef} className={`illustrated-garden ${reducedMotion ? 'is-reduced-motion' : ''}`} aria-label={summary}>
      <div className="illustrated-garden-status">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">Your permanent garden</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">{manifest.name}</h2>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-readable-secondary">{milestoneTotal} milestones</span>
          </div>
        </div>
        <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white/[0.06]" style={{ background: STAGE_COLORS[stage] }} />
      </div>

      <div role="img" aria-label={summary}
        className={`illustrated-garden-art ${moving ? 'is-moving' : ''} tone-${sceneTone} momentum-${momentum}`}>
        <SceneBase />
        <span className="garden-sky-softener" aria-hidden="true" />
        <span className="garden-drifting-light" aria-hidden="true" />
        <LandscapeLayers layers={manifest.layers} legacyFlowerCount={layout.legacyFlowerCount} />
        {layout.visible.map(placement => <GoalPlant key={placement.goal.id} placement={placement} />)}
      </div>

      <div className="illustrated-garden-progress" aria-label="Progress to next garden stage">
        <span><span style={{ width: `${progress.percent}%` }} /></span>
        <p>{progress.nextThreshold == null ? 'Sanctuary complete' : `${progress.remaining} to ${STAGE_NAMES[stage + 1]}`}</p>
      </div>

      {layout.visible.length > 0 && (
        <div className="illustrated-goal-controls" aria-label="Active goal plants">
          {layout.visible.map(({ goal, percent, species }) => (
            <button key={goal.id} type="button" onClick={() => onSelectGoal?.(goal)} className="illustrated-goal-control">
              {species === 'investment' ? <Sprout className="h-3.5 w-3.5" /> : <Flower2 className="h-3.5 w-3.5" />}
              <span>{goal.name}</span><strong>{percent}%</strong>
            </button>
          ))}
          {layout.overflowCount > 0 && <button type="button" onClick={onSelectOverflow} className="illustrated-goal-control illustrated-goal-control--overflow">+{layout.overflowCount} goals</button>}
        </div>
      )}
    </section>
  )
}
