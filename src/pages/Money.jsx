import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle, ArrowRight, CalendarDays, ChevronDown, ChevronRight,
  CircleDollarSign, CreditCard, Gauge, Landmark, LineChart, Loader2, Pencil,
  Plus, RefreshCw, ShieldCheck, Trash2, WalletCards,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { computeSnapshot } from '@/lib/finance'
import {
  accountFamily, ASSET_SUBTYPES, CASH_FLOW_CATEGORIES, CASH_SUBTYPES,
  categoryMeta, daysSince, defaultSubtype, DEBT_TYPES, FREQUENCIES,
  INVESTMENT_SUBTYPES, isWorkplaceAccount, itemMonthlyAmount,
  monthlyAmount, subtypeLabel, taxTreatment,
} from '@/lib/moneyModel'
import { netWorthTrend } from '@/lib/netWorth'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'

const fmt = value => {
  const amount = Number(value) || 0
  return `${amount < 0 ? '-' : ''}$${Math.abs(Math.round(amount)).toLocaleString()}`
}
const number = value => Math.max(0, Number(value) || 0)
const optionalNumber = value => value === '' || value === null || value === undefined ? null : Math.max(0, Number(value) || 0)
const today = () => new Date().toISOString().slice(0, 10)

const GROUP_LABELS = { income: 'Income', needs: 'Needs', wants: 'Wants', future: 'Future' }
const FAMILY_META = {
  cash: { title: 'Cash accounts', subtitle: 'Checking, savings, cash, money markets, and CDs.', icon: Landmark },
  investment: { title: 'Investments', subtitle: 'Account-level balances and estimated return details.', icon: LineChart },
  asset: { title: 'Property and other assets', subtitle: 'Property, vehicles, and other valuable assets.', icon: WalletCards },
}

function Metric({ label, value, note, tone = 'text-white' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-readable-muted">{label}</p>
      <p className={`mt-1.5 truncate text-[19px] font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 min-h-8 text-[13px] leading-4 text-readable-secondary">{note}</p>
    </div>
  )
}

function SummaryCard({ icon: Icon, title, total, meta, detail, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="group flex min-h-[104px] min-w-0 w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.045] p-4 text-left transition-colors hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.08] text-emerald-200">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[15px] font-semibold text-readable-primary">{title}</span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">{total}</span>
        </span>
        <span className="mt-1 block text-[13px] leading-4 text-readable-secondary">{meta}</span>
        {detail && <span className="mt-1 block truncate text-xs text-readable-muted">{detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-readable-muted transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
    </button>
  )
}

function Field({ label, hint, prefix, suffix, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-readable-primary">
        {label}{hint && <span className="text-right text-xs font-normal text-readable-muted">{hint}</span>}
      </span>
      <span className="flex min-h-12 items-center rounded-xl border border-white/[0.13] bg-white/[0.06] px-3 focus-within:border-emerald-300/55 focus-within:ring-1 focus-within:ring-emerald-300/25">
        {prefix && <span className="mr-1 text-readable-secondary">{prefix}</span>}
        {children}
        {suffix && <span className="ml-1 text-readable-secondary">{suffix}</span>}
      </span>
    </label>
  )
}

const inputClass = 'min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-white outline-none placeholder:text-white/50 disabled:text-white/35'

function Toggle({ checked, onChange, label, note }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
      <span>
        <span className="block text-[13px] font-semibold text-readable-primary">{label}</span>
        {note && <span className="mt-0.5 block text-xs leading-4 text-readable-secondary">{note}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-400' : 'bg-white/15'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}

function MoreDetails({ open, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-[13px] font-semibold text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
      More details
      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

function EmptyState({ icon: Icon, title, copy, action, onAction }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.13] px-5 py-7 text-center">
      <Icon className="mx-auto h-6 w-6 text-emerald-200" />
      <p className="mt-3 text-[15px] font-semibold text-readable-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-readable-secondary">{copy}</p>
      <button type="button" onClick={onAction} className="btn-ghost mt-4 min-h-11">{action}</button>
    </div>
  )
}

function RecordRow({ title, subtitle, value, onEdit, onDelete, confirming, onConfirmDelete, onCancelDelete, disabled }) {
  if (confirming) {
    return (
      <div className="flex min-h-16 items-center gap-2 border-b border-white/[0.07] py-2.5 last:border-0">
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-rose-100">Delete {title}?</p>
        <button type="button" onClick={onCancelDelete} className="min-h-10 px-3 text-[13px] font-semibold text-readable-secondary">Cancel</button>
        <button type="button" disabled={disabled} onClick={onConfirmDelete}
          className="min-h-10 rounded-xl bg-rose-400/15 px-3 text-[13px] font-semibold text-rose-100 disabled:opacity-50">Delete</button>
      </div>
    )
  }
  return (
    <div className="flex min-h-16 items-center gap-2 border-b border-white/[0.07] py-2.5 last:border-0">
      <button type="button" onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-readable-primary">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-readable-secondary">{subtitle}</span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white">{value}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-readable-muted" />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-readable-muted transition-colors hover:bg-rose-400/10 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function SaveFooter({ onCancel, onSave, saving, saveLabel = 'Save', disabled = false }) {
  return (
    <div className="flex gap-2">
      {onCancel && <button type="button" onClick={onCancel} disabled={saving} className="btn-ghost min-h-11 flex-1">Cancel</button>}
      <button type="button" onClick={onSave} disabled={saving || disabled}
        className="btn-primary min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving</> : saveLabel}
      </button>
    </div>
  )
}

export default function Money() {
  const { user, profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts] = useState([])
  const [cashFlowItems, setCashFlowItems] = useState([])
  const [budgetLimits, setBudgetLimits] = useState([])
  const [trend, setTrend] = useState({ delta: 0, days: 0, has: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeSheet, setActiveSheet] = useState(null)
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState({})
  const [planDraftItems, setPlanDraftItems] = useState([])
  const [planDraftLimits, setPlanDraftLimits] = useState([])
  const [dirty, setDirty] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [breakdown, setBreakdown] = useState(null)

  async function loadData() {
    const [accountResult, debtResult, flowResult, limitResult] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('debts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('cash_flow_items').select('*').eq('user_id', user.id).order('sort_order').order('created_at'),
      supabase.from('budget_limits').select('*').eq('user_id', user.id).order('category'),
    ])
    const failed = [accountResult, debtResult, flowResult, limitResult].find(result => result.error)
    if (failed) throw failed.error
    setAccounts(accountResult.data ?? [])
    setDebts(debtResult.data ?? [])
    setCashFlowItems(flowResult.data ?? [])
    setBudgetLimits(limitResult.data ?? [])
    return { accounts: accountResult.data ?? [], debts: debtResult.data ?? [] }
  }

  useEffect(() => {
    loadData().catch(loadError => setError(loadError.message ?? 'Could not load your money data.'))
      .finally(() => setLoading(false))
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const snapshot = useMemo(() => computeSnapshot({
    profile, accounts, debts, cashFlowItems, budgetLimits,
  }), [profile, accounts, debts, cashFlowItems, budgetLimits])

  useEffect(() => {
    if (loading) return
    if (Number(profile?.net_worth) !== snapshot.netWorth) {
      setProfile(current => current ? { ...current, net_worth: snapshot.netWorth } : current)
      supabase.from('profiles').update({ net_worth: snapshot.netWorth }).eq('id', user.id)
        .then(({ error: profileError }) => { if (profileError) setError(profileError.message) })
    }
    netWorthTrend(user.id, {
      netWorth: snapshot.netWorth,
      assets: snapshot.assets,
      liabilities: snapshot.totalDebt,
    }).then(setTrend)
  }, [loading, snapshot.netWorth, snapshot.assets, snapshot.totalDebt]) // eslint-disable-line react-hooks/exhaustive-deps

  const accountGroups = useMemo(() => ({
    cash: accounts.filter(account => accountFamily(account) === 'cash'),
    investment: accounts.filter(account => accountFamily(account) === 'investment'),
    asset: accounts.filter(account => accountFamily(account) === 'asset'),
  }), [accounts])
  const activeDebts = useMemo(() => [...debts].filter(debt => Number(debt.balance) > 0)
    .sort((left, right) => Number(right.interest_rate || 0) - Number(left.interest_rate || 0)), [debts])
  const assetTotal = accountGroups.asset.filter(account => account.include_in_net_worth !== false)
    .reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const monthlyDebtCategory = snapshot.budgetStatus.byCategory.debt_payments || 0
  const planOutflow = snapshot.expenses + snapshot.futureAllocations

  function resetSheetState() {
    setEditor(null)
    setDraft({})
    setDirty(false)
    setEditorDirty(false)
    setSaving(false)
    setSheetError(null)
    setDeleteTarget(null)
    setShowMore(false)
    setBreakdown(null)
  }

  function openSheet(kind) {
    resetSheetState()
    setActiveSheet(kind)
    if (kind === 'plan') {
      setPlanDraftItems(cashFlowItems.map(item => ({ ...item })))
      setPlanDraftLimits(budgetLimits.map(limit => ({ ...limit })))
    }
    if (kind === 'balances') {
      setDraft(Object.fromEntries([
        ...accounts.map(account => [`account:${account.id}`, String(account.balance ?? 0)]),
        ...debts.map(debt => [`debt:${debt.id}`, String(debt.balance ?? 0)]),
      ]))
    }
  }

  function closeSheet() {
    setActiveSheet(null)
    resetSheetState()
  }

  function updateDraft(field, value) {
    setDraft(current => ({ ...current, [field]: value }))
    if (editor) setEditorDirty(true)
    else setDirty(true)
    setSheetError(null)
  }

  function beginFlowItem(item = null) {
    const meta = item ? categoryMeta(item.category_key, {
      kind: item.kind, group: item.group_key, key: item.category_key, label: item.name,
    }) : CASH_FLOW_CATEGORIES[0]
    setEditor({ kind: 'flow', id: item?.id ?? null })
    setDraft({
      kind: item?.kind ?? meta.kind,
      group_key: item?.group_key ?? meta.group,
      category_key: item?.category_key ?? meta.key,
      name: item?.name ?? meta.label,
      amount: item ? String(item.amount ?? 0) : '',
      frequency: item?.frequency ?? 'monthly',
      source: item?.source ?? 'user',
      target: String(planDraftLimits.find(limit => limit.category === (item?.category_key ?? meta.key))?.monthly_limit ?? ''),
    })
    setEditorDirty(false)
    setSheetError(null)
    setShowMore(false)
  }

  function changeFlowCategory(key) {
    if (key === 'custom') {
      setDraft(current => ({ ...current, category_key: `custom_${Date.now()}`, name: '', kind: 'expense', group_key: 'wants' }))
    } else {
      const meta = categoryMeta(key)
      setDraft(current => ({ ...current, category_key: key, name: meta.label, kind: meta.kind, group_key: meta.group,
        target: String(planDraftLimits.find(limit => limit.category === key)?.monthly_limit ?? '') }))
    }
    setEditorDirty(true)
  }

  function keepFlowItem() {
    if (!draft.name?.trim()) {
      setSheetError('Give this category a clear name.')
      return
    }
    const item = {
      ...(planDraftItems.find(row => row.id === editor.id) || {}),
      id: editor.id || `local-${crypto.randomUUID()}`,
      kind: draft.kind,
      group_key: draft.group_key,
      category_key: draft.category_key,
      name: draft.name.trim(),
      amount: number(draft.amount),
      frequency: draft.frequency,
      monthly_amount: monthlyAmount(draft.amount, draft.frequency),
      source: draft.source || 'user',
      sort_order: editor.id
        ? planDraftItems.findIndex(row => row.id === editor.id)
        : planDraftItems.length,
    }
    setPlanDraftItems(current => editor.id
      ? current.map(row => row.id === editor.id ? item : row)
      : [...current, item])
    const target = number(draft.target)
    setPlanDraftLimits(current => {
      const without = current.filter(limit => limit.category !== draft.category_key)
      return target > 0 ? [...without, { category: draft.category_key, monthly_limit: target }] : without
    })
    setEditor(null)
    setEditorDirty(false)
    setDirty(true)
    setSheetError(null)
  }

  function removeFlowItem(id) {
    const item = planDraftItems.find(row => row.id === id)
    setPlanDraftItems(current => current.filter(row => row.id !== id))
    if (item && !planDraftItems.some(row => row.id !== id && row.category_key === item.category_key)) {
      setPlanDraftLimits(current => current.filter(limit => limit.category !== item.category_key))
    }
    setDeleteTarget(null)
    setDirty(true)
  }

  async function saveMonthlyPlan() {
    setSaving(true)
    setSheetError(null)
    const items = planDraftItems.map((item, index) => ({
      kind: item.kind,
      group_key: item.group_key,
      category_key: item.category_key,
      name: item.name,
      amount: number(item.amount),
      frequency: item.frequency || 'monthly',
      source: item.source || 'user',
      sort_order: index,
    }))
    const limits = planDraftLimits.map(limit => ({ category: limit.category, monthly_limit: number(limit.monthly_limit) }))
    const { data, error: saveError } = await supabase.rpc('save_monthly_plan', { p_items: items, p_limits: limits })
    setSaving(false)
    if (saveError) {
      setSheetError(saveError.message ?? 'Could not save the monthly plan.')
      return
    }
    setCashFlowItems(data?.items ?? [])
    setBudgetLimits(data?.limits ?? [])
    if (data?.profile) setProfile(data.profile)
    closeSheet()
  }

  function startBreakdown(item) {
    setBreakdown({
      item,
      total: itemMonthlyAmount(item),
      values: { housing: '', utilities: '', groceries: '', transportation: '', insurance: '', dining: '', subscriptions: '' },
    })
    setSheetError(null)
  }

  function keepBreakdown() {
    const used = Object.values(breakdown.values).reduce((sum, value) => sum + number(value), 0)
    if (used > breakdown.total + 0.01) {
      setSheetError(`Categories are ${fmt(used - breakdown.total)} over the original total.`)
      return
    }
    const replacements = Object.entries(breakdown.values)
      .filter(([, value]) => number(value) > 0)
      .map(([key, value], index) => {
        const meta = categoryMeta(key)
        return {
          id: `local-${crypto.randomUUID()}`,
          kind: meta.kind, group_key: meta.group, category_key: key, name: meta.label,
          amount: number(value), monthly_amount: number(value), frequency: 'monthly', source: 'user', sort_order: index,
        }
      })
    const remainder = Math.round((breakdown.total - used) * 100) / 100
    if (remainder > 0) replacements.push({
      id: `local-${crypto.randomUUID()}`, kind: 'expense', group_key: 'wants', category_key: 'other_spending',
      name: 'Other spending', amount: remainder, monthly_amount: remainder, frequency: 'monthly', source: 'user', sort_order: replacements.length,
    })
    setPlanDraftItems(current => current.flatMap(item => item.id === breakdown.item.id ? replacements : [item]))
    setBreakdown(null)
    setDirty(true)
    setSheetError(null)
  }

  function reconcileDebtPayments() {
    const amount = snapshot.plannedDebtPayments
    const existing = planDraftItems.find(item => item.category_key === 'debt_payments')
    const row = {
      ...(existing || {}),
      id: existing?.id || `local-${crypto.randomUUID()}`,
      kind: 'expense', group_key: 'needs', category_key: 'debt_payments', name: 'Debt payments',
      amount, monthly_amount: amount, frequency: 'monthly', source: 'user',
      sort_order: existing?.sort_order ?? planDraftItems.length,
    }
    setPlanDraftItems(current => existing ? current.map(item => item.id === existing.id ? row : item) : [...current, row])
    setDirty(true)
  }

  function beginAccount(family, item = null) {
    const defaultOption = family === 'cash' ? CASH_SUBTYPES[0] : family === 'investment' ? INVESTMENT_SUBTYPES[0] : ASSET_SUBTYPES[0]
    const subtype = item ? (item.subtype || defaultSubtype(item.type)) : defaultOption.value
    setEditor({ kind: 'account', family, id: item?.id ?? null })
    setDraft({
      name: item?.name ?? '', institution: item?.institution ?? '', subtype,
      balance: item ? String(item.balance ?? 0) : '',
      interest_rate: item?.interest_rate == null ? '' : String(item.interest_rate),
      monthly_contribution: item?.monthly_contribution == null ? '' : String(item.monthly_contribution),
      ytd_contribution: item?.ytd_contribution == null ? '' : String(item.ytd_contribution),
      contribution_percent: item?.contribution_percent == null ? '' : String(item.contribution_percent),
      employer_match_percent: item?.employer_match_percent == null ? '' : String(item.employer_match_percent),
      employer_match_limit_percent: item?.employer_match_limit_percent == null ? '' : String(item.employer_match_limit_percent),
      is_liquid: item?.is_liquid == null ? 'auto' : String(item.is_liquid),
      include_in_net_worth: item?.include_in_net_worth !== false,
      last_verified_at: item?.last_verified_at || today(),
    })
    setEditorDirty(false)
    setSheetError(null)
    setShowMore(false)
    setDeleteTarget(null)
  }

  async function saveAccount() {
    if (!draft.name?.trim()) {
      setSheetError('Add an account nickname.')
      return
    }
    setSaving(true)
    setSheetError(null)
    const family = editor.family
    const type = family === 'cash'
      ? (draft.subtype === 'checking' ? 'checking' : 'savings')
      : family === 'investment' ? 'brokerage' : draft.subtype
    const payload = {
      user_id: user.id, name: draft.name.trim(), institution: draft.institution.trim() || null,
      type, subtype: draft.subtype, balance: number(draft.balance),
      interest_rate: family === 'asset' ? null : optionalNumber(draft.interest_rate),
      monthly_contribution: family === 'investment' ? number(draft.monthly_contribution) : 0,
      ytd_contribution: family === 'investment' ? optionalNumber(draft.ytd_contribution) : null,
      contribution_year: family === 'investment' && draft.ytd_contribution !== '' ? new Date().getFullYear() : null,
      contribution_percent: family === 'investment' ? optionalNumber(draft.contribution_percent) : null,
      employer_match_percent: family === 'investment' ? optionalNumber(draft.employer_match_percent) : null,
      employer_match_limit_percent: family === 'investment' ? optionalNumber(draft.employer_match_limit_percent) : null,
      is_liquid: family === 'cash' ? (draft.is_liquid === 'auto' ? null : draft.is_liquid === 'true') : false,
      include_in_net_worth: Boolean(draft.include_in_net_worth),
      last_verified_at: draft.last_verified_at || null,
      updated_at: new Date().toISOString(),
    }
    const query = editor.id
      ? supabase.from('accounts').update(payload).eq('id', editor.id).eq('user_id', user.id)
      : supabase.from('accounts').insert(payload)
    const { error: saveError } = await query.select().single()
    if (saveError) {
      setSaving(false)
      setSheetError(saveError.message ?? 'Could not save this account.')
      return
    }
    try {
      await loadData()
      setEditor(null)
      setEditorDirty(false)
      setDirty(false)
      setSaving(false)
    } catch (refreshError) {
      setSaving(false)
      setSheetError(refreshError.message ?? 'Saved, but could not refresh the account list.')
    }
  }

  function beginDebt(item = null) {
    setEditor({ kind: 'debt', id: item?.id ?? null })
    setDraft({
      name: item?.name ?? '', type: item?.type || 'other', lender: item?.lender ?? '',
      balance: item ? String(item.balance ?? 0) : '',
      interest_rate: item?.interest_rate == null ? '' : String(item.interest_rate),
      minimum_payment: item?.minimum_payment == null ? '' : String(item.minimum_payment),
      planned_payment: item?.planned_payment == null ? '' : String(item.planned_payment),
      due_day: item?.due_day == null ? '' : String(item.due_day),
      credit_limit: item?.credit_limit == null ? '' : String(item.credit_limit),
      original_balance: item?.original_balance == null ? '' : String(item.original_balance),
      term_end_date: item?.term_end_date || '',
      include_in_net_worth: item?.include_in_net_worth !== false,
      last_verified_at: item?.last_verified_at || today(),
    })
    setEditorDirty(false)
    setSheetError(null)
    setShowMore(false)
    setDeleteTarget(null)
  }

  async function saveDebt() {
    if (!draft.name?.trim()) {
      setSheetError('Add a name for this debt.')
      return
    }
    const dueDay = optionalNumber(draft.due_day)
    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      setSheetError('Due day must be between 1 and 31.')
      return
    }
    setSaving(true)
    setSheetError(null)
    const payload = {
      user_id: user.id, name: draft.name.trim(), type: draft.type, lender: draft.lender.trim() || null,
      balance: number(draft.balance), interest_rate: optionalNumber(draft.interest_rate),
      minimum_payment: optionalNumber(draft.minimum_payment), planned_payment: optionalNumber(draft.planned_payment),
      due_day: dueDay, credit_limit: draft.type === 'credit_card' ? optionalNumber(draft.credit_limit) : null,
      original_balance: draft.type !== 'credit_card' ? optionalNumber(draft.original_balance) : null,
      term_end_date: draft.type !== 'credit_card' && draft.term_end_date ? draft.term_end_date : null,
      include_in_net_worth: Boolean(draft.include_in_net_worth),
      last_verified_at: draft.last_verified_at || null, updated_at: new Date().toISOString(),
    }
    const query = editor.id
      ? supabase.from('debts').update(payload).eq('id', editor.id).eq('user_id', user.id)
      : supabase.from('debts').insert(payload)
    const { error: saveError } = await query.select().single()
    if (saveError) {
      setSaving(false)
      setSheetError(saveError.message ?? 'Could not save this debt.')
      return
    }
    try {
      await loadData()
      setEditor(null)
      setEditorDirty(false)
      setDirty(false)
      setSaving(false)
    } catch (refreshError) {
      setSaving(false)
      setSheetError(refreshError.message ?? 'Saved, but could not refresh the debt list.')
    }
  }

  async function deleteRecord(table, id) {
    setSaving(true)
    setSheetError(null)
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
    if (deleteError) {
      setSaving(false)
      setSheetError(deleteError.message ?? 'Could not delete this item.')
      return
    }
    try {
      await loadData()
      setDeleteTarget(null)
      setSaving(false)
    } catch (refreshError) {
      setSaving(false)
      setSheetError(refreshError.message ?? 'Deleted, but could not refresh the list.')
    }
  }

  async function saveBalances() {
    setSaving(true)
    setSheetError(null)
    const updates = [
      ...accounts.map(account => supabase.from('accounts').update({ balance: number(draft[`account:${account.id}`]), last_verified_at: today() }).eq('id', account.id).eq('user_id', user.id)),
      ...debts.map(debt => supabase.from('debts').update({ balance: number(draft[`debt:${debt.id}`]), last_verified_at: today() }).eq('id', debt.id).eq('user_id', user.id)),
    ]
    const results = await Promise.allSettled(updates)
    let refreshError = null
    let canonical = null
    try { canonical = await loadData() } catch (caught) { refreshError = caught }
    const failed = results.some(result => result.status === 'rejected' || result.value?.error)
    setSaving(false)
    if (failed || refreshError) {
      setSheetError(refreshError?.message || 'Some balances did not save. The latest saved values have been reloaded.')
      setDraft(Object.fromEntries([
        ...(canonical?.accounts || accounts).map(account => [`account:${account.id}`, String(account.balance ?? 0)]),
        ...(canonical?.debts || debts).map(debt => [`debt:${debt.id}`, String(debt.balance ?? 0)]),
      ]))
      setDirty(false)
      return
    }
    closeSheet()
  }

  function sheetTitle() {
    if (editor?.kind === 'flow') return editor.id ? 'Edit monthly item' : 'Add monthly item'
    if (editor?.kind === 'account') return `${editor.id ? 'Edit' : 'Add'} ${editor.family === 'asset' ? 'asset' : 'account'}`
    if (editor?.kind === 'debt') return editor.id ? 'Edit debt' : 'Add debt'
    if (activeSheet === 'plan') return 'Monthly plan'
    if (activeSheet === 'debts') return 'Debts'
    if (activeSheet === 'balances') return 'Update balances'
    return FAMILY_META[activeSheet]?.title || 'Money details'
  }

  function returnToList() {
    setEditor(null)
    setEditorDirty(false)
    setDraft({})
    setSheetError(null)
    setShowMore(false)
  }

  function sheetFooter(requestClose) {
    if (breakdown) return <SaveFooter onCancel={() => { setBreakdown(null); setSheetError(null) }} onSave={keepBreakdown} saving={false} saveLabel="Keep breakdown" />
    if (editor?.kind === 'flow') return <SaveFooter onCancel={returnToList} onSave={keepFlowItem} saving={false} saveLabel="Keep item" />
    if (editor?.kind === 'account') return <SaveFooter onCancel={returnToList} onSave={saveAccount} saving={saving} saveLabel="Save account" />
    if (editor?.kind === 'debt') return <SaveFooter onCancel={returnToList} onSave={saveDebt} saving={saving} saveLabel="Save debt" />
    if (activeSheet === 'plan') return <SaveFooter onSave={saveMonthlyPlan} saving={saving} saveLabel="Save monthly plan" disabled={!dirty} />
    if (activeSheet === 'balances') return <SaveFooter onCancel={requestClose} onSave={saveBalances} saving={saving} saveLabel="Update balances" disabled={!dirty} />
    return null
  }

  function renderFlowEditor() {
    const custom = draft.category_key?.startsWith('custom_')
    const options = CASH_FLOW_CATEGORIES
    return (
      <div className="space-y-4">
        <Field label="Category">
          <select value={custom ? 'custom' : draft.category_key} onChange={event => changeFlowCategory(event.target.value)} className={inputClass}>
            {Object.entries(GROUP_LABELS).map(([group, label]) => (
              <optgroup key={group} label={label} className="bg-[#0a1410]">
                {options.filter(item => item.group === group).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
              </optgroup>
            ))}
            <option value="custom" className="bg-[#0a1410]">Custom category</option>
          </select>
        </Field>
        {custom && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category name"><input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. Pet care" className={inputClass} /></Field>
            <Field label="Group">
              <select value={draft.group_key} onChange={event => {
                const group = event.target.value
                updateDraft('group_key', group)
                setDraft(current => ({ ...current, kind: group === 'income' ? 'income' : group === 'future' ? 'allocation' : 'expense' }))
              }} className={inputClass}>
                {Object.entries(GROUP_LABELS).map(([value, label]) => <option key={value} value={value} className="bg-[#0a1410]">{label}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Typical amount" prefix="$"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={event => updateDraft('amount', event.target.value)} className={inputClass} /></Field>
          <Field label="Frequency">
            <select value={draft.frequency} onChange={event => updateDraft('frequency', event.target.value)} className={inputClass}>
              {FREQUENCIES.map(item => <option key={item.value} value={item.value} className="bg-[#0a1410]">{item.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="rounded-xl border border-emerald-300/12 bg-emerald-300/[0.05] px-3.5 py-3">
          <p className="text-xs text-readable-secondary">Typical monthly amount</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-100">{fmt(monthlyAmount(draft.amount, draft.frequency))}</p>
        </div>
        <MoreDetails open={showMore} onClick={() => setShowMore(value => !value)} />
        {showMore && <Field label="Optional monthly target" hint="A planning target, not actual spending" prefix="$"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.target} onChange={event => updateDraft('target', event.target.value)} className={inputClass} /></Field>}
      </div>
    )
  }

  function renderBreakdown() {
    const used = Object.values(breakdown.values).reduce((sum, value) => sum + number(value), 0)
    const remaining = breakdown.total - used
    return (
      <div>
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4">
          <p className="text-[13px] font-semibold text-readable-primary">Original typical monthly spending</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{fmt(breakdown.total)}</p>
          <p className="mt-2 text-xs leading-5 text-readable-secondary">Add only what you know. Any remainder stays in Other spending, so your saved total will not change.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.keys(breakdown.values).map(key => <Field key={key} label={categoryMeta(key).label} prefix="$"><input type="number" min="0" inputMode="decimal" value={breakdown.values[key]}
            onChange={event => { setBreakdown(current => ({ ...current, values: { ...current.values, [key]: event.target.value } })); setSheetError(null) }} className={inputClass} /></Field>)}
        </div>
        <div className={`mt-4 flex items-center justify-between rounded-xl border px-3.5 py-3 ${remaining < 0 ? 'border-rose-300/20 bg-rose-400/[0.07]' : 'border-white/[0.1] bg-white/[0.04]'}`}>
          <span className="text-[13px] font-semibold text-readable-primary">Remaining in Other spending</span>
          <span className={`font-semibold tabular-nums ${remaining < 0 ? 'text-rose-100' : 'text-white'}`}>{fmt(remaining)}</span>
        </div>
      </div>
    )
  }

  function renderPlanList() {
    const grouped = Object.keys(GROUP_LABELS).map(group => ({ group, rows: planDraftItems.filter(item => item.group_key === group) }))
      .filter(section => section.rows.length)
    const legacyExpense = planDraftItems.find(item => item.kind === 'expense' && item.category_key === 'other_spending' && ['legacy', 'onboarding'].includes(item.source))
    const plannedDebt = activeDebts.length ? snapshot.plannedDebtPayments : 0
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-3">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-readable-muted">Income</p><p className="mt-1 text-[15px] font-semibold tabular-nums text-white">{fmt(planDraftItems.filter(item => item.kind === 'income').reduce((sum, item) => sum + itemMonthlyAmount(item), 0))}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-readable-muted">Spending</p><p className="mt-1 text-[15px] font-semibold tabular-nums text-white">{fmt(planDraftItems.filter(item => item.kind === 'expense').reduce((sum, item) => sum + itemMonthlyAmount(item), 0))}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-readable-muted">Future</p><p className="mt-1 text-[15px] font-semibold tabular-nums text-emerald-100">{fmt(planDraftItems.filter(item => item.kind === 'allocation').reduce((sum, item) => sum + itemMonthlyAmount(item), 0))}</p></div>
        </div>
        {legacyExpense && (
          <button type="button" onClick={() => startBreakdown(legacyExpense)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] px-3.5 text-left text-[13px] font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
            Break this total into categories
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {plannedDebt > 0 && Math.abs(plannedDebt - monthlyDebtCategory) >= 1 && (
          <div className="rounded-xl border border-amber-300/18 bg-amber-300/[0.055] p-3.5">
            <p className="text-[13px] font-semibold text-amber-50">Debt details total {fmt(plannedDebt)}/mo</p>
            <p className="mt-1 text-xs leading-5 text-readable-secondary">Your Monthly Plan currently assigns {fmt(monthlyDebtCategory)}. These are compared, never silently counted twice.</p>
            <button type="button" onClick={reconcileDebtPayments} className="mt-2 min-h-10 text-[13px] font-semibold text-amber-100">Use {fmt(plannedDebt)} in Monthly Plan</button>
          </div>
        )}
        {!grouped.length ? (
          <EmptyState icon={CircleDollarSign} title="Build your typical month" copy="Add income, spending, and future allocations. This is a plan, not transaction tracking." action="Add first category" onAction={() => beginFlowItem()} />
        ) : grouped.map(section => (
          <section key={section.group}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-readable-muted">{GROUP_LABELS[section.group]}</h3>
              <span className="text-xs tabular-nums text-readable-secondary">{fmt(section.rows.reduce((sum, item) => sum + itemMonthlyAmount(item), 0))}/mo</span>
            </div>
            {section.rows.map(item => (
              <RecordRow key={item.id} title={item.name}
                subtitle={`${FREQUENCIES.find(option => option.value === item.frequency)?.label || 'Monthly'} · ${fmt(itemMonthlyAmount(item))}/mo${planDraftLimits.some(limit => limit.category === item.category_key) ? ` · ${fmt(planDraftLimits.find(limit => limit.category === item.category_key).monthly_limit)} target` : ''}`}
                value={fmt(item.amount)} onEdit={() => beginFlowItem(item)} onDelete={() => setDeleteTarget(item.id)}
                confirming={deleteTarget === item.id} onCancelDelete={() => setDeleteTarget(null)} onConfirmDelete={() => removeFlowItem(item.id)} />
            ))}
          </section>
        ))}
        <button type="button" onClick={() => beginFlowItem()} className="btn-ghost min-h-11 w-full"><Plus className="h-4 w-4" /> Add category</button>
      </div>
    )
  }

  function renderAccountEditor() {
    const family = editor.family
    const options = family === 'cash' ? CASH_SUBTYPES : family === 'investment' ? INVESTMENT_SUBTYPES : ASSET_SUBTYPES
    const workplace = family === 'investment' && isWorkplaceAccount({ subtype: draft.subtype })
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account nickname"><input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. Emergency fund" className={inputClass} /></Field>
          <Field label={family === 'asset' ? 'Asset type' : 'Account type'}>
            <select value={draft.subtype} onChange={event => updateDraft('subtype', event.target.value)} className={inputClass}>
              {options.map(option => <option key={option.value} value={option.value} className="bg-[#0a1410]">{option.label}</option>)}
            </select>
          </Field>
        </div>
        {family !== 'asset' && <Field label="Institution" hint="Never enter login details"><input value={draft.institution} onChange={event => updateDraft('institution', event.target.value)} placeholder="e.g. Fidelity" className={inputClass} /></Field>}
        <div className={`grid gap-4 ${family === 'asset' ? '' : 'sm:grid-cols-2'}`}>
          <Field label="Current balance" prefix="$"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.balance} onChange={event => updateDraft('balance', event.target.value)} className={inputClass} /></Field>
          {family !== 'asset' && <Field label={family === 'cash' ? 'APY' : 'Expected annual return'} hint={family === 'investment' ? 'Estimate only' : null} suffix="%"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.interest_rate} onChange={event => updateDraft('interest_rate', event.target.value)} placeholder="Optional" className={inputClass} /></Field>}
        </div>
        {family === 'investment' && (
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-3 text-xs leading-5 text-readable-secondary">
            {taxTreatment({ subtype: draft.subtype })}. Returns are planning estimates, not actual market performance.
          </div>
        )}
        <MoreDetails open={showMore} onClick={() => setShowMore(value => !value)} />
        {showMore && (
          <div className="space-y-4 border-t border-white/[0.08] pt-4">
            {family === 'investment' && <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Monthly contribution" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.monthly_contribution} onChange={event => updateDraft('monthly_contribution', event.target.value)} className={inputClass} /></Field>
                <Field label="Year-to-date contribution" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.ytd_contribution} onChange={event => updateDraft('ytd_contribution', event.target.value)} className={inputClass} /></Field>
              </div>
              {workplace && <div className="grid gap-4 sm:grid-cols-3">
                <Field label="You contribute" suffix="%"><input type="number" min="0" inputMode="decimal" value={draft.contribution_percent} onChange={event => updateDraft('contribution_percent', event.target.value)} className={inputClass} /></Field>
                <Field label="Employer match" suffix="%"><input type="number" min="0" inputMode="decimal" value={draft.employer_match_percent} onChange={event => updateDraft('employer_match_percent', event.target.value)} className={inputClass} /></Field>
                <Field label="Match applies up to" suffix="%"><input type="number" min="0" inputMode="decimal" value={draft.employer_match_limit_percent} onChange={event => updateDraft('employer_match_limit_percent', event.target.value)} className={inputClass} /></Field>
              </div>}
            </>}
            {family === 'cash' && <Field label="Liquidity">
              <select value={draft.is_liquid} onChange={event => updateDraft('is_liquid', event.target.value)} className={inputClass}>
                <option value="auto" className="bg-[#0a1410]">Automatic for account type</option>
                <option value="true" className="bg-[#0a1410]">Available now</option>
                <option value="false" className="bg-[#0a1410]">Restricted or locked</option>
              </select>
            </Field>}
            <Field label="Last verified"><input type="date" value={draft.last_verified_at} onChange={event => updateDraft('last_verified_at', event.target.value)} className={inputClass} /></Field>
            <Toggle checked={draft.include_in_net_worth} onChange={value => updateDraft('include_in_net_worth', value)} label="Include in net worth" note="Turn off only when this balance should stay informational." />
          </div>
        )}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-xs leading-5 text-readable-muted">
          Garden Financial never asks for credentials or full account numbers.
        </div>
      </div>
    )
  }

  function renderAccountList(family) {
    const rows = accountGroups[family]
    return (
      <div>
        {rows.length ? rows.map(account => {
          const freshness = daysSince(account.last_verified_at)
          const secondary = [account.institution, subtypeLabel(account), freshness === null ? 'Not verified' : freshness === 0 ? 'Verified today' : `Verified ${freshness}d ago`].filter(Boolean).join(' · ')
          return <RecordRow key={account.id} title={account.name} subtitle={secondary} value={fmt(account.balance)}
            onEdit={() => beginAccount(family, account)} onDelete={() => setDeleteTarget(account.id)} confirming={deleteTarget === account.id}
            onCancelDelete={() => setDeleteTarget(null)} onConfirmDelete={() => deleteRecord('accounts', account.id)} disabled={saving} />
        }) : <EmptyState icon={FAMILY_META[family].icon} title={`No ${family === 'asset' ? 'assets' : `${family} accounts`} yet`}
          copy={family === 'investment' ? 'Track the account itself—no holdings or live market data needed.' : 'Add only the details that help you make decisions.'}
          action={family === 'asset' ? 'Add asset' : 'Add account'} onAction={() => beginAccount(family)} />}
        {rows.length > 0 && <button type="button" onClick={() => beginAccount(family)} className="btn-ghost mt-4 min-h-11 w-full"><Plus className="h-4 w-4" /> {family === 'asset' ? 'Add asset' : 'Add account'}</button>}
      </div>
    )
  }

  function renderDebtEditor() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Debt name"><input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. Visa card" className={inputClass} /></Field>
          <Field label="Debt type"><select value={draft.type} onChange={event => updateDraft('type', event.target.value)} className={inputClass}>{DEBT_TYPES.map(option => <option key={option.value} value={option.value} className="bg-[#0a1410]">{option.label}</option>)}</select></Field>
        </div>
        <Field label="Current balance" prefix="$"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.balance} onChange={event => updateDraft('balance', event.target.value)} className={inputClass} /></Field>
        <MoreDetails open={showMore} onClick={() => setShowMore(value => !value)} />
        {showMore && <div className="space-y-4 border-t border-white/[0.08] pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lender"><input value={draft.lender} onChange={event => updateDraft('lender', event.target.value)} placeholder="Optional" className={inputClass} /></Field>
            <Field label="APR" suffix="%"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.interest_rate} onChange={event => updateDraft('interest_rate', event.target.value)} placeholder="Optional" className={inputClass} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum payment" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.minimum_payment} onChange={event => updateDraft('minimum_payment', event.target.value)} className={inputClass} /></Field>
            <Field label="Planned payment" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.planned_payment} onChange={event => updateDraft('planned_payment', event.target.value)} className={inputClass} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due day" hint="1–31"><input type="number" min="1" max="31" inputMode="numeric" value={draft.due_day} onChange={event => updateDraft('due_day', event.target.value)} className={inputClass} /></Field>
            <Field label="Last verified"><input type="date" value={draft.last_verified_at} onChange={event => updateDraft('last_verified_at', event.target.value)} className={inputClass} /></Field>
          </div>
          {draft.type === 'credit_card' ? <Field label="Credit limit" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.credit_limit} onChange={event => updateDraft('credit_limit', event.target.value)} className={inputClass} /></Field> : <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Original balance" prefix="$"><input type="number" min="0" inputMode="decimal" value={draft.original_balance} onChange={event => updateDraft('original_balance', event.target.value)} className={inputClass} /></Field>
            <Field label="Expected end date"><input type="date" value={draft.term_end_date} onChange={event => updateDraft('term_end_date', event.target.value)} className={inputClass} /></Field>
          </div>}
          <Toggle checked={draft.include_in_net_worth} onChange={value => updateDraft('include_in_net_worth', value)} label="Include in net worth" note="Most debts should remain included." />
        </div>}
      </div>
    )
  }

  function renderDebtList() {
    return (
      <div>
        {activeDebts.length ? <>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-3">
            <div><p className="text-[11px] font-bold uppercase tracking-wide text-readable-muted">Monthly interest</p><p className="mt-1 font-semibold tabular-nums text-white">{fmt(snapshot.debtMonthlyInterest)}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-wide text-readable-muted">Planned payments</p><p className="mt-1 font-semibold tabular-nums text-white">{fmt(snapshot.plannedDebtPayments)}</p></div>
          </div>
          {activeDebts.map(debt => <RecordRow key={debt.id} title={debt.name}
            subtitle={`${DEBT_TYPES.find(option => option.value === debt.type)?.label || 'Debt'}${debt.interest_rate == null ? ' · APR missing' : ` · ${Number(debt.interest_rate)}% APR`}${debt.minimum_payment == null ? ' · Minimum missing' : ` · ${fmt(debt.minimum_payment)} minimum`}`}
            value={fmt(debt.balance)} onEdit={() => beginDebt(debt)} onDelete={() => setDeleteTarget(debt.id)} confirming={deleteTarget === debt.id}
            onCancelDelete={() => setDeleteTarget(null)} onConfirmDelete={() => deleteRecord('debts', debt.id)} disabled={saving} />)}
          <button type="button" onClick={() => beginDebt()} className="btn-ghost mt-4 min-h-11 w-full"><Plus className="h-4 w-4" /> Add debt</button>
        </> : <EmptyState icon={CreditCard} title="No active debts tracked" copy="If you add one, only name, type, and balance are required. Rates and payment details stay optional." action="Add debt" onAction={() => beginDebt()} />}
        {activeDebts.length > 0 && !snapshot.debtFree && <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-xs leading-5 text-readable-secondary">Add an APR and minimum payment for every active debt to unlock an honest debt-free date.</p>}
        {snapshot.debtFree && !snapshot.debtFree.stuck && <p className="mt-4 rounded-xl border border-emerald-300/14 bg-emerald-300/[0.05] px-3.5 py-3 text-[13px] leading-5 text-emerald-100">At your planned payments, the minimum-aware avalanche reaches debt-free in about {snapshot.debtFree.months} months ({snapshot.debtFree.debtFreeLabel}).</p>}
      </div>
    )
  }

  function renderBalanceSheet() {
    const rows = [...accounts.map(account => ({ ...account, recordType: 'account' })), ...debts.map(debt => ({ ...debt, recordType: 'debt' }))]
    return rows.length ? <div className="space-y-3">
      <p className="text-[13px] leading-5 text-readable-secondary">Refresh several balances at once. Saving also marks them verified today.</p>
      {rows.map(row => <Field key={`${row.recordType}:${row.id}`} label={row.name} hint={row.recordType === 'debt' ? 'Debt balance' : subtypeLabel(row)} prefix="$"><input type="number" min="0" inputMode="decimal" value={draft[`${row.recordType}:${row.id}`] ?? ''} onChange={event => updateDraft(`${row.recordType}:${row.id}`, event.target.value)} className={inputClass} /></Field>)}
    </div> : <EmptyState icon={RefreshCw} title="Nothing to refresh yet" copy="Add an account or debt first." action="Add an account" onAction={() => { closeSheet(); openSheet('cash') }} />
  }

  function sheetBody() {
    if (breakdown) return renderBreakdown()
    if (editor?.kind === 'flow') return renderFlowEditor()
    if (editor?.kind === 'account') return renderAccountEditor()
    if (editor?.kind === 'debt') return renderDebtEditor()
    if (activeSheet === 'plan') return renderPlanList()
    if (activeSheet === 'debts') return renderDebtList()
    if (activeSheet === 'balances') return renderBalanceSheet()
    if (FAMILY_META[activeSheet]) return renderAccountList(activeSheet)
    return null
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-300" /><span className="sr-only">Loading money data</span></div>

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mx-auto w-full max-w-3xl px-4 pb-10 md:px-6">
      <PageHeader title="Money" subtitle="A clear plan first. Detail when you need it." actions={
        <button type="button" onClick={() => openSheet('balances')} className="btn-ghost min-h-11 px-3" aria-label="Update balances"><RefreshCw className="h-4 w-4" /><span className="hidden sm:inline">Update</span></button>
      } />

      {error && <div role="alert" className="mb-4 flex gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] p-4 text-[13px] leading-5 text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      <section className="overflow-hidden rounded-[28px] border border-emerald-200/15 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.13),transparent_42%),linear-gradient(145deg,rgba(14,31,24,0.98),rgba(7,17,13,0.98))] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.24)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/75">Net worth</p>
            <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[42px]">{fmt(snapshot.netWorth)}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.08] text-emerald-100"><Gauge className="h-5 w-5" /></span>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-readable-secondary">
          <span><strong className="font-semibold text-white">{fmt(snapshot.assets)}</strong> assets</span>
          <span><strong className="font-semibold text-white">{fmt(snapshot.totalDebt)}</strong> liabilities</span>
          <span className={trend.has && trend.delta < 0 ? 'text-rose-100' : 'text-emerald-100'}>{trend.has ? `${trend.delta >= 0 ? '+' : ''}${fmt(trend.delta)} over ${trend.days} days` : '30-day change starts after your next snapshot'}</span>
        </div>
      </section>

      <section aria-label="Financial health" className="mt-4 grid grid-cols-2 gap-2.5">
        <Metric label="Cash-flow margin" value={fmt(snapshot.cashFlowMargin)} note={`${Math.round(snapshot.savingsRate * 100)}% of typical income`} tone={snapshot.cashFlowMargin < 0 ? 'text-rose-100' : 'text-white'} />
        <Metric label="Emergency runway" value={`${snapshot.efMonths.toFixed(1)} mo`} note={`${fmt(snapshot.liquid)} liquid cash`} />
        <Metric label="Debt interest" value={`${fmt(snapshot.debtMonthlyInterest)}/mo`} note={snapshot.totalDebt ? `${snapshot.weightedDebtApr.toFixed(1)}% weighted APR` : 'No active debt cost'} />
        <Metric label="Left to assign" value={fmt(snapshot.unallocated)} note={`${fmt(snapshot.futureAllocations)} planned for future`} tone={snapshot.unallocated < 0 ? 'text-rose-100' : 'text-emerald-100'} />
      </section>

      <section className={`mt-4 rounded-2xl border p-4 ${snapshot.next.urgent ? 'border-amber-300/20 bg-amber-300/[0.055]' : 'border-emerald-300/15 bg-emerald-300/[0.045]'}`}>
        <div className="flex gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${snapshot.next.urgent ? 'bg-amber-300/10 text-amber-100' : 'bg-emerald-300/10 text-emerald-100'}`}><ShieldCheck className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-readable-muted">Next move</p>
            <h2 className="mt-1 text-[16px] font-semibold text-readable-primary">{snapshot.next.title}</h2>
            <p className="mt-1 text-[13px] leading-5 text-readable-secondary">{snapshot.next.why}</p>
            <button type="button" onClick={() => navigate('/advisor', { state: { ask: `Help me with my next money move: ${snapshot.next.title}` } })}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
              Work through this with Advisor <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="text-[18px] font-semibold text-readable-primary">Your money, organized</h2><p className="mt-1 text-[13px] text-readable-secondary">Tap a section only when you want the detail.</p></div>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          <SummaryCard icon={CalendarDays} title="Monthly plan" total={`${fmt(planOutflow)}/mo`} meta={`${cashFlowItems.length} populated ${cashFlowItems.length === 1 ? 'category' : 'categories'}`} detail={`${fmt(snapshot.income)} income · ${fmt(snapshot.unallocated)} left to assign`} onClick={() => openSheet('plan')} />
          <SummaryCard icon={Landmark} title="Cash accounts" total={fmt(accountGroups.cash.reduce((sum, account) => sum + Number(account.balance || 0), 0))} meta={`${accountGroups.cash.length} ${accountGroups.cash.length === 1 ? 'account' : 'accounts'} · ${snapshot.weightedCashApy.toFixed(2)}% weighted APY`} detail={`About ${fmt(snapshot.annualCashInterest)}/yr estimated interest`} onClick={() => openSheet('cash')} />
          <SummaryCard icon={LineChart} title="Investments" total={fmt(snapshot.invested)} meta={`${accountGroups.investment.length} ${accountGroups.investment.length === 1 ? 'account' : 'accounts'} · ${fmt(snapshot.investmentMonthlyContributions)}/mo contributed`} detail="Returns shown as estimates, never actual performance" onClick={() => openSheet('investment')} />
          <SummaryCard icon={WalletCards} title="Property and other assets" total={fmt(assetTotal)} meta={`${accountGroups.asset.length} ${accountGroups.asset.length === 1 ? 'asset' : 'assets'}`} detail={accountGroups.asset.length ? accountGroups.asset.map(account => subtypeLabel(account)).join(' · ') : 'Property, vehicles, and other assets'} onClick={() => openSheet('asset')} />
          <div className="md:col-span-2"><SummaryCard icon={CreditCard} title="Debts" total={fmt(snapshot.totalDebt)} meta={`${activeDebts.length} active · ${snapshot.weightedDebtApr.toFixed(1)}% weighted APR`} detail={snapshot.cardUtilization == null ? `${fmt(snapshot.requiredDebtPayments)}/mo required payments` : `${Math.round(snapshot.cardUtilization * 100)}% credit-card utilization`} onClick={() => openSheet('debts')} /></div>
        </div>
      </section>

      <BottomSheet open={Boolean(activeSheet)} title={sheetTitle()}
        subtitle={editor || breakdown ? 'Required fields first. Optional details stay tucked away.' : activeSheet === 'plan' ? 'Typical monthly amounts and targets—not transaction activity.' : activeSheet === 'balances' ? 'A quick manual refresh across your tracked balances.' : FAMILY_META[activeSheet]?.subtitle}
        onClose={closeSheet} dirty={dirty || editorDirty} size="lg"
        footer={(editor || breakdown || activeSheet === 'plan' || activeSheet === 'balances') ? ({ requestClose }) => sheetFooter(requestClose) : null}>
        {sheetError && <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3.5 py-3 text-[13px] leading-5 text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{sheetError}</div>}
        {sheetBody()}
      </BottomSheet>
    </motion.main>
  )
}
