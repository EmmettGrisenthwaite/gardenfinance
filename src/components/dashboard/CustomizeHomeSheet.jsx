import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import {
  DASHBOARD_MAX_WIDGETS, DASHBOARD_WIDGET_MANIFEST, QUICK_METRICS,
  buildDashboardSuggestion, dismissDashboardSuggestion, normalizeDashboardLayout,
} from '@/lib/dashboardModel'

const METRIC_LABELS = {
  margin: 'Left over monthly',
  unallocated: 'Left to assign',
  emergency: 'Emergency runway',
  'cash-apy': 'Average cash APY',
  'debt-interest': 'Debt interest',
  'debt-apr': 'Average debt APR',
  utilization: 'Card utilization',
  'investment-contributions': 'Investment contributions',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function initialSettings(id, context) {
  if (id === 'account-watchlist') return { accountIds: (context.accounts || []).slice(0, 3).map(item => item.id) }
  if (id === 'goals') return { goalId: null }
  if (id === 'quick-metrics') return { metrics: ['margin'] }
  return {}
}

function createWidget(id, context, size) {
  const manifest = DASHBOARD_WIDGET_MANIFEST[id]
  return { id, size: size || manifest.defaultSize, settings: initialSettings(id, context) }
}

function ConfigFields({ widget, context, onChange }) {
  if (widget.id === 'account-watchlist') {
    const selected = widget.settings?.accountIds || []
    return <fieldset className="mt-3 border-t border-white/[0.07] pt-3">
      <legend className="text-xs font-semibold text-readable-secondary">Accounts to show · up to 3</legend>
      <div className="mt-2 grid gap-1">{(context.accounts || []).map(account => {
        const checked = selected.includes(account.id)
        return <label key={account.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[13px] text-white hover:bg-white/[0.04]">
          <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 3}
            onChange={() => onChange({ accountIds: checked ? selected.filter(id => id !== account.id) : [...selected, account.id] })}
            className="h-4 w-4 accent-emerald-500" />
          <span className="min-w-0 truncate">{account.name}</span>
        </label>
      })}</div>
      {!context.accounts?.length && <p className="mt-2 text-xs text-readable-muted">Add an account first; the card will open the correct setup sheet.</p>}
    </fieldset>
  }
  if (widget.id === 'goals') return <label className="mt-3 block border-t border-white/[0.07] pt-3 text-xs font-semibold text-readable-secondary">
    Goal to feature
    <select value={widget.settings?.goalId || ''} onChange={event => onChange({ goalId: event.target.value || null })}
      className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.12] bg-[#101a14] px-3 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60">
      <option value="">Most relevant</option>
      {(context.goals || []).map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
    </select>
  </label>
  if (widget.id === 'quick-metrics') {
    const limit = widget.size === 'expanded' ? 3 : 1
    const selected = widget.settings?.metrics || ['margin']
    return <fieldset className="mt-3 border-t border-white/[0.07] pt-3">
      <legend className="text-xs font-semibold text-readable-secondary">Metrics to show · up to {limit}</legend>
      <div className="mt-2 grid sm:grid-cols-2">{QUICK_METRICS.map(metric => {
        const checked = selected.includes(metric)
        return <label key={metric} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[13px] text-white hover:bg-white/[0.04]">
          <input type="checkbox" checked={checked} disabled={!checked && selected.length >= limit}
            onChange={() => {
              const metrics = checked ? selected.filter(id => id !== metric) : [...selected, metric]
              onChange({ metrics: metrics.length ? metrics : ['margin'] })
            }} className="h-4 w-4 accent-emerald-500" />
          {METRIC_LABELS[metric]}
        </label>
      })}</div>
    </fieldset>
  }
  return null
}

function WidgetEditorRow({ widget, index, count, context, onMove, onRemove, onSize, onSettings }) {
  const controls = useDragControls()
  const manifest = DASHBOARD_WIDGET_MANIFEST[widget.id]
  return <Reorder.Item value={widget} dragListener={false} dragControls={controls}
    className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-3.5 shadow-lg shadow-black/10">
    <div className="flex items-center gap-2">
      <button type="button" onPointerDown={event => controls.start(event)} aria-label={`Drag ${manifest.title}`}
        className="flex h-11 w-9 shrink-0 touch-none items-center justify-center rounded-xl text-readable-muted hover:bg-white/[0.06] hover:text-white">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-white">{manifest.title}</p><p className="mt-0.5 text-xs text-readable-secondary">{widget.size === 'expanded' ? 'Expanded detail' : 'Compact glance'}</p></div>
      <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Move ${manifest.title} up`} className="flex h-11 w-9 items-center justify-center rounded-xl text-readable-secondary hover:bg-white/[0.06] disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
      <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${manifest.title} down`} className="flex h-11 w-9 items-center justify-center rounded-xl text-readable-secondary hover:bg-white/[0.06] disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
      <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${manifest.title}`} className="flex h-11 w-9 items-center justify-center rounded-xl text-readable-secondary hover:bg-rose-300/10 hover:text-rose-100"><Trash2 className="h-4 w-4" /></button>
    </div>
    {manifest.sizes.length > 1 && <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1" aria-label={`${manifest.title} size`}>
      {manifest.sizes.map(size => <button key={size} type="button" onClick={() => onSize(index, size)} aria-pressed={widget.size === size}
        className={`min-h-10 rounded-lg text-xs font-semibold capitalize ${widget.size === size ? 'bg-emerald-300/12 text-emerald-100' : 'text-readable-secondary hover:text-white'}`}>{size}</button>)}
    </div>}
    <ConfigFields widget={widget} context={context} onChange={settings => onSettings(index, settings)} />
  </Reorder.Item>
}

export default function CustomizeHomeSheet({ open, layout, context, onClose, onSave, onReload }) {
  const [draft, setDraft] = useState(() => clone(layout))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [replacement, setReplacement] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const replacementRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setDraft(clone(layout))
    setError(null)
    setConflict(null)
    setReplacement(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!replacement) return
    replacementRef.current?.scrollIntoView({ block: 'start' })
  }, [replacement])

  const normalizedDraft = useMemo(() => normalizeDashboardLayout(draft, context), [draft, context])
  const dirty = JSON.stringify(normalizedDraft) !== JSON.stringify(normalizeDashboardLayout(layout, context))
  const suggestion = useMemo(() => buildDashboardSuggestion(context, normalizedDraft), [context, normalizedDraft])
  const present = new Set(normalizedDraft.widgets.map(item => item.id))
  const groups = Object.entries(DASHBOARD_WIDGET_MANIFEST).reduce((result, [id, item]) => {
    if (!result[item.group]) result[item.group] = []
    result[item.group].push({ id, ...item })
    return result
  }, {})

  function updateWidgets(widgets) {
    setDraft(current => ({ ...current, widgets }))
  }

  function move(from, to) {
    if (to < 0 || to >= normalizedDraft.widgets.length) return
    const next = [...normalizedDraft.widgets]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    updateWidgets(next)
    setAnnouncement(`${DASHBOARD_WIDGET_MANIFEST[item.id].title} moved to position ${to + 1}.`)
  }

  function add(id, size) {
    const candidate = createWidget(id, context, size)
    if (normalizedDraft.widgets.length >= DASHBOARD_MAX_WIDGETS) {
      setReplacement(candidate)
      return
    }
    updateWidgets([...normalizedDraft.widgets, candidate])
    setAnnouncement(`${DASHBOARD_WIDGET_MANIFEST[id].title} added.`)
  }

  function replaceAt(index) {
    const next = [...normalizedDraft.widgets]
    const removed = next[index]
    next[index] = replacement
    updateWidgets(next)
    setAnnouncement(`${DASHBOARD_WIDGET_MANIFEST[removed.id].title} replaced with ${DASHBOARD_WIDGET_MANIFEST[replacement.id].title}.`)
    setReplacement(null)
  }

  function updateSize(index, size) {
    const next = normalizedDraft.widgets.map((item, itemIndex) => itemIndex === index ? { ...item, size } : item)
    updateWidgets(normalizeDashboardLayout({ ...normalizedDraft, widgets: next }, context).widgets)
  }

  function updateSettings(index, settings) {
    updateWidgets(normalizedDraft.widgets.map((item, itemIndex) => itemIndex === index ? { ...item, settings } : item))
  }

  async function save(options = {}) {
    setSaving(true)
    setError(null)
    try {
      const result = await onSave(normalizedDraft, options)
      if (result?.conflict) {
        setConflict(result.conflict)
        return
      }
      onClose()
    } catch (saveError) {
      setError(saveError.message || 'Dashboard changes could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function loadLatest() {
    setSaving(true)
    try {
      const latest = await onReload?.({ create: false })
      const next = latest?.layout || conflict?.layout
      if (next) setDraft(clone(next))
      setConflict(null)
      setError(null)
    } catch (loadError) {
      setError(loadError.message || 'The newer dashboard could not be loaded.')
    } finally { setSaving(false) }
  }

  return <BottomSheet open={open} title="Customize Home" subtitle="Choose up to five cards. Today always stays first." onClose={onClose} size="lg" dirty={dirty}
    footer={({ requestClose }) => <div className="flex gap-2"><button type="button" onClick={requestClose} disabled={saving} className="btn-ghost min-h-11 flex-1">Cancel</button><button type="button" onClick={() => save()} disabled={saving || !dirty} className="btn-primary min-h-11 flex-1 disabled:opacity-45">{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving</> : 'Save dashboard'}</button></div>}>
    <p aria-live="polite" className="sr-only">{announcement}</p>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3.5 py-3 text-[13px] text-rose-100">{error}</p>}
    {conflict && <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><p className="text-[14px] font-semibold text-white">This dashboard changed on another device.</p><p className="mt-1 text-[13px] text-readable-secondary">Load the newer layout, or explicitly keep this draft.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={loadLatest} disabled={saving} className="btn-ghost min-h-11">Load newer</button><button type="button" onClick={() => save({ force: true })} disabled={saving} className="min-h-11 rounded-xl bg-amber-300/12 px-3 text-sm font-semibold text-amber-100">Keep mine</button></div></div>}

    {replacement && <div ref={replacementRef} className="mb-4 scroll-mt-3 rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.055] p-4"><p className="text-[14px] font-semibold text-white">Replace a card with {DASHBOARD_WIDGET_MANIFEST[replacement.id].title}</p><p className="mt-1 text-[13px] text-readable-secondary">Home supports five cards. Nothing will be removed until you choose.</p><div className="mt-3 grid gap-1">{normalizedDraft.widgets.map((item, index) => <button key={item.id} type="button" onClick={() => replaceAt(index)} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-left text-[13px] font-semibold text-white hover:bg-white/[0.06]"><span>Replace {DASHBOARD_WIDGET_MANIFEST[item.id].title}</span><span className="text-emerald-100">Choose</span></button>)}</div><button type="button" onClick={() => setReplacement(null)} className="mt-2 min-h-11 text-[13px] font-semibold text-readable-secondary">Cancel replacement</button></div>}

    {suggestion && <div className="mb-5 rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.055] p-4"><div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200"/><div><p className="text-[14px] font-semibold text-white">{suggestion.title}</p><p className="mt-1 text-[13px] leading-5 text-readable-secondary">{suggestion.detail}</p></div></div><div className="mt-3 flex gap-3"><button type="button" onClick={() => add(suggestion.widgetId, suggestion.size)} className="min-h-11 text-[13px] font-semibold text-emerald-100">Add card</button><button type="button" onClick={() => setDraft(dismissDashboardSuggestion(normalizedDraft, suggestion, context))} className="min-h-11 text-[13px] font-semibold text-readable-secondary">Not now</button></div></div>}

    <section>
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-[15px] font-semibold text-white">On Home</h3><p className="mt-0.5 text-xs text-readable-secondary">{normalizedDraft.widgets.length} of {DASHBOARD_MAX_WIDGETS} cards</p></div><button type="button" onClick={() => setDraft(context.defaultLayout)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-readable-secondary hover:bg-white/[0.05] hover:text-white"><RotateCcw className="h-4 w-4"/>Reset</button></div>
      {normalizedDraft.widgets.length ? <Reorder.Group axis="y" values={normalizedDraft.widgets} onReorder={updateWidgets} className="mt-3 space-y-2">
        {normalizedDraft.widgets.map((widget, index) => <WidgetEditorRow key={widget.id} widget={widget} index={index} count={normalizedDraft.widgets.length} context={context} onMove={move} onRemove={itemIndex => updateWidgets(normalizedDraft.widgets.filter((_, indexValue) => indexValue !== itemIndex))} onSize={updateSize} onSettings={updateSettings} />)}
      </Reorder.Group> : <div className="mt-3 rounded-2xl border border-dashed border-white/[0.12] p-4 text-[13px] text-readable-secondary">Today will remain on Home. Add any cards you want beneath it.</div>}
    </section>

    <section className="mt-6 border-t border-white/[0.08] pt-5"><h3 className="text-[15px] font-semibold text-white">Add cards</h3><div className="mt-3 space-y-5">{Object.entries(groups).map(([group, items]) => <div key={group}><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-readable-muted">{group}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{items.map(item => <button key={item.id} type="button" disabled={present.has(item.id)} onClick={() => add(item.id)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.025] px-3.5 text-left hover:bg-white/[0.055] disabled:cursor-default disabled:opacity-45"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300/[0.08] text-emerald-100"><Plus className="h-4 w-4"/></span><span className="min-w-0"><span className="block text-[13px] font-semibold text-white">{item.title}</span><span className="mt-0.5 block text-xs text-readable-secondary">{present.has(item.id) ? 'Already on Home' : `${item.defaultSize === 'expanded' ? 'Expanded' : 'Compact'} by default`}</span></span></button>)}</div></div>)}</div></section>
  </BottomSheet>
}
