import { useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Sprout, X } from 'lucide-react'
import { STAGE_NAMES } from '@/context/GardenContext'

// Celebratory toast fired when the garden grows a stage (a plan step checked off
// or a goal reached). `data` = null | { stage, stepText }. Auto-dismisses.
export default function GardenGrowthToast({ data, onDismiss }) {
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    if (!data) return
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [data, onDismiss])

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }}
          transition={reducedMotion ? { duration: 0.16 } : { type: 'spring', stiffness: 340, damping: 26 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,360px)]"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/30 bg-[#0e1a14] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <Sprout className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">Your garden grew to {STAGE_NAMES[data.stage]}.</div>
              {data.stepText && <div className="mt-0.5 truncate text-xs leading-snug text-readable-secondary">You finished “{data.stepText}”.</div>}
            </div>
            <button onClick={onDismiss} aria-label="Dismiss garden celebration"
              className="-mr-2 -mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-readable-muted hover:bg-white/[0.07] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
