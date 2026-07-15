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

function LandscapeLayers({ layers, legacyFlowerCount }) {
  const has = layer => layers.includes(layer)
  return (
    <svg className="illustrated-garden-layers" viewBox="0 0 1000 563" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="garden-water-light">
        <path d="M424 324c48 10 83 6 126-13M451 350c46 8 83 3 121-15M485 390c34 5 57 1 84-12" fill="none" stroke="rgba(179,248,236,.38)" strokeWidth="4" strokeLinecap="round" />
      </g>
      {has('groundCover') && <g className="garden-reveal garden-ground-cover">
        <path d="M126 382c68-18 134-19 196-4M668 379c65-16 128-14 188 4M370 261c83-18 171-18 254 0" fill="none" stroke="#6e9a54" strokeWidth="12" strokeLinecap="round" strokeDasharray="2 20" />
      </g>}
      {has('sprouts') && <g className="garden-reveal garden-sprouts" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[[186,368],[258,395],[766,384],[825,357],[454,276],[562,270]].map(([x,y]) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 14V0M0 7C-9 7-14 2-14-5C-5-6 1-1 0 7M0 5C8 5 13 0 13-7C5-8-1-2 0 5" stroke="#91bf6a" strokeWidth="4" fill="#668f52" />
        </g>)}
      </g>}
      {has('youngTrees') && <g className="garden-reveal garden-young-trees">
        <g transform="translate(150 304)"><path d="M0 74l8-56h8l8 56" fill="#7c5b3c"/><circle cx="12" cy="17" r="34" fill="#3d7652"/><circle cx="-4" cy="27" r="22" fill="#4b875b"/></g>
        <g transform="translate(807 307)"><path d="M0 72l8-53h8l8 53" fill="#7c5b3c"/><circle cx="12" cy="18" r="33" fill="#386b4d"/><circle cx="30" cy="29" r="21" fill="#4a8258"/></g>
      </g>}
      {has('flowers') && <g className="garden-reveal garden-flowers">
        {[[118,401],[144,419],[335,398],[650,395],[858,413],[891,394],[397,286],[612,285]].map(([x,y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 13V2" stroke="#73a45e" strokeWidth="3" />
          <circle cy="0" r="7" fill={index % 2 ? '#e9c47b' : '#e6a9a2'} /><circle r="2.5" fill="#f7e5a5" />
        </g>)}
      </g>}
      {has('matureTrees') && <g className="garden-reveal garden-mature-trees">
        <g transform="translate(87 273)"><path d="M20 120l13-84h18l12 84" fill="#6b4a35"/><circle cx="40" cy="27" r="52" fill="#214f3c"/><circle cx="9" cy="48" r="35" fill="#2c6548"/><circle cx="72" cy="50" r="39" fill="#357653"/></g>
        <g transform="translate(846 267)"><path d="M16 116l12-82h18l13 82" fill="#694936"/><circle cx="38" cy="29" r="50" fill="#204a39"/><circle cx="6" cy="52" r="34" fill="#2a6045"/><circle cx="70" cy="48" r="38" fill="#397957"/></g>
      </g>}
      {has('legacyGrove') && <g className="garden-reveal garden-legacy-grove">
        <path d="M693 279c38-24 77-29 115-14" stroke="#356d4b" strokeWidth="12" fill="none" strokeLinecap="round" />
        {Array.from({ length: Math.max(3, legacyFlowerCount) }, (_, index) => {
          const x = 706 + (index % 5) * 23
          const y = 270 + Math.floor(index / 5) * 18 + (index % 2) * 7
          return <g key={index} transform={`translate(${x} ${y})`}><circle r="8" fill={index % 2 ? '#f0bf8d' : '#eab1b1'} /><circle r="3" fill="#fff0b6" /></g>
        })}
      </g>}
      {has('sanctuary') && <g className="garden-reveal garden-sanctuary" transform="translate(426 184)">
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
  onOpenStory,
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
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-white">{manifest.name}</h2>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-readable-secondary">{milestoneTotal} milestones</span>
          </div>
        </div>
        <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white/[0.06]" style={{ background: STAGE_COLORS[stage] }} />
      </div>

      <button type="button" onClick={onOpenStory} aria-label={`Open Garden Story. ${summary}`}
        className={`illustrated-garden-art ${moving ? 'is-moving' : ''} tone-${sceneTone} momentum-${momentum}`}>
        <picture>
          <source type="image/webp" srcSet="/illustrations/garden-seedbed-960.webp 960w, /illustrations/garden-seedbed-1600.webp 1600w" sizes="(min-width: 768px) 55vw, 100vw" />
          <img src="/illustrations/garden-seedbed-1600.webp" width="1672" height="941" alt="" decoding="async" fetchPriority="high" />
        </picture>
        <span className="garden-sky-softener" aria-hidden="true" />
        <span className="garden-drifting-light" aria-hidden="true" />
        <LandscapeLayers layers={manifest.layers} legacyFlowerCount={layout.legacyFlowerCount} />
        {layout.visible.map(placement => <GoalPlant key={placement.goal.id} placement={placement} />)}
        <span className="illustrated-garden-open-cue">Open garden story</span>
      </button>

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
