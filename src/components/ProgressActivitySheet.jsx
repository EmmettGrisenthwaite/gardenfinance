import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Clock3, ExternalLink, History, Loader2, Pencil, Sparkles } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { applyFinancialActivity, markFinancialActivity } from '@/lib/financialActivities'
import { buildFinancialPreview } from '@/lib/progressOutcome'

const money = value => `$${Math.round(Number(value) || 0).toLocaleString()}`
const inputClass = 'w-full rounded-xl border border-white/[0.12] bg-white/[0.055] px-3 py-3 text-[15px] text-white outline-none focus:border-emerald-300/55 focus:ring-1 focus:ring-emerald-300/25'

function statusCopy(activity) {
  if (activity.status === 'applied') return 'Money records updated'
  if (activity.status === 'recorded') return 'Action remembered'
  if (activity.status === 'dismissed') return 'Dismissed'
  return activity.prompt_seen_at ? 'Available to review' : 'Ready to review'
}

function ActivityList({ activities, onSelect }) {
  if (!activities.length) return <div className="rounded-2xl border border-dashed border-white/[0.12] px-5 py-8 text-center"><History className="mx-auto h-6 w-6 text-emerald-200"/><p className="mt-3 text-sm font-semibold text-white">No progress recorded yet</p><p className="mt-1 text-[13px] text-readable-secondary">Completed Plan work will appear here.</p></div>
  return <div className="divide-y divide-white/[0.07]">
    {activities.map(activity => <button key={activity.id} type="button" onClick={() => onSelect(activity)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activity.status === 'applied' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/[0.055] text-readable-secondary'}`}>
        {activity.status === 'applied' ? <Check className="h-4 w-4"/> : <Clock3 className="h-4 w-4"/>}
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-white">{activity.label}</span><span className="mt-0.5 block text-xs text-readable-secondary">{statusCopy(activity)}{Number(activity.amount) > 0 ? ` · ${money(activity.amount)}` : ''}</span></span>
      <ArrowRight className="h-4 w-4 shrink-0 text-readable-muted"/>
    </button>)}
  </div>
}

export default function ProgressActivitySheet({
  open,
  initialActivity = null,
  activities = [],
  accounts = [],
  debts = [],
  goals = [],
  onClose,
  onApplied,
  onRefresh,
  onOpenAccount,
  onCorrect,
  onActivityChanged,
}) {
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [debtId, setDebtId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [firstMove, setFirstMove] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    const next = initialActivity || null
    setSelected(next)
    setAmount(next?.amount ? String(next.amount) : '')
    setSourceAccountId(next?.source_account_id || '')
    setDestinationAccountId(next?.destination_account_id || '')
    setDebtId(next?.debt_id || '')
    setGoalId(next?.goal_id || '')
    setFirstMove(false)
    setEditing(!next?.amount)
    setError(null)
  }, [open, initialActivity])

  const effectiveActivity = useMemo(() => selected?.kind === 'recurring_setup' && firstMove
    ? { ...selected, kind: 'transfer' }
    : selected, [firstMove, selected])
  const preview = useMemo(() => effectiveActivity ? buildFinancialPreview({
    activity: effectiveActivity,
    amount,
    sourceAccountId: sourceAccountId || null,
    destinationAccountId: destinationAccountId || null,
    debtId: debtId || null,
    goalId: goalId || null,
  }, { accounts, debts, goals }) : { error: null, updates: [] }, [accounts, amount, debtId, debts, destinationAccountId, effectiveActivity, goalId, goals, sourceAccountId])

  async function mark(disposition = 'seen') {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const changed = await markFinancialActivity(selected.id, disposition)
      onActivityChanged?.(changed)
      onClose?.()
    } catch (caught) {
      setError(caught.message ?? 'Could not update this progress record.')
    } finally {
      setSaving(false)
    }
  }

  async function close() {
    if (initialActivity && !initialActivity.prompt_seen_at) await mark('seen')
    else onClose?.()
  }

  async function apply() {
    if (!selected || preview.error) {
      setEditing(true)
      setError(preview.error || 'Review the update details first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await applyFinancialActivity(selected.id, {
        amount: preview.amount,
        source_account_id: sourceAccountId || null,
        destination_account_id: destinationAccountId || null,
        debt_id: debtId || null,
        goal_id: goalId || null,
        updates: preview.updates.map(({ entity, id, before, after }) => ({ entity, id, before, after })),
        before_state: preview.beforeState,
        after_state: preview.afterState,
      })
      onApplied?.(result)
      onClose?.()
    } catch (caught) {
      if (caught.code === 'STALE_FINANCIAL_STATE') await onRefresh?.()
      setError(caught.message ?? 'Could not update your money records.')
    } finally {
      setSaving(false)
    }
  }

  async function openAccount() {
    await markFinancialActivity(selected.id, 'recorded')
    onOpenAccount?.(selected)
    onClose?.()
  }

  const showHistory = !selected
  const canAct = selected?.status === 'pending' && selected.kind !== 'information'
  const canPreviewMove = canAct && !['information', 'account_opening'].includes(selected.kind) && (selected.kind !== 'recurring_setup' || firstMove)
  const title = showHistory ? 'Recent progress' : selected.kind === 'account_opening' ? 'Add the account you opened' : selected.kind === 'recurring_setup' ? 'Remember this automatic move' : 'Reflect this in Money?'

  return <BottomSheet open={open} title={title} subtitle={showHistory ? 'What you completed and what changed afterward.' : canAct ? 'Nothing changes until you approve it.' : statusCopy(selected)} onClose={close} size="md" footer={canAct ? <div className="flex gap-2">
    <button type="button" disabled={saving} onClick={() => mark('seen')} className="btn-ghost min-h-11 flex-1">Not now</button>
    {selected?.kind === 'account_opening' ? <button type="button" disabled={saving} onClick={openAccount} className="btn-primary min-h-11 flex-1">Add account <ExternalLink className="h-4 w-4"/></button>
      : selected?.kind === 'recurring_setup' && !firstMove ? <button type="button" disabled={saving} onClick={() => mark('recorded')} className="btn-primary min-h-11 flex-1">Remember setup</button>
        : <button type="button" disabled={saving || Boolean(preview.error)} onClick={apply} className="btn-primary min-h-11 flex-1">{saving ? <><Loader2 className="h-4 w-4 animate-spin"/> Updating</> : 'Update records'}</button>}
  </div> : null}>
    {showHistory ? <ActivityList activities={activities} onSelect={activity => { setSelected(activity); setAmount(activity.amount ? String(activity.amount) : ''); setSourceAccountId(activity.source_account_id || ''); setDestinationAccountId(activity.destination_account_id || ''); setDebtId(activity.debt_id || ''); setGoalId(activity.goal_id || ''); setEditing(activity.status === 'pending'); setError(null) }}/>
      : <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.055] p-4"><div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200"/><div><p className="text-[15px] font-semibold text-white">{selected.label}</p><p className="mt-1 text-[13px] leading-5 text-readable-secondary">{selected.kind === 'recurring_setup' ? `We'll remember the ${selected.recurrence || 'recurring'} setup without pretending money already moved.` : selected.kind === 'account_opening' ? 'Add its real details so Home and Advisor use the account as evidence.' : 'Review the amount and affected records below.'}</p></div></div></div>

        {selected.kind === 'recurring_setup' && <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.035] px-3.5"><input type="checkbox" checked={firstMove} onChange={event => { setFirstMove(event.target.checked); setEditing(event.target.checked) }} className="h-4 w-4 accent-emerald-500"/><span className="text-[13px] font-semibold text-white">The first transfer happened too</span></label>}

        {canPreviewMove && <>
          {(editing || preview.error) ? <div className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-white">Amount moved</span><input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className={inputClass}/></label>
            {selected.kind !== 'contribution' || accounts.length > 0 ? <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-white">From <span className="font-normal text-readable-muted">(optional if outside the app)</span></span><select value={sourceAccountId} onChange={event => setSourceAccountId(event.target.value)} className={inputClass}><option value="" className="bg-[#0a1410]">Outside tracked accounts</option>{accounts.map(account => <option key={account.id} value={account.id} className="bg-[#0a1410]">{account.name} · {money(account.balance)}</option>)}</select></label> : null}
            {selected.kind === 'debt_payment' ? <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-white">Debt paid</span><select value={debtId} onChange={event => setDebtId(event.target.value)} className={inputClass}><option value="" className="bg-[#0a1410]">Choose debt</option>{debts.filter(debt => Number(debt.balance) > 0).map(debt => <option key={debt.id} value={debt.id} className="bg-[#0a1410]">{debt.name} · {money(debt.balance)}</option>)}</select></label>
              : <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-white">To</span><select value={destinationAccountId} onChange={event => setDestinationAccountId(event.target.value)} className={inputClass}><option value="" className="bg-[#0a1410]">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id} className="bg-[#0a1410]">{account.name} · {money(account.balance)}</option>)}</select></label>}
            {goals.length > 0 && <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-white">Goal progress <span className="font-normal text-readable-muted">(optional)</span></span><select value={goalId} onChange={event => setGoalId(event.target.value)} className={inputClass}><option value="" className="bg-[#0a1410]">No goal update</option>{goals.map(goal => <option key={goal.id} value={goal.id} className="bg-[#0a1410]">{goal.name} · {money(goal.current_amount)} of {money(goal.target_amount)}</option>)}</select></label>}
          </div> : <button type="button" onClick={() => setEditing(true)} className="btn-ghost min-h-11 w-full"><Pencil className="h-4 w-4"/> Edit details</button>}

          {!preview.error && preview.updates.length > 0 && <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.09] px-4">{preview.updates.map(update => <div key={`${update.entity}:${update.id}`} className="flex items-center justify-between gap-4 py-3 text-[13px]"><span className="min-w-0 truncate text-readable-secondary">{update.name}</span><span className="shrink-0 font-semibold tabular-nums text-white">{money(update.before)} <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-readable-muted"/> {money(update.after)}</span></div>)}</div>}
        </>}

        {selected.status === 'applied' && <button type="button" onClick={() => { onClose?.(); onCorrect?.(selected) }} className="btn-ghost min-h-11 w-full">Correct current balances</button>}
        {initialActivity == null && !selected.exclude_from_advisor && <button type="button" onClick={() => mark('exclude')} className="min-h-11 w-full text-[13px] font-semibold text-readable-secondary">Don&apos;t use this in Advisor</button>}
        {initialActivity == null && selected.status === 'pending' && selected.prompt_seen_at && <button type="button" onClick={() => mark('dismissed')} className="min-h-11 w-full text-[13px] font-semibold text-rose-100/80">Dismiss this unresolved update</button>}
        {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3.5 py-3 text-[13px] leading-5 text-rose-100">{error}</p>}
        {!showHistory && initialActivity == null && <button type="button" onClick={() => setSelected(null)} className="min-h-11 text-[13px] font-semibold text-readable-secondary">Back to recent progress</button>}
      </div>}
  </BottomSheet>
}
