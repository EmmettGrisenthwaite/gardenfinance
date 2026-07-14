import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { milestonesToStage, STAGE_NAMES, STAGE_THRESHOLDS } from '@/context/GardenContext'

// Same color ramp as the Garden page's HUD — the two must read as one system.
const STAGE_COLORS = ['#8a6a44', '#a3b35a', '#6cc24a', '#3fa53b', '#2f9e44', '#34d399']

// One thin line of garden progress on the Plan page — the reward meter, living
// where the checking happens. Fills toward the next stage and pulses on every
// completed step (not just stage crossings). Tap → go admire the garden.
export default function GardenMeter({ done, embedded = false }) {
  const navigate = useNavigate()
  const stage = milestonesToStage(done)
  const cur   = STAGE_THRESHOLDS[stage]
  const next  = STAGE_THRESHOLDS[stage + 1]
  const pct   = next == null ? 100 : Math.round(((done - cur) / (next - cur)) * 100)

  const [pulse, setPulse] = useState(false)
  const prevDone = useRef(done)
  useEffect(() => {
    if (done > prevDone.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 700)
      return () => clearTimeout(t)
    }
    prevDone.current = done
  }, [done])
  useEffect(() => { prevDone.current = done }, [done])

  return (
    <button onClick={() => navigate('/')} aria-label="See your garden"
      className={`w-full flex min-h-11 items-center gap-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${embedded ? 'px-0 py-1' : 'border px-3 py-2'} ${
        pulse ? embedded ? 'bg-emerald-500/[0.08]' : 'bg-emerald-500/[0.14] border-emerald-400/40' : embedded ? 'hover:bg-white/[0.025]' : 'bg-white/[0.05] border-white/[0.09] hover:bg-white/[0.08]'}`}>
      <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/15 flex-shrink-0"
        style={{ background: STAGE_COLORS[stage] }} />
      <span className="text-xs font-bold text-white whitespace-nowrap">{STAGE_NAMES[stage]}</span>
      <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <span className={`block h-full rounded-full transition-all duration-500 ${
          pulse ? 'bg-emerald-300' : 'bg-emerald-400/80'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[10px] font-semibold text-emerald-200/85 whitespace-nowrap tabular-nums">
        {next == null ? 'fully grown' : `${next - done} more → ${STAGE_NAMES[stage + 1]}`}
      </span>
    </button>
  )
}
