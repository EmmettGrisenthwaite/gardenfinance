import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

// Animated count-up for hero figures (net worth, balances). `format` maps the
// animating number to its display string (so the caller controls $, sign, etc.).
// Respects prefers-reduced-motion and only animates when the value changes.
export default function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), duration = 0.9, className }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || prev.current === value || !Number.isFinite(value)) {
      setDisplay(value); prev.current = value; return
    }
    const controls = animate(prev.current, value, {
      duration, ease: [0.16, 1, 0.3, 1], // easeOutExpo — quick then settles
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
