import { useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sprout, Target, Droplets, Sun } from 'lucide-react'
import {
  computeScores, getPlantStage, getWeedCount,
  getGrassColors, getSunStyle, getCloudStyle, hasRecentWindfall,
} from '@/lib/gardenUtils'

// ─── Scene constants ───────────────────────────────────────────────────────────
const W = 800
const H = 300
const GROUND_Y = 232   // sky/grass boundary
const BASE_Y   = 244   // tree trunk base

// ─── Palette ───────────────────────────────────────────────────────────────────
const C = {
  t1: '#1b4332', t2: '#2d6a4f', t3: '#40916c', t4: '#52b788', t5: '#74c69d',
  shadow: 'rgba(0,50,20,0.22)',
  trunkL: '#8a5a2c', trunkD: '#5a3a18',
  weedG: '#4a7c59', weedB: '#854d0e',
}

// ─── Tree X positions per count ────────────────────────────────────────────────
function getTreePositions(n) {
  const all = {
    1: [{ x: 400, s: 1.0 }],
    2: [{ x: 268, s: 0.95 }, { x: 532, s: 0.95 }],
    3: [{ x: 188, s: 0.9  }, { x: 400, s: 1.0  }, { x: 612, s: 0.9  }],
    4: [{ x: 138, s: 0.88 }, { x: 315, s: 0.97 }, { x: 488, s: 0.97 }, { x: 662, s: 0.88 }],
    5: [{ x: 108, s: 0.85 }, { x: 252, s: 0.93 }, { x: 400, s: 1.0  }, { x: 548, s: 0.93 }, { x: 692, s: 0.85 }],
    6: [{ x: 88,  s: 0.83 }, { x: 212, s: 0.91 }, { x: 338, s: 0.97 }, { x: 462, s: 0.97 }, { x: 588, s: 0.91 }, { x: 712, s: 0.83 }],
  }
  return all[Math.min(Math.max(n, 1), 6)]
}

// ─── Weed positions (SVG coords) ───────────────────────────────────────────────
const WEEDS = [
  { cx: 30,      cy: BASE_Y + 2,  r: -12 },
  { cx: 68,      cy: BASE_Y + 4,  r:  11 },
  { cx: W - 35,  cy: BASE_Y + 2,  r:  14 },
  { cx: W - 72,  cy: BASE_Y + 4,  r:  -9 },
  { cx: 112,     cy: BASE_Y - 2,  r: -20 },
  { cx: W - 115, cy: BASE_Y - 2,  r:  18 },
]

// ─── <defs> ────────────────────────────────────────────────────────────────────
function Defs({ grassColors }) {
  return (
    <defs>
      <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#6db8dc" />
        <stop offset="100%" stopColor="#d6eff9" />
      </linearGradient>
      <linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={grassColors.light} />
        <stop offset="100%" stopColor={grassColors.dark}  />
      </linearGradient>
      <linearGradient id="gSoil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#9c7a55" />
        <stop offset="100%" stopColor="#6b4f30" />
      </linearGradient>
      <linearGradient id="gTrunk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={C.trunkD} />
        <stop offset="60%"  stopColor={C.trunkL} />
        <stop offset="100%" stopColor={C.trunkD} />
      </linearGradient>
    </defs>
  )
}

// ─── Sky + rolling hills background ───────────────────────────────────────────
function SceneBackground() {
  return (
    <>
      <rect width={W} height={H} fill="url(#gSky)" />
      {/* far hill — slow breathing float */}
      <motion.path fill="#a8d8a0" opacity="0.32"
        d={`M0,${GROUND_Y+8} Q100,${GROUND_Y-40} 220,${GROUND_Y-10} Q330,${GROUND_Y+10} 430,${GROUND_Y-38} Q530,${GROUND_Y-58} 650,${GROUND_Y-25} Q740,${GROUND_Y-5} ${W},${GROUND_Y-20} L${W},${H} L0,${H}Z`}
        animate={{ y: [0, -2.5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* near hill — slightly out of phase for natural feel */}
      <motion.path fill="#7bbf6a" opacity="0.38"
        d={`M0,${GROUND_Y+4} Q130,${GROUND_Y-18} 260,${GROUND_Y+6} Q390,${GROUND_Y+20} 500,${GROUND_Y-14} Q620,${GROUND_Y-30} ${W},${GROUND_Y} L${W},${H} L0,${H}Z`}
        animate={{ y: [0, -1.8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </>
  )
}

// ─── Grass + soil ground ───────────────────────────────────────────────────────
function Ground() {
  return (
    <>
      <path fill="url(#gGrass)"
        d={`M0,${GROUND_Y} Q200,${GROUND_Y-8} 400,${GROUND_Y+3} Q600,${GROUND_Y+10} ${W},${GROUND_Y-4} L${W},${H} L0,${H}Z`}
        style={{ transition: 'fill 1.5s ease' }}
      />
      {/* darker soil layer */}
      <path fill="url(#gSoil)" opacity="0.85"
        d={`M0,${GROUND_Y+20} Q200,${GROUND_Y+13} 400,${GROUND_Y+24} Q600,${GROUND_Y+32} ${W},${GROUND_Y+18} L${W},${H} L0,${H}Z`}
      />
      {/* grass highlight edge */}
      <path fill="none" stroke="rgba(140,220,100,0.5)" strokeWidth="2"
        d={`M0,${GROUND_Y} Q200,${GROUND_Y-8} 400,${GROUND_Y+3} Q600,${GROUND_Y+10} ${W},${GROUND_Y-4}`}
      />
    </>
  )
}

// ─── Wooden fence ──────────────────────────────────────────────────────────────
function Fence() {
  const planks = 22
  const gap    = W / (planks - 1)
  const rail1  = GROUND_Y - 46
  const rail2  = GROUND_Y - 20
  const top    = GROUND_Y - 64
  const bot    = GROUND_Y + 24
  return (
    <g>
      {Array.from({ length: planks }).map((_, i) => {
        const x = i * gap
        const l = 44 + (i % 3) * 6  // lightness variation
        return (
          <g key={i}>
            <rect x={x - 5.5} y={top} width={11} height={bot - top}
              fill={`hsl(30,46%,${l}%)`} rx="2" />
            <line x1={x - 3} y1={top + 7}  x2={x - 3} y2={top + 22} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
            <line x1={x + 1} y1={top + 12} x2={x + 1} y2={top + 32} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
          </g>
        )
      })}
      {/* rails */}
      <rect x="0" y={rail1} width={W} height="8" fill="#7a4f22" rx="2" />
      <rect x="0" y={rail1 + 2} width={W} height="2" fill="rgba(255,255,255,0.14)" />
      <rect x="0" y={rail2} width={W} height="8" fill="#7a4f22" rx="2" />
      <rect x="0" y={rail2 + 2} width={W} height="2" fill="rgba(255,255,255,0.14)" />
    </g>
  )
}

// ─── Sun ───────────────────────────────────────────────────────────────────────
function SunEl({ surplusRatio }) {
  const { size, opacity, glowing } = getSunStyle(surplusRatio)
  const r  = size / 2
  const cx = W - 78
  const cy = 52
  return (
    <motion.g animate={{ scale: glowing ? [1, 1.06, 1] : 1 }} transition={{ duration: 4, repeat: Infinity }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}>
      {glowing && <circle cx={cx} cy={cy} r={r + 20} fill="rgba(255,220,80,0.18)" />}
      <circle cx={cx} cy={cy} r={r} fill="#FFD166" opacity={opacity} />
      {glowing && <circle cx={cx} cy={cy} r={r * 0.55} fill="#FFE99A" opacity="0.65" />}
    </motion.g>
  )
}

// ─── Clouds ────────────────────────────────────────────────────────────────────
const CLOUD_DEFS = [
  { cx: 110, cy: 46, sx: 1.0 },
  { cx: 370, cy: 36, sx: 1.15 },
  { cx: 555, cy: 52, sx: 0.82 },
  { cx: 218, cy: 66, sx: 0.68 },
]
function CloudEl({ count, dark }) {
  const fill = dark ? 'rgba(160,160,172,0.82)' : 'rgba(255,255,255,0.88)'
  return (
    <>
      {CLOUD_DEFS.slice(0, count).map((c, i) => (
        <motion.g key={i} animate={{ x: [-12, 12, -12] }}
          transition={{ duration: 36 + i * 10, repeat: Infinity, ease: 'linear' }}>
          <g transform={`translate(${c.cx},${c.cy}) scale(${c.sx})`}>
            <ellipse cx="0"   cy="0"   rx="48" ry="22" fill={fill} />
            <ellipse cx="-25" cy="6"   rx="30" ry="18" fill={fill} />
            <ellipse cx="25"  cy="4"   rx="34" ry="19" fill={fill} />
            <ellipse cx="-6"  cy="-13" rx="32" ry="20" fill={fill} />
            <ellipse cx="14"  cy="-11" rx="27" ry="17" fill={fill} />
          </g>
        </motion.g>
      ))}
    </>
  )
}

// ─── Rain ──────────────────────────────────────────────────────────────────────
function RainEl({ severity }) {
  const drops = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    x:   40 + (i * 43) % 720,
    y:    5 + (i * 16) % 110,
    dl:   (i * 0.17) % 1.7,
    dur:  0.68 + (i * 0.06) % 0.5,
  })), [])
  return (
    <g opacity={0.35 + severity * 0.45}>
      {drops.map((d, i) => (
        <motion.line key={i}
          x1={d.x} y1={d.y} x2={d.x - 3} y2={d.y + 10}
          stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"
          animate={{ y: [0, H + 20] }}
          transition={{ duration: d.dur, repeat: Infinity, delay: d.dl, ease: 'linear' }}
        />
      ))}
    </g>
  )
}

// ─── Background silhouettes (decorative always-on trees) ──────────────────────
function BgSilhouettes() {
  const trees = [
    { x: 40,      h: 58, w: 19 },
    { x: 88,      h: 70, w: 22 },
    { x: W - 44,  h: 62, w: 20 },
    { x: W - 90,  h: 52, w: 17 },
  ]
  return (
    <g opacity="0.14">
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x},${GROUND_Y})`}>
          <polygon points={`0,${-t.h} ${-t.w/2},0 ${t.w/2},0`}            fill="#1b4332" />
          <polygon points={`0,${-t.h*.68} ${-t.w*.4},${-t.h*.18} ${t.w*.4},${-t.h*.18}`} fill="#2d6a4f" />
        </g>
      ))}
    </g>
  )
}

// ─── Single conifer tier (triangle + shadow) ───────────────────────────────────
function Tier({ apexY, baseY, halfW, fill }) {
  return (
    <g>
      <polygon points={`0,${apexY} ${-halfW},${baseY} ${halfW},${baseY}`} fill={fill} />
      <polygon points={`0,${apexY} ${-halfW},${baseY} ${-halfW*.12},${baseY}`}
        fill="rgba(0,0,0,0.24)" />
      <polygon points={`0,${apexY} ${halfW},${baseY} ${halfW*.7},${baseY}`}
        fill="rgba(255,255,255,0.07)" />
    </g>
  )
}

// Stage → tier config
const TIER_DATA = {
  2: [
    { apexY: -62, baseY: -14, halfW: 26, fill: C.t2 },
    { apexY: -94, baseY: -48, halfW: 19, fill: C.t3 },
  ],
  3: [
    { apexY: -58, baseY: -12, halfW: 28, fill: C.t1 },
    { apexY: -90, baseY: -44, halfW: 21, fill: C.t2 },
    { apexY:-118, baseY: -75, halfW: 15, fill: C.t3 },
  ],
  4: [
    { apexY: -54, baseY: -12, halfW: 31, fill: C.t1 },
    { apexY: -87, baseY: -41, halfW: 24, fill: C.t2 },
    { apexY:-115, baseY: -72, halfW: 18, fill: C.t3 },
    { apexY:-139, baseY:-100, halfW: 13, fill: C.t4 },
  ],
  5: [
    { apexY: -52, baseY: -12, halfW: 32, fill: C.t1 },
    { apexY: -85, baseY: -40, halfW: 25, fill: C.t2 },
    { apexY:-113, baseY: -71, halfW: 19, fill: C.t3 },
    { apexY:-138, baseY:-100, halfW: 14, fill: C.t4 },
    { apexY:-158, baseY:-125, halfW:  9, fill: C.t5 },
  ],
}

// ─── Conifer tree ──────────────────────────────────────────────────────────────
function ConiferTree({ x, stage, delay, s }) {
  const tiers = TIER_DATA[Math.min(Math.max(stage, 2), 5)]
  const topY  = tiers[tiers.length - 1].apexY
  const isComplete = stage === 5
  const FLOWERS = [
    { cx: -17, cy: -47 }, { cx: 13, cy: -54 },
    { cx: -9,  cy: -82 }, { cx: 15, cy: -78 },
  ]
  return (
    <motion.g transform={`translate(${x},${BASE_Y}) scale(${s})`}
      initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: s }}
      transition={{ duration: 0.8, type: 'spring', stiffness: 65, damping: 14, delay }}
      style={{ transformOrigin: `${x}px ${BASE_Y}px` }}
    >
      {/* Ground shadow ellipse */}
      <ellipse cx="0" cy="5" rx="28" ry="8" fill={C.shadow} />
      {/* Trunk */}
      <rect x="-4.5" y="-22" width="9" height="24" fill="url(#gTrunk)" rx="2" />
      {/* Tiers */}
      {tiers.map((t, i) => <Tier key={i} {...t} />)}
      {/* Tip */}
      <circle cx="0" cy={topY} r="3" fill={C.t5} opacity="0.8" />
      {/* Complete: glowing tip + flowers */}
      {isComplete && (
        <>
          <motion.circle cx="0" cy={topY} r="5.5" fill="#fde68a"
            animate={{ r: [4.5, 7, 4.5], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity }} />
          {FLOWERS.map((f, i) => (
            <motion.circle key={i} cx={f.cx} cy={f.cy} r="3.5"
              fill={i % 2 === 0 ? '#fbbf24' : '#f472b6'}
              animate={{ scale: [1, 1.45, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.42 }} />
          ))}
        </>
      )}
    </motion.g>
  )
}

// ─── Seedling ──────────────────────────────────────────────────────────────────
function SeedlingEl({ x, delay, s }) {
  return (
    <motion.g transform={`translate(${x},${BASE_Y}) scale(${s})`}
      initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.6, type: 'spring', delay }}
      style={{ transformOrigin: `${x}px ${BASE_Y}px` }}>
      <ellipse cx="0" cy="4" rx="10" ry="4" fill={C.shadow} />
      <line x1="0" y1="0" x2="0" y2="-32" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
      <motion.ellipse cx="-10" cy="-19" rx="9" ry="5" fill="#4ade80"
        style={{ transformOrigin: '-10px -19px', transform: 'rotate(-30deg)' }}
        animate={{ rotate: ['-30deg', '-16deg', '-30deg'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.ellipse cx="10" cy="-19" rx="9" ry="5" fill="#4ade80"
        style={{ transformOrigin: '10px -19px', transform: 'rotate(30deg)' }}
        animate={{ rotate: ['30deg', '16deg', '30deg'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
      <ellipse cx="0" cy="-34" rx="5" ry="6.5" fill="#86efac" />
    </motion.g>
  )
}

// ─── Soil mound (0%) ───────────────────────────────────────────────────────────
function SoilMound({ x, delay }) {
  return (
    <motion.g transform={`translate(${x},${BASE_Y})`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
      <ellipse cx="0" cy="2" rx="16" ry="6" fill="#8B6F47" opacity="0.65" />
      <ellipse cx="0" cy="-1" rx="9" ry="4" fill="#6b4f30" opacity="0.5" />
      <line x1="0" y1="-1" x2="-2" y2="-11" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="-4" cy="-13" rx="3.5" ry="2.2" fill="#4ade80"
        style={{ transform: 'rotate(-30deg)', transformOrigin: '-4px -13px' }} />
    </motion.g>
  )
}

// ─── Butterfly ─────────────────────────────────────────────────────────────────
function ButterflyEl({ x, topY }) {
  const by = BASE_Y + topY - 22
  return (
    <g transform={`translate(${x},${by})`}>
      <motion.g animate={{ x: [-14, 14, -14], y: [-7, 7, -7] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <motion.ellipse cx="-8" cy="-2" rx="10" ry="6.5" fill="#f97316" opacity="0.88"
          animate={{ scaleX: [1, 0.25, 1] }} transition={{ duration: 0.38, repeat: Infinity }} />
        <motion.ellipse cx="8" cy="-2" rx="10" ry="6.5" fill="#fb923c" opacity="0.88"
          animate={{ scaleX: [1, 0.25, 1] }} transition={{ duration: 0.38, repeat: Infinity }} />
        <ellipse cx="0" cy="0" rx="2.5" ry="6" fill="#7c2d12" />
      </motion.g>
    </g>
  )
}

// ─── Weed ──────────────────────────────────────────────────────────────────────
function WeedEl({ cx, cy, r }) {
  return (
    <motion.g transform={`translate(${cx},${cy}) rotate(${r})`}
      initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 0.88 }}
      transition={{ duration: 0.5 }}>
      <line x1="0" y1="0" x2="0" y2="-20" stroke={C.weedB} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="-10" cy="-11" rx="10" ry="5" fill={C.weedG}
        style={{ transform: 'rotate(-26deg)', transformOrigin: '-10px -11px' }} />
      <ellipse cx="10" cy="-11" rx="10" ry="5" fill={C.weedG}
        style={{ transform: 'rotate(26deg)', transformOrigin: '10px -11px' }} />
      <ellipse cx="-7" cy="-17" rx="7"  ry="4" fill={C.weedG}
        style={{ transform: 'rotate(-42deg)', transformOrigin: '-7px -17px' }} />
      <ellipse cx="0" cy="-21" rx="4"  ry="5.5" fill="#5a8a46" />
    </motion.g>
  )
}

// ─── Windfall sparkles ─────────────────────────────────────────────────────────
const SPARKLE_POS = Array.from({ length: 9 }, (_, i) => ({
  x:   80 + (i * 78)   % 640,
  y:   55 + (i * 29)   % 145,
  dl:  i * 0.39,
  sz:  9 + (i % 3) * 4,
}))
function SparklesEl() {
  return (
    <g>
      {SPARKLE_POS.map((p, i) => (
        <motion.text key={i} x={p.x} y={p.y} textAnchor="middle"
          fontSize={p.sz} fill="#fbbf24" fontFamily="system-ui"
          animate={{ y: [p.y, p.y - 65], opacity: [0, 1, 0], scale: [0.5, 1.3, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: p.dl, ease: 'easeOut' }}
        >✦</motion.text>
      ))}
    </g>
  )
}

// ─── Tree label ────────────────────────────────────────────────────────────────
function TreeLabel({ x, name, pct }) {
  const short = name.length > 11 ? name.slice(0, 11) + '…' : name
  const txt   = `${short} · ${pct}%`
  const w     = Math.min(txt.length * 6.4 + 16, 106)
  return (
    <g transform={`translate(${x},${BASE_Y + 22})`}>
      <rect x={-w / 2} y="-11" width={w} height="19" rx="9.5"
        fill="rgba(255,255,255,0.93)" />
      <text x="0" y="3.5" textAnchor="middle" fontSize="10" fontWeight="600"
        fill="#166534" fontFamily="system-ui, -apple-system, sans-serif">
        {txt}
      </text>
    </g>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────
const GardenVisual = memo(function GardenVisual({ goals = [], budgets = [], debts = [] }) {
  const scores = useMemo(() => computeScores(budgets, goals, debts), [budgets, goals, debts])
  const { totalScore, surplusRatio, hasDeficit, deficitSeverity,
          recurringIncome, recurringExpenses } = scores

  const cloudStyle  = useMemo(() => getCloudStyle(surplusRatio),    [surplusRatio])
  const weedCount   = useMemo(() => getWeedCount(scores.debtScore),  [scores.debtScore])
  const windfall    = useMemo(() => hasRecentWindfall(budgets),       [budgets])
  const grassColors = useMemo(() => getGrassColors(totalScore),       [totalScore])

  const visibleGoals = goals.slice(0, 6)
  const treePos = visibleGoals.length > 0 ? getTreePositions(visibleGoals.length) : []

  const totalSaved = goals.reduce((s, g)  => s + Number(g.current_amount), 0)
  const totalDebt  = debts.reduce((s, d)  => s + Number(d.balance),        0)
  const net        = recurringIncome - recurringExpenses
  const isEmpty    = goals.length === 0 && budgets.length === 0 && debts.length === 0

  return (
    <Card className="border border-gray-100 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sprout className="w-5 h-5 text-green-600" />
            Your Financial Garden
          </CardTitle>
          <div className="flex items-center gap-2">
            {windfall && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                ✦ Windfall
              </span>
            )}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              totalScore >= 85 ? 'text-emerald-800 bg-emerald-50' :
              totalScore >= 60 ? 'text-green-700 bg-green-50' :
              totalScore >= 30 ? 'text-amber-700 bg-amber-50' :
              'text-red-700 bg-red-50'
            }`}>
              {totalScore}/100
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* ── SVG SCENE ── */}
        <div className="overflow-hidden" style={{ borderRadius: '0 0 0 0' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
            style={{ display: 'block', maxHeight: 'clamp(180px, 38vw, 300px)' }}>

            <Defs grassColors={grassColors} />
            <SceneBackground />
            <SunEl surplusRatio={surplusRatio} />
            <CloudEl count={cloudStyle.count} dark={cloudStyle.dark} />
            {hasDeficit && <RainEl severity={deficitSeverity} />}
            <BgSilhouettes />
            <Fence />
            <Ground />

            {/* Weeds */}
            <AnimatePresence>
              {WEEDS.slice(0, weedCount).map((w, i) => (
                <WeedEl key={i} {...w} />
              ))}
            </AnimatePresence>

            {/* Goal plants */}
            {visibleGoals.map((goal, i) => {
              const { x, s } = treePos[i]
              const stage = getPlantStage(goal)
              const pct   = Math.round(
                Math.min(Number(goal.current_amount) / (Number(goal.target_amount) || 1), 1) * 100
              )
              const topY = TIER_DATA[Math.min(Math.max(stage, 2), 5)]
                ? TIER_DATA[Math.min(Math.max(stage, 2), 5)].slice(-1)[0].apexY
                : -95
              return (
                <g key={goal.id}>
                  {stage === 0 && <SoilMound   x={x} delay={i * 0.12} />}
                  {stage === 1 && <SeedlingEl  x={x} delay={i * 0.12} s={s} />}
                  {stage >= 2  && <ConiferTree x={x} stage={stage} delay={i * 0.12} s={s} />}
                  {stage === 5 && <ButterflyEl x={x} topY={topY * s} />}
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.12 + 0.5 }}>
                    <TreeLabel x={x} name={goal.name} pct={pct} />
                  </motion.g>
                </g>
              )
            })}

            {/* Windfall sparkles */}
            <AnimatePresence>
              {windfall && <SparklesEl key="sp" />}
            </AnimatePresence>

            {/* Empty state — no data at all */}
            {isEmpty && (
              <g>
                <rect x={W / 2 - 175} y={H / 2 - 23} width="350" height="46"
                  rx="13" fill="rgba(255,255,255,0.92)" />
                <text x={W / 2} y={H / 2 + 6} textAnchor="middle"
                  fontSize="13" fontWeight="600" fill="#374151"
                  fontFamily="system-ui, -apple-system, sans-serif">
                  Add goals, a budget, or debts to grow your garden 🌱
                </text>
              </g>
            )}
            {/* No-goals state — has budget/debt data but no goals */}
            {!isEmpty && visibleGoals.length === 0 && (
              <g>
                <rect x={W / 2 - 185} y={H / 2 - 23} width="370" height="46"
                  rx="13" fill="rgba(255,255,255,0.92)" />
                <text x={W / 2} y={H / 2 + 6} textAnchor="middle"
                  fontSize="13" fontWeight="600" fill="#374151"
                  fontFamily="system-ui, -apple-system, sans-serif">
                  Plant your first goal to grow a tree 🌱
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* ── STATS ── */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1">
              <div className="text-lg font-bold text-blue-700">{goals.length}</div>
              <div className="text-xs text-gray-500 font-medium">Goals</div>
              <Target className="w-4 h-4 mx-auto text-blue-400" />
            </div>
            <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-1">
              <div className="text-lg font-bold text-green-700">${totalSaved.toLocaleString()}</div>
              <div className="text-xs text-gray-500 font-medium">Total Saved</div>
              <Droplets className="w-4 h-4 mx-auto text-green-400" />
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 space-y-1">
              <div className="text-lg font-bold text-rose-700">${totalDebt.toLocaleString()}</div>
              <div className="text-xs text-gray-500 font-medium">Total Debt</div>
              <div className="text-sm">🌿</div>
            </div>
            <div className={`p-3 rounded-xl border space-y-1 ${net >= 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-orange-50 border-orange-100'}`}>
              <div className={`text-lg font-bold ${net >= 0 ? 'text-yellow-700' : 'text-orange-700'}`}>
                {net >= 0 ? '+' : ''}${net.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 font-medium">Monthly Net</div>
              <Sun className={`w-4 h-4 mx-auto ${net >= 0 ? 'text-yellow-400' : 'text-orange-400'}`} />
            </div>
          </div>

          {/* Score bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium text-gray-700">Garden Health</span>
              <span className="text-xs text-gray-400">
                Budget {Math.round(scores.budgetScore)}/33 · Goals {Math.round(scores.goalsScore)}/34 · Debt {Math.round(scores.debtScore)}/33
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <motion.div className="h-2.5 rounded-full"
                style={{ background: 'linear-gradient(to right,#4ade80,#16a34a)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${totalScore}%` }}
                transition={{ duration: 1.8, ease: 'easeInOut' }} />
            </div>
            <p className="text-center text-gray-400 text-xs mt-1.5">
              {totalScore === 0  && 'Start adding data to grow your garden 🌱'}
              {totalScore > 0   && totalScore < 40  && 'Your garden is getting started 🌿'}
              {totalScore >= 40 && totalScore < 70  && 'Looking healthy — stay consistent 🌳'}
              {totalScore >= 70 && totalScore < 90  && 'Thriving garden — great habits 🌸'}
              {totalScore >= 90 && 'Incredible — your garden is flourishing! 🌺'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default GardenVisual
