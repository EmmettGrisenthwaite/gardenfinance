import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { milestonesToStage, STAGE_NAMES, STAGE_THRESHOLDS } from '@/context/GardenContext'
import { STAGE_COLORS } from '@/lib/gardenModel'

export default function GardenMeter({ total, done, embedded = false }) {
  const navigate = useNavigate()
  const earned = Math.max(0, Number(total ?? done) || 0)
  const stage = milestonesToStage(earned)
  const current = STAGE_THRESHOLDS[stage]
  const next = STAGE_THRESHOLDS[stage + 1]
  const percent = next == null ? 100 : Math.round(((earned - current) / (next - current)) * 100)
  const [pulse, setPulse] = useState(false)
  const previous = useRef(earned)

  useEffect(() => {
    if (earned > previous.current) {
      setPulse(true)
      const timer = setTimeout(() => setPulse(false), 700)
      return () => clearTimeout(timer)
    }
    previous.current = earned
  }, [earned])
  useEffect(() => { previous.current = earned }, [earned])

  return (
    <button onClick={() => navigate('/?garden=story')} aria-label={`Open the story for your ${STAGE_NAMES[stage]} garden`}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${embedded ? 'px-0 py-1' : 'border px-3 py-2'} ${
        pulse
          ? embedded ? 'bg-emerald-500/[0.08]' : 'border-emerald-400/40 bg-emerald-500/[0.14]'
          : embedded ? 'hover:bg-white/[0.025]' : 'border-white/[0.09] bg-white/[0.05] hover:bg-white/[0.08]'
      }`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/15" style={{ background: STAGE_COLORS[stage] }} />
      <span className="whitespace-nowrap text-xs font-bold text-white">{STAGE_NAMES[stage]}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full transition-all duration-500 ${pulse ? 'bg-emerald-300' : 'bg-emerald-400/80'}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-emerald-100/90">
        {next == null ? 'sanctuary complete' : `${next - earned} more → ${STAGE_NAMES[stage + 1]}`}
      </span>
    </button>
  )
}
