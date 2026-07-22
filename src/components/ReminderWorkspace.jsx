import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { addCalendarDays, previewOccurrences, reminderTemplates, suggestedAnchor, toDateKey } from '@/lib/reminderModel'

// Short, human labels for the data category behind a suggestion or reminder.
const CATEGORY_LABELS = {
  budget: 'Budgeting', debt: 'Debt', savings: 'Savings', taxes: 'Taxes',
  retirement: 'Retirement', investing: 'Investing', goals: 'Goals',
  accounts: 'Accounts', insurance: 'Insurance',
}

const inputClass = 'w-full rounded-xl border border-white/[0.12] bg-white/[0.055] px-3.5 py-3 text-base text-white placeholder:text-readable-muted focus:outline-none focus:ring-2 focus:ring-emerald-400/55 disabled:opacity-55'

function formatDate(value, options = {}) {
  if (!value) return 'Not scheduled'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: options.year ? 'numeric' : undefined,
  })
}
function effectiveDue(reminder) {
  return reminder?.snoozed_until || reminder?.next_due_on || reminder?.anchor_date
}

function relationLabel(type) {
  return {
    goal: 'Goal', account: 'Account', debt: 'Debt', monthly_plan: 'Monthly Plan',
    money_records: 'Money records', profile: 'Profile',
  }[type] || null
}

function editorFromReminder(reminder) {
  return {
    mode: 'existing',
    original: reminder,
    title: reminder.title || '',
    detail: reminder.detail || '',
    cadence: reminder.cadence || 'weekly',
    anchor_date: reminder.anchor_date || toDateKey(),
    linked_record_type: reminder.linked_record_type || '',
    linked_record_id: reminder.linked_record_id || '',
    dirty: false,
  }
}

function editorFromCandidate(candidate) {
  return {
    mode: 'candidate',
    original: candidate,
    title: candidate.title || '',
    detail: candidate.detail || '',
    cadence: candidate.cadence,
    anchor_date: candidate.anchorDate,
    linked_record_type: candidate.linkedRecordType || '',
    linked_record_id: candidate.linkedRecordId || '',
    dirty: false,
  }
}

function editorForNew(cadence) {
  return {
    mode: 'new', original: null, title: '', detail: '', cadence,
    anchor_date: suggestedAnchor(cadence), linked_record_type: '', linked_record_id: '', dirty: false,
  }
}

function SummaryMetric({ label, value, note }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-readable-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
      {note && <p className="mt-0.5 text-xs leading-tight text-readable-secondary">{note}</p>}
    </div>
  )
}

function SuggestionCard({ candidate, busy, onAdd, onAdjust, onDismiss }) {
  return (
    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.065] p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-200">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Suggested from your data</p>
            {CATEGORY_LABELS[candidate.category] && (
              <span className="rounded-full bg-emerald-300/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">{CATEGORY_LABELS[candidate.category]}</span>
            )}
          </div>
          <h4 className="mt-1 text-sm font-semibold leading-5 text-white">{candidate.title}</h4>
          <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{candidate.detail}</p>
          <p className="mt-2 rounded-lg bg-black/15 px-2.5 py-2 text-xs leading-4 text-emerald-50">{candidate.evidence}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" disabled={busy} onClick={() => onAdd(candidate)}
          className="min-h-11 rounded-xl bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-55">
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add reminder'}
        </button>
        <button type="button" disabled={busy} onClick={() => onAdjust(candidate)} className="btn-ghost min-h-11 px-2 text-xs">Adjust first</button>
        <button type="button" disabled={busy} onClick={() => onDismiss(candidate)} className="btn-ghost min-h-11 px-2 text-xs">Not now</button>
      </div>
    </div>
  )
}

function ReminderCard({
  reminder, due, busy, snoozeOpen, onEdit, onAction, onToggleSnooze, onContext,
}) {
  const [customDate, setCustomDate] = useState(addCalendarDays(new Date(), 1))
  const linked = relationLabel(reminder.linked_record_type)
  const actionLabel = reminder.metadata?.action_label
    || (reminder.linked_record_type === 'goal' ? 'Update goal'
      : reminder.linked_record_type === 'debt' ? 'Update debt'
        : reminder.linked_record_type === 'account' ? 'Open account'
          : reminder.linked_record_type === 'monthly_plan' ? 'Open Monthly Plan'
            : reminder.linked_record_type === 'money_records' ? 'Update balances' : null)
  return (
    <article className={`rounded-xl border p-3.5 ${due ? 'border-emerald-300/25 bg-emerald-300/[0.06]' : 'border-white/[0.09] bg-white/[0.035]'}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${due ? 'bg-emerald-300/12 text-emerald-200' : 'bg-white/[0.06] text-readable-secondary'}`}>
          {reminder.cadence === 'weekly' ? <Clock3 className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold leading-5 text-white">{reminder.title}</h4>
              {reminder.detail && <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{reminder.detail}</p>}
            </div>
            <button type="button" onClick={() => onEdit(reminder)} aria-label={`Edit ${reminder.title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-readable-secondary hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-readable-secondary">
            <span className={due ? 'font-semibold text-emerald-200' : ''}>{due ? 'Due ' : 'Next '}{formatDate(effectiveDue(reminder), { year: true })}</span>
            <span>{reminder.cadence === 'weekly' ? 'Every week' : 'Every 3 months'}</span>
            {linked && <span>{linked}</span>}
            {reminder.status === 'paused' && <span className="font-semibold text-amber-200">Paused</span>}
          </div>
        </div>
      </div>

      {due && reminder.status === 'active' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onAction(reminder, 'done')}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-55">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Done
          </button>
          <button type="button" disabled={busy} onClick={() => onToggleSnooze(reminder.id)} className="btn-ghost min-h-11 flex-1 px-3 text-sm">
            <AlarmClock className="mr-1.5 inline h-4 w-4" /> Snooze
          </button>
          <button type="button" disabled={busy} onClick={() => onAction(reminder, 'skipped')} className="btn-ghost min-h-11 flex-1 px-3 text-sm">
            <SkipForward className="mr-1.5 inline h-4 w-4" /> Skip
          </button>
        </div>
      )}

      {snoozeOpen && (
        <div className="mt-2 rounded-xl border border-white/[0.09] bg-black/15 p-2.5">
          <p className="px-1 text-xs font-semibold text-white">Snooze this occurrence</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAction(reminder, 'snoozed', addCalendarDays(new Date(), 1))} className="btn-ghost min-h-11 text-xs">Until tomorrow</button>
            <button type="button" onClick={() => onAction(reminder, 'snoozed', addCalendarDays(new Date(), 3))} className="btn-ghost min-h-11 text-xs">For three days</button>
          </div>
          <div className="mt-2 flex gap-2">
            <input aria-label="Custom snooze date" type="date" min={addCalendarDays(new Date(), 1)} value={customDate} onChange={event => setCustomDate(event.target.value)} className={`${inputClass} min-w-0 flex-1 py-2`} />
            <button type="button" onClick={() => onAction(reminder, 'snoozed', customDate)} className="min-h-11 rounded-xl bg-white/[0.09] px-3 text-xs font-semibold text-white">Set</button>
          </div>
        </div>
      )}

      {actionLabel && reminder.status === 'active' && (
        <button type="button" onClick={() => onContext(reminder)} className="mt-3 min-h-11 text-left text-xs font-semibold text-emerald-200 hover:text-emerald-100">
          {actionLabel} <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
        </button>
      )}
    </article>
  )
}

function ReminderSection({
  cadence, title, description, items, dueIds, suggestion, busyKey, onEdit, onAction,
  onApprove, onAdjust, onDismiss, onContext,
}) {
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(null)
  const dueItems = items.filter(item => dueIds.has(item.id))
  const upcoming = items.filter(item => !dueIds.has(item.id))
  const visible = showAll ? [...dueItems, ...upcoming] : [...dueItems, ...upcoming.slice(0, 3)]
  const hiddenCount = Math.max(0, items.length - visible.length)
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035]">
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 text-left hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/60">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-200">
          {cadence === 'weekly' ? <Clock3 className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="mt-0.5 block text-xs text-readable-secondary">{description}</span>
        </span>
        {dueItems.length > 0 && <span className="rounded-full bg-emerald-300/12 px-2 py-1 text-[11px] font-semibold text-emerald-200">{dueItems.length} due</span>}
        <ChevronDown className={`h-4 w-4 text-readable-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-2.5 border-t border-white/[0.07] p-3 sm:p-4">
          {visible.map(reminder => (
            <ReminderCard key={reminder.id} reminder={reminder} due={dueIds.has(reminder.id)}
              busy={busyKey === reminder.id} snoozeOpen={snoozeOpen === reminder.id}
              onEdit={onEdit} onAction={async (...args) => { await onAction(...args); setSnoozeOpen(null) }}
              onToggleSnooze={id => setSnoozeOpen(current => current === id ? null : id)} onContext={onContext} />
          ))}
          {!items.length && !suggestion && (
            <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-[13px] text-readable-secondary">
              No {cadence} reminder is needed yet. Add one whenever a recurring check-in would help.
            </p>
          )}
          {hiddenCount > 0 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="min-h-11 w-full rounded-xl text-sm font-semibold text-readable-secondary hover:bg-white/[0.04] hover:text-white">
              Show all · {hiddenCount} more
            </button>
          )}
          {showAll && items.length > 3 && (
            <button type="button" onClick={() => setShowAll(false)} className="min-h-11 w-full rounded-xl text-sm font-semibold text-readable-secondary hover:bg-white/[0.04] hover:text-white">Show less</button>
          )}
          {suggestion && <SuggestionCard candidate={suggestion} busy={busyKey === suggestion.candidateKey} onAdd={onApprove} onAdjust={onAdjust} onDismiss={onDismiss} />}
        </div>
      )}
    </section>
  )
}

function ReminderEditor({ editor, setEditor, saving, error, goals, accounts, debts, onSave, onClose, onStatus }) {
  const titleRef = useRef(null)
  const draft = editor
  const update = (key, value) => setEditor(current => ({ ...current, [key]: value, dirty: true }))
  const relationValue = draft.linked_record_type
    ? `${draft.linked_record_type}:${draft.linked_record_id || ''}` : ''
  const occurrences = previewOccurrences(draft.anchor_date, draft.cadence, 3)
  const existing = draft.mode === 'existing' ? draft.original : null
  const save = event => {
    event.preventDefault()
    onSave(draft)
  }
  return (
    <BottomSheet open title={draft.mode === 'new' ? `New ${draft.cadence} reminder` : draft.mode === 'candidate' ? 'Adjust suggestion' : 'Reminder details'}
      subtitle="A check-in records attention, not a balance change." onClose={onClose} dirty={draft.dirty && !saving} initialFocusRef={titleRef}
      footer={(
        // One close affordance (the header X, dirty-guarded) — Save stands alone
        // at full width, matching the footer language across the app's sheets.
        <button type="submit" form="reminder-editor" disabled={saving || !draft.title.trim() || !draft.anchor_date}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-55">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {draft.mode === 'candidate' ? 'Add reminder' : 'Save reminder'}
        </button>
      )}>
      <form id="reminder-editor" className="space-y-4" onSubmit={save}>
        {draft.mode === 'new' && reminderTemplates(draft.cadence).length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-white">Quick start <span className="font-normal text-readable-muted">(tap to fill, then save)</span></label>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {reminderTemplates(draft.cadence).map(template => (
                <button key={template.key} type="button"
                  onClick={() => setEditor(current => ({ ...current, title: template.title, detail: template.detail, linked_record_type: template.linkedRecordType || '', linked_record_id: '', dirty: true }))}
                  className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white hover:border-emerald-300/40 hover:bg-emerald-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
                  {template.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-white">Title</label>
          <input ref={titleRef} required maxLength={160} value={draft.title} onChange={event => update('title', event.target.value)} placeholder="e.g. Update my house fund" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-white">First reminder date</label>
          <input type="date" required value={draft.anchor_date} onChange={event => update('anchor_date', event.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-white">Cadence</label>
          <div className="grid grid-cols-2 gap-2">
            {['weekly', 'quarterly'].map(cadence => (
              <button key={cadence} type="button" onClick={() => update('cadence', cadence)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${draft.cadence === cadence ? 'border-emerald-300/40 bg-emerald-300/12 text-emerald-100' : 'border-white/[0.1] bg-white/[0.035] text-readable-secondary'}`}>
                {cadence === 'weekly' ? 'Weekly' : 'Quarterly'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-3">
          <p className="text-xs font-semibold text-white">Next three check-ins</p>
          <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{occurrences.map(date => formatDate(date, { year: true })).join(' · ') || 'Choose a valid first date.'}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-white">Link to something <span className="font-normal text-readable-muted">(optional)</span></label>
          <select value={relationValue} onChange={event => {
            const [type = '', id = ''] = event.target.value.split(':')
            setEditor(current => ({ ...current, linked_record_type: type, linked_record_id: id, dirty: true }))
          }} className={inputClass}>
            <option value="">No linked record</option>
            <option value="monthly_plan:">Monthly Plan</option>
            <option value="money_records:">All balances</option>
            {goals.length > 0 && <optgroup label="Goals">{goals.map(goal => <option key={goal.id} value={`goal:${goal.id}`}>{goal.name}</option>)}</optgroup>}
            {accounts.length > 0 && <optgroup label="Accounts">{accounts.map(account => <option key={account.id} value={`account:${account.id}`}>{account.name || account.institution || 'Account'}</option>)}</optgroup>}
            {debts.length > 0 && <optgroup label="Debts">{debts.map(debt => <option key={debt.id} value={`debt:${debt.id}`}>{debt.name || 'Debt'}</option>)}</optgroup>}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-white">Note <span className="font-normal text-readable-muted">(optional)</span></label>
          <textarea rows="3" value={draft.detail} onChange={event => update('detail', event.target.value)} placeholder="What should you check?" className={inputClass} />
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        {existing && (
          <div className="border-t border-white/[0.08] pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-readable-muted">Manage reminder</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => onStatus(existing, existing.status === 'paused' ? 'active' : 'paused')}
                className="btn-ghost min-h-11 text-sm">
                {existing.status === 'paused' ? <RotateCcw className="mr-1.5 inline h-4 w-4" /> : <Pause className="mr-1.5 inline h-4 w-4" />}
                {existing.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button type="button" disabled={saving} onClick={() => onStatus(existing, 'archived')}
                className="min-h-11 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] px-3 text-sm font-semibold text-rose-100 hover:bg-rose-400/15">
                <Trash2 className="mr-1.5 inline h-4 w-4" /> Archive
              </button>
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}

export default function ReminderWorkspace({
  model,
  reminders = [],
  events = [],
  goals = [],
  accounts = [],
  debts = [],
  initialReminderId = null,
  onApproveSuggestion,
  onDismissSuggestion,
  onSaveReminder,
  onReminderAction,
  onReminderStatus,
  onOpenContext,
  onAddGoal,
  goalContent,
  completionOffer = null,
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editor, setEditor] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(true)

  // Open the deep-linked reminder's editor exactly once per id. Without this
  // guard the effect re-fires on every `reminders` refetch (each action returns
  // a fresh array), reopening the editor after the user has closed or saved it.
  const openedReminderRef = useRef(null)
  useEffect(() => {
    if (!initialReminderId || openedReminderRef.current === initialReminderId) return
    const reminder = reminders.find(item => item.id === initialReminderId)
    if (reminder) {
      openedReminderRef.current = initialReminderId
      setEditor(editorFromReminder(reminder))
    }
  }, [initialReminderId, reminders])

  const dueIds = useMemo(() => new Set(model.due.map(item => item.id)), [model.due])
  const sectionItems = cadence => reminders
    .filter(reminder => reminder.cadence === cadence && ['active', 'paused'].includes(reminder.status))
    .sort((left, right) => {
      const dueRank = Number(dueIds.has(right.id)) - Number(dueIds.has(left.id))
      return dueRank || String(effectiveDue(left)).localeCompare(String(effectiveDue(right)))
    })
  const suggestion = cadence => model.suggestions.find(item => item.cadence === cadence) || null
  const nextQuarterly = model.quarterly.find(reminder => reminder.status === 'active')

  async function run(key, action, { closeEditor = false } = {}) {
    setBusyKey(key)
    setError(null)
    try {
      await action()
      if (closeEditor) setEditor(null)
    } catch (caught) {
      setError(caught.message || 'That reminder could not be updated.')
    } finally {
      setBusyKey(null)
    }
  }

  function saveEditor(draft) {
    const payload = {
      id: draft.original?.id,
      title: draft.title.trim(),
      detail: draft.detail.trim(),
      cadence: draft.cadence,
      anchor_date: draft.anchor_date,
      linked_record_type: draft.linked_record_type || null,
      linked_record_id: draft.linked_record_id || null,
      metadata: draft.original?.metadata || {},
    }
    if (draft.mode === 'candidate') {
      const candidate = {
        ...draft.original,
        title: payload.title,
        detail: payload.detail,
        cadence: payload.cadence,
        anchorDate: payload.anchor_date,
        linkedRecordType: payload.linked_record_type,
        linkedRecordId: payload.linked_record_id,
        userEdited: true,
      }
      return run(draft.original.candidateKey, () => onApproveSuggestion(candidate), { closeEditor: true })
    }
    return run(draft.original?.id || 'new', () => onSaveReminder(payload), { closeEditor: true })
  }

  function setStatus(reminder, status) {
    return run(reminder.id, () => onReminderStatus(reminder, status), { closeEditor: true })
  }

  const archivedById = new Map(reminders.map(reminder => [reminder.id, reminder]))
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-emerald-300/16 bg-gradient-to-br from-emerald-300/[0.075] to-white/[0.025] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Goals & routines</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Keep progress current, simply.</h2>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setAddOpen(value => !value)} aria-expanded={addOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
              <Plus className="h-4 w-4" /> Add
            </button>
            {addOpen && (
              <>
                <button type="button" aria-label="Close Add menu" onClick={() => setAddOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                <div className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-white/[0.12] bg-[#101a14] p-2 shadow-2xl shadow-black/40">
                  <button type="button" onClick={() => { setAddOpen(false); setEditor(editorForNew('weekly')) }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white hover:bg-white/[0.06]"><Clock3 className="h-4 w-4 text-emerald-200" /> Weekly reminder</button>
                  <button type="button" onClick={() => { setAddOpen(false); setEditor(editorForNew('quarterly')) }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white hover:bg-white/[0.06]"><CalendarCheck className="h-4 w-4 text-emerald-200" /> Quarterly reminder</button>
                  <button type="button" onClick={() => { setAddOpen(false); onAddGoal() }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white hover:bg-white/[0.06]"><Target className="h-4 w-4 text-emerald-200" /> Money goal</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryMetric label="Weekly due" value={String(model.counts.weeklyDue)} note={model.counts.weeklyDue ? 'Needs attention' : 'All clear'} />
          <SummaryMetric label="Next quarter" value={nextQuarterly ? formatDate(effectiveDue(nextQuarterly)) : 'Not set'} note="Review date" />
          <SummaryMetric label="Money goals" value={String(model.counts.activeGoals)} note="Active" />
        </div>
      </section>

      {completionOffer && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.065] p-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Your linked record is updated.</p>
            <p className="mt-0.5 text-[13px] text-readable-secondary">Mark “{completionOffer.title}” done too?</p>
          </div>
          <button type="button" disabled={busyKey === completionOffer.id} onClick={() => run(completionOffer.id, () => onReminderAction(completionOffer, 'done'))}
            className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-55">Mark reminder done</button>
        </div>
      )}

      {model.review && (
        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.055] p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">Schedule review</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{model.review.reminder.title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{model.review.reason} Keep, edit, or archive the schedule—nothing changes automatically.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => run(model.review.reminder.id, () => onReminderStatus(model.review.reminder, 'active', { review_suppressed_fingerprint: model.review.basisFingerprint }))} className="btn-ghost min-h-11 text-xs">Keep</button>
            <button type="button" onClick={() => setEditor(editorFromReminder(model.review.reminder))} className="btn-ghost min-h-11 text-xs"><Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit</button>
            <button type="button" onClick={() => setStatus(model.review.reminder, 'archived')} className="min-h-11 rounded-xl border border-rose-300/20 bg-rose-400/[0.07] text-xs font-semibold text-rose-100">Archive</button>
          </div>
        </section>
      )}

      <ReminderSection cadence="weekly" title="Weekly reminders" description="Small check-ins for changing numbers"
        items={sectionItems('weekly')} dueIds={dueIds} suggestion={suggestion('weekly')} busyKey={busyKey}
        onEdit={reminder => setEditor(editorFromReminder(reminder))}
        onAction={(reminder, action, until) => run(reminder.id, () => onReminderAction(reminder, action, until))}
        onApprove={candidate => run(candidate.candidateKey, () => onApproveSuggestion(candidate))}
        onAdjust={candidate => setEditor(editorFromCandidate(candidate))}
        onDismiss={candidate => run(candidate.candidateKey, () => onDismissSuggestion(candidate))}
        onContext={onOpenContext} />

      <ReminderSection cadence="quarterly" title="Quarterly reminders" description="Occasional reviews for slower-moving decisions"
        items={sectionItems('quarterly')} dueIds={dueIds} suggestion={suggestion('quarterly')} busyKey={busyKey}
        onEdit={reminder => setEditor(editorFromReminder(reminder))}
        onAction={(reminder, action, until) => run(reminder.id, () => onReminderAction(reminder, action, until))}
        onApprove={candidate => run(candidate.candidateKey, () => onApproveSuggestion(candidate))}
        onAdjust={candidate => setEditor(editorFromCandidate(candidate))}
        onDismiss={candidate => run(candidate.candidateKey, () => onDismissSuggestion(candidate))}
        onContext={onOpenContext} />

      <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035]">
        <button type="button" onClick={() => setGoalsOpen(value => !value)} aria-expanded={goalsOpen}
          className="flex min-h-[64px] w-full items-center gap-3 px-4 text-left hover:bg-white/[0.025]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-200"><Target className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Money Goals</span><span className="mt-0.5 block text-xs text-readable-secondary">Savings, purchases, and investments</span></span>
          <span className="text-xs font-semibold text-readable-secondary">{goals.length}</span>
          <ChevronDown className={`h-4 w-4 text-readable-secondary transition-transform ${goalsOpen ? 'rotate-180' : ''}`} />
        </button>
        {goalsOpen && <div className="border-t border-white/[0.07] p-3 sm:p-4">{goalContent}</div>}
      </section>

      {(events.length > 0 || reminders.some(item => item.status === 'archived')) && (
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025]">
          <button type="button" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}
            className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-readable-secondary hover:text-white">
            <CalendarClock className="h-4 w-4" /> Recent reminder history
            <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          {historyOpen && (
            <div className="space-y-2 border-t border-white/[0.07] px-4 py-3">
              {events.slice(0, 12).map(event => {
                const reminder = archivedById.get(event.reminder_id)
                return <div key={event.id} className="flex items-start gap-3 py-1.5 text-[13px]">
                  <span className="mt-0.5 text-emerald-200">{event.action === 'done' ? <Check className="h-4 w-4" /> : event.action === 'skipped' ? <SkipForward className="h-4 w-4" /> : <AlarmClock className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1"><span className="font-semibold text-white">{reminder?.title || 'Reminder'}</span><span className="block text-readable-secondary">{event.action === 'done' ? 'Completed' : event.action === 'skipped' ? 'Skipped' : `Snoozed until ${formatDate(event.snoozed_until)}`} · {formatDate(event.scheduled_for, { year: true })}</span></span>
                </div>
              })}
            </div>
          )}
        </section>
      )}

      {error && !editor && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
      {editor && <ReminderEditor editor={editor} setEditor={setEditor} saving={Boolean(busyKey)} error={error}
        goals={goals} accounts={accounts} debts={debts} onSave={saveEditor} onClose={() => { setEditor(null); setError(null) }} onStatus={setStatus} />}
    </div>
  )
}
