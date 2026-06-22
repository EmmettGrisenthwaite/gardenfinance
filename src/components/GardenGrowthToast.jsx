import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, X } from 'lucide-react'
import { STAGE_NAMES } from '@/context/GardenContext'

// Celebratory toast fired when the garden grows a stage (a plan step checked off
// or a goal reached). `data` = null | { stage, stepText }. Auto-dismisses.
export default function GardenGrowthToast({ data, onDismiss }) {
  useEffect(() => {
    if (!data) return
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [data, onDismiss])

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 28, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,360px)]"
        >
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 border border-emerald-400/40 shadow-2xl shadow-emerald-900/50 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">Your garden grew — {STAGE_NAMES[data.stage]}! 🌱</div>
              {data.stepText && <div className="text-xs text-white/85 mt-0.5 leading-snug truncate">You finished “{data.stepText}”.</div>}
            </div>
            <button onClick={onDismiss} aria-label="Dismiss" className="p-0.5 text-white/60 hover:text-white flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
