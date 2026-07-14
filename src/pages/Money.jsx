import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Banknote, Boxes, BriefcaseBusiness, Car, Check,
  ChevronRight, CircleDollarSign, CreditCard, Home, Landmark, LineChart,
  Loader2, Plus, Trash2, Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { computeSnapshot } from '@/lib/finance'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'

const fmt = (value) => {
  const number = Number(value) || 0
  return `${number < 0 ? '-' : ''}$${Math.abs(Math.round(number)).toLocaleString()}`
}
const money = (value) => Math.max(0, Number(value) || 0)

const ASSET_TYPES = [
  { value: 'brokerage', label: 'Investment', icon: LineChart },
  { value: 'property', label: 'Property', icon: Home },
  { value: 'vehicle', label: 'Vehicle', icon: Car },
  { value: 'other_asset', label: 'Other asset', icon: Boxes },
]
const typeMeta = (type) => ASSET_TYPES.find(item => item.value === type) || ASSET_TYPES[3]

function Metric({ label, value, note, tone = 'text-white' }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      {note && <p className="mt-0.5 truncate text-[10px] text-white/30">{note}</p>}
    </div>
  )
}

function SummaryCard({ icon: Icon, title, total, meta, detail, tone = 'emerald', onClick }) {
  const colors = {
    emerald: 'text-emerald-200 bg-emerald-400/[0.08] border-emerald-300/10',
    sky: 'text-sky-200 bg-sky-400/[0.07] border-sky-300/10',
    violet: 'text-violet-200 bg-violet-400/[0.07] border-violet-300/10',
    rose: 'text-rose-200 bg-rose-400/[0.07] border-rose-300/10',
  }
  return (
    <button type="button" onClick={onClick}
      className="group flex min-h-[108px] w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${colors[tone] || colors.emerald}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="text-base font-semibold tabular-nums text-white">{total}</span>
        </span>
        <span className="mt-1 block text-xs text-white/42">{meta}</span>
        {detail && <span className="mt-0.5 block truncate text-[11px] text-white/28">{detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50" />
    </button>
  )
}

function Field({ label, hint, prefix, suffix, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold text-white/65">
        {label}{hint && <span className="font-normal text-white/30">{hint}</span>}
      </span>
      <span className="flex min-h-12 items-center rounded-xl border border-white/[0.1] bg-white/[0.055] px-3 focus-within:border-emerald-300/45 focus-within:ring-1 focus-within:ring-emerald-300/20">
        {prefix && <span className="mr-1 text-white/35">{prefix}</span>}
        {children}
        {suffix && <span className="ml-1 text-white/35">{suffix}</span>}
      </span>
    </label>
  )
}

function ItemRow({ icon: Icon, name, sub, value, deleting, disabled, onEdit, onArmDelete, onCancelDelete, onDelete }) {
  return (
    <div className="border-b border-white/[0.06] py-2.5 last:border-0">
      {deleting ? (
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-rose-300/15 bg-rose-400/[0.06] px-3">
          <p className="min-w-0 flex-1 text-xs font-semibold text-rose-100">Delete {name}?</p>
          <button type="button" onClick={onCancelDelete} className="min-h-9 px-2 text-xs font-semibold text-white/55">Cancel</button>
          <button type="button" disabled={disabled} onClick={onDelete} className="min-h-9 rounded-lg bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 disabled:opacity-50">Delete</button>
        </div>
      ) : (
        <div className="flex min-h-12 items-center gap-3">
          <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-white/45"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white/90">{name}</span>
              <span className="block truncate text-[11px] text-white/35">{sub}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-white">{value}</span>
          </button>
          <button type="button" onClick={onArmDelete} aria-label={`Delete ${name}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/25 transition-colors hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function Money() {
  const { user, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts] = useState([])
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeSheet, setActiveSheet] = useState(null)
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmEditorDiscard, setConfirmEditorDiscard] = useState(false)

  async function loadAccounts() {
    const { data, error: accountsError } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at')
    if (accountsError) throw accountsError
    setAccounts(data ?? [])
    return data ?? []
  }

  useEffect(() => {
    async function load() {
      const [ac, d] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('debts').select('*').eq('user_id', user.id).order('created_at'),
      ])
      if (ac.error) throw ac.error
      if (d.error) throw d.error
      setAccounts(ac.data ?? [])
      setDebts(d.data ?? [])
      setIncome(Number(profile?.monthly_income) || 0)
      setExpenses(Number(profile?.monthly_expenses) || 0)
      setLoading(false)
    }
    load().catch(err => {
      setError(err.message ?? 'Could not load your money data.')
      setLoading(false)
    })
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const byType = (type) => accounts.filter(account => account.type === type)
  const sumType = (type) => byType(type).reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const checking = sumType('checking')
  const savings = sumType('savings')
  const itemizedAssets = accounts.filter(account => ASSET_TYPES.some(type => type.value === account.type))
  const totalAssets = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const itemizedTotal = itemizedAssets.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0)
  const netWorth = totalAssets - totalDebt
  const surplus = income - expenses
  const highestApr = [...debts].filter(debt => Number(debt.balance) > 0).sort((a, b) => Number(b.interest_rate || 0) - Number(a.interest_rate || 0))[0]
  const snap = computeSnapshot({ profile: { ...profile, monthly_income: income, monthly_expenses: expenses }, accounts, debts })

  useEffect(() => {
    if (loading || Number(profile?.net_worth) === netWorth) return
    setProfile(current => current ? { ...current, net_worth: netWorth } : current)
    supabase.from('profiles').update({ net_worth: netWorth }).eq('id', user.id)
      .then(({ error: profileError }) => {
        if (profileError) setError(profileError.message ?? 'Could not sync net worth.')
      })
  }, [netWorth, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(field, value) {
    setDraft(current => ({ ...current, [field]: value }))
    setDirty(true)
    setSheetError(null)
    setConfirmEditorDiscard(false)
  }

  function openSheet(kind) {
    setActiveSheet(kind)
    setEditor(null)
    setDirty(false)
    setSheetError(null)
    setDeleteTarget(null)
    setConfirmEditorDiscard(false)
    if (kind === 'cashflow') setDraft({ income: String(income), expenses: String(expenses) })
    else if (kind === 'cash') setDraft({ checking: String(checking), savings: String(savings) })
    else setDraft({})
  }

  function closeSheet() {
    setActiveSheet(null)
    setEditor(null)
    setDirty(false)
    setSheetError(null)
    setDeleteTarget(null)
  }

  function beginAsset(item = null) {
    setEditor({ kind: 'asset', id: item?.id ?? null })
    setDraft({
      type: item?.type ?? 'brokerage',
      name: item?.name ?? '',
      balance: item ? String(item.balance ?? 0) : '',
      interest_rate: item?.interest_rate == null ? '' : String(item.interest_rate),
    })
    setDirty(false)
    setSheetError(null)
    setDeleteTarget(null)
  }

  function beginDebt(item = null) {
    setEditor({ kind: 'debt', id: item?.id ?? null })
    setDraft({
      name: item?.name ?? '',
      balance: item ? String(item.balance ?? 0) : '',
      interest_rate: item?.interest_rate == null ? '' : String(item.interest_rate),
    })
    setDirty(false)
    setSheetError(null)
    setDeleteTarget(null)
  }

  function returnToList() {
    setEditor(null)
    setDraft({})
    setDirty(false)
    setSheetError(null)
    setDeleteTarget(null)
    setConfirmEditorDiscard(false)
  }

  async function saveCashFlow() {
    setSaving(true)
    setSheetError(null)
    const nextIncome = money(draft.income)
    const nextExpenses = money(draft.expenses)
    const { data, error: saveError } = await supabase.from('profiles')
      .update({ monthly_income: nextIncome, monthly_expenses: nextExpenses }).eq('id', user.id).select().single()
    setSaving(false)
    if (saveError) {
      setSheetError(saveError.message ?? 'Could not save your cash flow.')
      return
    }
    setIncome(nextIncome)
    setExpenses(nextExpenses)
    if (data) setProfile(data)
    closeSheet()
  }

  async function persistCanonical(type, name, value) {
    const existing = accounts.find(account => account.type === type)
    if (existing) {
      const { data, error: updateError } = await supabase.from('accounts')
        .update({ balance: value }).eq('id', existing.id).eq('user_id', user.id).select().single()
      if (updateError) throw updateError
      return data
    }
    const { data, error: insertError } = await supabase.from('accounts')
      .insert({ user_id: user.id, name, type, balance: value }).select().single()
    if (insertError) throw insertError
    return data
  }

  async function saveCash() {
    setSaving(true)
    setSheetError(null)
    try {
      await Promise.all([
        persistCanonical('checking', 'Checking', money(draft.checking)),
        persistCanonical('savings', 'Savings', money(draft.savings)),
      ])
      await loadAccounts()
      closeSheet()
    } catch (err) {
      await loadAccounts().catch(() => {})
      setSheetError(err.message ?? 'Could not save both balances. Your current saved totals have been refreshed.')
    } finally {
      setSaving(false)
    }
  }

  async function saveEditor() {
    if (!draft.name?.trim()) {
      setSheetError('Add a name before saving.')
      return
    }
    setSaving(true)
    setSheetError(null)
    const base = {
      name: draft.name.trim(),
      balance: money(draft.balance),
      interest_rate: draft.interest_rate === '' ? null : Math.max(0, Number(draft.interest_rate) || 0),
    }
    try {
      if (editor.kind === 'asset') {
        const payload = { ...base, type: draft.type, interest_rate: draft.type === 'brokerage' ? base.interest_rate : null }
        if (editor.id) {
          const { data, error: updateError } = await supabase.from('accounts').update(payload)
            .eq('id', editor.id).eq('user_id', user.id).select().single()
          if (updateError) throw updateError
          setAccounts(current => current.map(item => item.id === editor.id ? data : item))
        } else {
          const { data, error: insertError } = await supabase.from('accounts')
            .insert({ ...payload, user_id: user.id }).select().single()
          if (insertError) throw insertError
          setAccounts(current => [...current, data])
        }
      } else if (editor.id) {
        const { data, error: updateError } = await supabase.from('debts').update(base)
          .eq('id', editor.id).eq('user_id', user.id).select().single()
        if (updateError) throw updateError
        setDebts(current => current.map(item => item.id === editor.id ? data : item))
      } else {
        const { data, error: insertError } = await supabase.from('debts')
          .insert({ ...base, user_id: user.id }).select().single()
        if (insertError) throw insertError
        setDebts(current => [...current, data])
      }
      returnToList()
    } catch (err) {
      setSheetError(err.message ?? `Could not save that ${editor.kind}.`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(kind, id) {
    setSaving(true)
    setSheetError(null)
    const table = kind === 'asset' ? 'accounts' : 'debts'
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
    setSaving(false)
    if (deleteError) {
      setSheetError(deleteError.message ?? `Could not delete that ${kind}.`)
      return
    }
    if (kind === 'asset') setAccounts(current => current.filter(item => item.id !== id))
    else setDebts(current => current.filter(item => item.id !== id))
    setDeleteTarget(null)
    if (editor?.id === id) returnToList()
  }

  const sheetTitles = {
    cashflow: ['Monthly cash flow', 'Update the two numbers that shape every recommendation.'],
    cash: ['Cash and savings', 'Keep liquid balances current so runway and net worth stay accurate.'],
    assets: ['Investments and assets', 'Retirement accounts, property, vehicles, and other things you own.'],
    debts: ['Debts and liabilities', 'Balances and rates help the advisor prioritize the costliest debt.'],
  }
  const currentTitle = editor
    ? `${editor.id ? 'Edit' : 'Add'} ${editor.kind}`
    : sheetTitles[activeSheet]?.[0]
  const currentSubtitle = editor
    ? 'Save once when the details look right.'
    : sheetTitles[activeSheet]?.[1]

  function renderEditor() {
    const isAsset = editor.kind === 'asset'
    return (
      <div className="space-y-4">
        {isAsset && (
          <div>
            <p className="mb-2 text-xs font-semibold text-white/65">Asset type</p>
            <div className="grid grid-cols-2 gap-2">
              {ASSET_TYPES.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => updateDraft('type', value)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-colors ${
                    draft.type === value ? 'border-emerald-300/35 bg-emerald-400/[0.09] text-emerald-100' : 'border-white/[0.08] bg-white/[0.035] text-white/45 hover:text-white/75'}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label={isAsset ? 'Account or asset name' : 'Debt name'}>
          <input value={draft.name ?? ''} onChange={event => updateDraft('name', event.target.value)}
            placeholder={isAsset ? 'e.g. Roth IRA' : 'e.g. Visa card'}
            className="w-full bg-transparent text-base text-white placeholder:text-white/25 focus:outline-none" />
        </Field>
        <Field label="Current balance" prefix="$">
          <input type="number" inputMode="decimal" min="0" value={draft.balance ?? ''}
            onChange={event => updateDraft('balance', event.target.value)} placeholder="0"
            className="w-full bg-transparent text-base font-semibold tabular-nums text-white placeholder:text-white/25 focus:outline-none" />
        </Field>
        {(!isAsset || draft.type === 'brokerage') && (
          <Field label={isAsset ? 'Annual yield' : 'Interest rate'} hint="optional" suffix="%">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={draft.interest_rate ?? ''}
              onChange={event => updateDraft('interest_rate', event.target.value)} placeholder="0"
              className="w-full bg-transparent text-base font-semibold tabular-nums text-white placeholder:text-white/25 focus:outline-none" />
          </Field>
        )}
        {editor.id && (
          <div className="border-t border-white/[0.07] pt-4">
            {deleteTarget === editor.id ? (
              <div className="rounded-xl border border-rose-300/15 bg-rose-400/[0.06] p-3">
                <p className="text-sm font-semibold text-rose-100">Delete this {editor.kind}?</p>
                <p className="mt-0.5 text-xs text-white/40">This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="btn-ghost min-h-11 flex-1">Cancel</button>
                  <button type="button" disabled={saving} onClick={() => deleteItem(editor.kind, editor.id)} className="min-h-11 flex-1 rounded-xl bg-rose-500/15 px-4 text-sm font-semibold text-rose-100 disabled:opacity-50">Delete</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setDeleteTarget(editor.id)} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-rose-200/70 hover:text-rose-100">
                <Trash2 className="h-4 w-4" /> Delete {editor.kind}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderList(kind) {
    const items = kind === 'asset' ? itemizedAssets : debts
    if (!items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-10 text-center">
          <CircleDollarSign className="mx-auto h-6 w-6 text-emerald-200/45" />
          <p className="mt-3 text-sm font-semibold text-white">No {kind === 'asset' ? 'itemized assets' : 'debts'} yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-white/38">{kind === 'asset' ? 'Add retirement accounts, property, vehicles, or other assets.' : 'Add balances and APRs so payoff advice uses your real costs.'}</p>
        </div>
      )
    }
    return (
      <div className="divide-y divide-white/[0.03]">
        {items.map(item => {
          const meta = kind === 'asset' ? typeMeta(item.type) : { icon: CreditCard, label: item.interest_rate == null ? 'APR not added' : `${Number(item.interest_rate)}% APR` }
          return (
            <ItemRow key={item.id} icon={meta.icon} name={item.name || (kind === 'asset' ? 'Asset' : 'Debt')}
              sub={kind === 'asset' ? `${meta.label}${item.interest_rate == null ? '' : ` · ${Number(item.interest_rate)}%`}` : meta.label}
              value={fmt(item.balance)} deleting={deleteTarget === item.id} disabled={saving}
              onEdit={() => kind === 'asset' ? beginAsset(item) : beginDebt(item)}
              onArmDelete={() => setDeleteTarget(item.id)} onCancelDelete={() => setDeleteTarget(null)}
              onDelete={() => deleteItem(kind, item.id)} />
          )
        })}
      </div>
    )
  }

  function sheetBody() {
    if (editor) return renderEditor()
    if (activeSheet === 'cashflow') return (
      <div className="space-y-4">
        <Field label="Monthly take-home income" prefix="$">
          <input type="number" inputMode="decimal" min="0" value={draft.income ?? ''} onChange={event => updateDraft('income', event.target.value)}
            className="w-full bg-transparent text-base font-semibold tabular-nums text-white focus:outline-none" />
        </Field>
        <Field label="Average monthly spending" prefix="$">
          <input type="number" inputMode="decimal" min="0" value={draft.expenses ?? ''} onChange={event => updateDraft('expenses', event.target.value)}
            className="w-full bg-transparent text-base font-semibold tabular-nums text-white focus:outline-none" />
        </Field>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Projected monthly surplus</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums ${money(draft.income) - money(draft.expenses) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{fmt(money(draft.income) - money(draft.expenses))}</p>
        </div>
      </div>
    )
    if (activeSheet === 'cash') return (
      <div className="space-y-4">
        <Field label="Checking and cash" prefix="$">
          <input type="number" inputMode="decimal" min="0" value={draft.checking ?? ''} onChange={event => updateDraft('checking', event.target.value)}
            className="w-full bg-transparent text-base font-semibold tabular-nums text-white focus:outline-none" />
        </Field>
        <Field label="Savings and HYSA" prefix="$">
          <input type="number" inputMode="decimal" min="0" value={draft.savings ?? ''} onChange={event => updateDraft('savings', event.target.value)}
            className="w-full bg-transparent text-base font-semibold tabular-nums text-white focus:outline-none" />
        </Field>
        <p className="text-xs leading-relaxed text-white/38">These liquid balances determine your emergency runway and feed the advisor's next-dollar recommendation.</p>
      </div>
    )
    if (activeSheet === 'assets') return renderList('asset')
    if (activeSheet === 'debts') return renderList('debt')
    return null
  }

  function sheetFooter() {
    if (confirmEditorDiscard) return (
      <div>
        <p className="text-sm font-semibold text-white">Discard these edits?</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setConfirmEditorDiscard(false)} className="btn-ghost min-h-11 flex-1">Keep editing</button>
          <button type="button" onClick={editor ? returnToList : closeSheet} className="min-h-11 flex-1 rounded-xl border border-rose-300/15 bg-rose-400/[0.08] px-4 text-sm font-semibold text-rose-100">Discard</button>
        </div>
      </div>
    )
    if (editor) return (
      <div className="flex gap-2">
        <button type="button" onClick={() => dirty ? setConfirmEditorDiscard(true) : returnToList()} className="btn-ghost min-h-11 flex-1">Cancel</button>
        <button type="button" disabled={saving || !draft.name?.trim()} onClick={saveEditor} className="btn-primary min-h-11 flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save {editor.kind}
        </button>
      </div>
    )
    if (activeSheet === 'assets' || activeSheet === 'debts') return (
      <button type="button" onClick={() => activeSheet === 'assets' ? beginAsset() : beginDebt()} className="btn-primary min-h-11 w-full">
        <Plus className="h-4 w-4" /> Add {activeSheet === 'assets' ? 'asset' : 'debt'}
      </button>
    )
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => dirty ? setConfirmEditorDiscard(true) : closeSheet()} className="btn-ghost min-h-11 flex-1">Cancel</button>
        <button type="button" disabled={saving || !dirty} onClick={activeSheet === 'cashflow' ? saveCashFlow : saveCash} className="btn-primary min-h-11 flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="mx-auto w-full max-w-4xl px-4 pb-8 md:px-6 md:pt-3">
      <PageHeader title="Your Money" subtitle="A clear view of what comes in, what you own, and what you owe." icon={Wallet} />

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3.5 py-3 text-xs text-rose-100">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-[24px] bg-white/[0.055]" />
          <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/[0.045]" />)}</div>
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[24px] border border-emerald-300/15 bg-[#0c1a14] px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.18)] md:px-6">
            <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-emerald-300/[0.055] blur-3xl" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/55">Net worth</p>
            <p className={`mt-2 text-[38px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[44px] ${netWorth >= 0 ? 'text-white' : 'text-rose-200'}`}>{fmt(netWorth)}</p>
            <div className="mt-4 flex gap-5 text-xs">
              <span className="tabular-nums text-emerald-100/65">Assets <strong className="ml-1 font-semibold text-emerald-100">{fmt(totalAssets)}</strong></span>
              <span className="tabular-nums text-rose-100/55">Debt <strong className="ml-1 font-semibold text-rose-100">{fmt(totalDebt)}</strong></span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
              <Metric label="Runway" value={snap.expenses > 0 ? `${snap.efMonths.toFixed(1)} mo` : '—'} note={`Target ${snap.efTargetMonths} mo`}
                tone={snap.efMonths >= snap.efTargetMonths ? 'text-emerald-200' : snap.efMonths >= 1 ? 'text-amber-200' : 'text-rose-200'} />
              <Metric label="Savings rate" value={snap.income > 0 ? `${Math.round(snap.savingsRate * 100)}%` : '—'} note="Target 20%+"
                tone={snap.savingsRate >= 0.2 ? 'text-emerald-200' : snap.savingsRate >= 0 ? 'text-amber-200' : 'text-rose-200'} />
              <Metric label="Debt-free" value={totalDebt === 0 ? 'Now' : snap.debtFree && !snap.debtFree.stuck ? snap.debtFree.debtFreeLabel : '—'} note={totalDebt === 0 ? 'Clear' : 'Using surplus'} tone="text-sky-200" />
            </div>
          </section>

          <section className={`mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${snap.next.urgent ? 'border-amber-300/18 bg-amber-300/[0.055]' : 'border-white/[0.08] bg-white/[0.04]'}`}>
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${snap.next.urgent ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/[0.08] text-emerald-200'}`}><ArrowRight className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Your next dollar</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-white">{snap.next.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/42">{snap.next.why}</p>
            </div>
            <button type="button" onClick={() => navigate('/advisor', { state: { ask: `My next priority is ${snap.next.title}. Help me turn that into a simple action plan.` } })}
              className="min-h-10 shrink-0 rounded-xl px-2.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-300/[0.07] hover:text-emerald-100">Ask advisor</button>
          </section>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SummaryCard icon={Banknote} title="Monthly cash flow" total={fmt(surplus)}
              meta={`${fmt(income)} in · ${fmt(expenses)} out`} detail={surplus >= 0 ? 'Available each month' : 'Monthly shortfall'}
              tone={surplus >= 0 ? 'emerald' : 'rose'} onClick={() => openSheet('cashflow')} />
            <SummaryCard icon={Landmark} title="Cash and savings" total={fmt(checking + savings)}
              meta={`${fmt(checking)} checking · ${fmt(savings)} savings`} detail={`${snap.efMonths.toFixed(1)} months of expenses`}
              tone="sky" onClick={() => openSheet('cash')} />
            <SummaryCard icon={BriefcaseBusiness} title="Investments and assets" total={fmt(itemizedTotal)}
              meta={`${itemizedAssets.length} item${itemizedAssets.length === 1 ? '' : 's'} tracked`} detail={itemizedAssets[0]?.name || 'Retirement, property, vehicles, and more'}
              tone="violet" onClick={() => openSheet('assets')} />
            <SummaryCard icon={CreditCard} title="Debts and liabilities" total={fmt(totalDebt)}
              meta={`${debts.length} balance${debts.length === 1 ? '' : 's'} tracked`} detail={highestApr ? `${highestApr.name} · ${Number(highestApr.interest_rate || 0)}% APR` : 'No debt balances added'}
              tone="rose" onClick={() => openSheet('debts')} />
          </div>
        </>
      )}

      <BottomSheet open={Boolean(activeSheet)} title={currentTitle || ''} subtitle={currentSubtitle}
        onClose={closeSheet} dirty={dirty} footer={sheetFooter()} size="md">
        {sheetError && <div role="alert" className="mb-4 rounded-xl border border-rose-300/18 bg-rose-400/[0.07] px-3 py-2.5 text-xs text-rose-100">{sheetError}</div>}
        {sheetBody()}
      </BottomSheet>
    </motion.div>
  )
}
