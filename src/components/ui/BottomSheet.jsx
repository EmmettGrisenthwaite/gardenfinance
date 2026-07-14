import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  dirty = false,
  initialFocusRef,
  size = 'md',
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const returnFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const dirtyRef = useRef(dirty)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      setConfirmDiscard(true)
      return
    }
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (!open) {
      setConfirmDiscard(false)
      return undefined
    }
    returnFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = setTimeout(() => {
      const target = initialFocusRef?.current || panelRef.current?.querySelector(FOCUSABLE)
      target?.focus()
    }, 40)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      returnFocusRef.current?.focus?.()
    }
  }, [open, initialFocusRef, requestClose])

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl' }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 sm:items-center sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
        >
          <motion.section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-white/[0.11] bg-[#0a1410] shadow-[0_-18px_60px_rgba(0,0,0,0.45)] sm:max-h-[88vh] sm:rounded-[26px] ${widths[size] || widths.md}`}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/15 sm:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl font-semibold tracking-[-0.01em] text-white">{title}</h2>
                {subtitle && <p className="mt-1 text-xs leading-relaxed text-readable-secondary">{subtitle}</p>}
              </div>
              <button type="button" onClick={requestClose} aria-label={`Close ${title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-readable-secondary transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {confirmDiscard ? (
              <div className="border-t border-amber-300/15 bg-amber-300/[0.04] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <p className="text-sm font-semibold text-white">Discard unsaved changes?</p>
                <p className="mt-0.5 text-[13px] text-readable-secondary">Your saved financial data will stay unchanged.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConfirmDiscard(false)} className="btn-ghost min-h-11 flex-1">Keep editing</button>
                  <button type="button" onClick={() => onCloseRef.current()} className="min-h-11 flex-1 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-400/20">Discard</button>
                </div>
              </div>
            ) : footer ? (
              <div className="border-t border-white/[0.07] bg-[#0a1410]/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                {typeof footer === 'function' ? footer({ requestClose }) : footer}
              </div>
            ) : null}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
