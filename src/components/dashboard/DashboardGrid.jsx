import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, CalendarClock, CreditCard, Gauge, Landmark, LineChart, RefreshCw,
  Sprout, Target, TrendingUp, WalletCards,
} from 'lucide-react'
import IllustratedGarden from '@/components/garden/IllustratedGarden'
import DashboardCard from './DashboardCard'
import { headlineMetrics } from '@/lib/moneyLanguage'
import { stageProgress, STAGE_NAMES } from '@/lib/gardenModel'
import { subtypeLabel } from '@/lib/moneyModel'
import { maskMoneyText } from '@/lib/privacy'

const num = value => Number(value) || 0

function money(value, hidden) {
  if (hidden) return 'Amount hidden'
  const amount = num(value)
  return `${amount < 0 ? '-' : ''}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function rate(value) {
  const rounded = Math.round(num(value) * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

function dateLabel(value) {
  if (!value) return 'Not scheduled'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysSince(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function MainValue({ children, negative = false }) {
  return <p className={`text-[25px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${negative ? 'text-rose-100' : 'text-white'}`}>{children}</p>
}

function Note({ children }) {
  return <p className="mt-2 text-[13px] leading-5 text-readable-secondary">{children}</p>
}

function Stat({ label, value, negative = false }) {
  return <div className="min-w-0"><p className="text-xs text-readable-secondary">{label}</p><p className={`mt-1 truncate text-[14px] font-semibold tabular-nums ${negative ? 'text-rose-100' : 'text-white'}`}>{value}</p></div>
}

function Sparkline({ history = [], hidden }) {
  const points = history.map(item => num(item.net_worth)).filter(Number.isFinite)
  if (points.length < 2) return <p className="text-xs text-readable-muted">Your trend begins after another daily snapshot.</p>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(1, max - min)
  const path = points.map((value, index) => {
    const x = points.length === 1 ? 0 : index / (points.length - 1) * 100
    const y = 36 - ((value - min) / range * 30)
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const delta = points[points.length - 1] - points[0]
  return <div>
    <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label={`Net worth trend is ${delta >= 0 ? 'up' : 'down'} over the available history`}>
      <path d={path} fill="none" stroke={delta >= 0 ? '#6ee7b7' : '#fecdd3'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
    <p className="sr-only">{hidden ? 'Exact values hidden.' : `Available history ranges from ${money(min, false)} to ${money(max, false)}.`}</p>
  </div>
}

function GardenWidget({ size, data, actions }) {
  const progress = stageProgress(data.milestoneTotal)
  if (size === 'expanded') return <IllustratedGarden
    stage={data.stage} milestones={data.milestones} milestoneTotal={data.milestoneTotal}
    goals={data.goals} momentum={data.momentum} sceneTone={data.sceneTone}
    reducedMotion={data.reducedMotion} compact onOpenStory={actions.openGarden}
    onSelectGoal={actions.openGoal} onSelectOverflow={actions.openGarden}
  />
  return <DashboardCard title="Garden progress" icon={Sprout} actionLabel="Garden Story" onAction={actions.openGarden} tone="emerald">
    <div className="flex items-end justify-between gap-2"><MainValue>{STAGE_NAMES[data.stage]}</MainValue><span className="text-xs font-semibold text-emerald-100">{data.milestoneTotal} milestones</span></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${progress.percent}%` }} /></div>
    <Note>{progress.nextThreshold == null ? 'Sanctuary complete' : `${progress.remaining} more to ${STAGE_NAMES[data.stage + 1]}`}</Note>
  </DashboardCard>
}

function NetWorthWidget({ size, data, actions, hidden }) {
  const trend = data.trend || {}
  if (!data.accounts.length && !data.debts.length) return <DashboardCard title="Net worth" icon={Gauge} actionLabel="Add balances" onAction={() => actions.openMoney()}>
    <MainValue>Setup needed</MainValue><Note>Add account and debt balances to calculate net worth.</Note>
  </DashboardCard>
  return <DashboardCard title="Net worth" icon={Gauge} actionLabel="Open Money" onAction={() => actions.openMoney()}>
    <MainValue negative={num(data.snapshot.netWorth) < 0}>{money(data.snapshot.netWorth, hidden)}</MainValue>
    <Note>{trend.has ? `${trend.delta >= 0 ? 'Up' : 'Down'} ${money(Math.abs(trend.delta), hidden)} over ${trend.days} days` : '30-day change starts after your next snapshot'}</Note>
    {data.netWorthNote && <p className="mt-2 text-xs leading-5 text-readable-muted">{data.netWorthNote}</p>}
    {size === 'expanded' && <div className="mt-3 border-t border-white/[0.07] pt-3">
      <Sparkline history={trend.history || []} hidden={hidden} />
      <div className="mt-2 grid grid-cols-2 gap-3"><Stat label="Assets" value={money(data.snapshot.assets, hidden)} /><Stat label="Liabilities" value={money(data.snapshot.totalDebt, hidden)} negative={num(data.snapshot.totalDebt) > 0} /></div>
    </div>}
  </DashboardCard>
}

function MonthlyPlanWidget({ size, data, actions, hidden }) {
  const snapshot = data.snapshot
  const hasTotals = data.cashFlowItems.length > 0 || num(data.profile?.monthly_income) > 0 || num(data.profile?.monthly_expenses) > 0
  if (!hasTotals) return <DashboardCard title="Monthly plan" icon={WalletCards} actionLabel="Set up monthly plan" onAction={() => actions.openSheet('plan')}>
    <MainValue>Setup needed</MainValue><Note>Add typical income and spending to calculate what is left.</Note>
  </DashboardCard>
  const total = Math.max(1, num(snapshot.income))
  const segments = [
    { key: 'needs', value: num(snapshot.needs), color: 'bg-emerald-400' },
    { key: 'wants', value: num(snapshot.wants), color: 'bg-sky-300' },
    { key: 'future', value: num(snapshot.futureAllocations), color: 'bg-amber-300' },
  ]
  return <DashboardCard title="Monthly plan" icon={WalletCards} actionLabel="Open monthly plan" onAction={() => actions.openSheet('plan')}>
    <MainValue negative={num(snapshot.cashFlowMargin) < 0}>{money(snapshot.cashFlowMargin, hidden)}</MainValue>
    <Note>{size === 'expanded' ? `Typical monthly amount left after spending · ${money(snapshot.unallocated, hidden)} left to assign` : `${money(snapshot.unallocated, hidden)} left to assign`}</Note>
    {size === 'expanded' && data.cashFlowItems.length > 0 && <div className="mt-4 border-t border-white/[0.07] pt-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.07]" aria-label="Typical monthly plan allocation">
        {segments.map(item => <span key={item.key} className={item.color} style={{ width: `${Math.min(100, item.value / total * 100)}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Income" value={money(snapshot.income, hidden)} /><Stat label="Needs" value={money(snapshot.needs, hidden)} /><Stat label="Wants" value={money(snapshot.wants, hidden)} /><Stat label="Future" value={money(snapshot.futureAllocations, hidden)} /></div>
    </div>}
    {size === 'expanded' && data.cashFlowItems.length === 0 && <p className="mt-4 border-t border-white/[0.07] pt-3 text-[13px] leading-5 text-readable-secondary">Break your current total into categories to see needs, wants, and future allocations.</p>}
  </DashboardCard>
}

function CashWidget({ size, data, actions, hidden }) {
  const snapshot = data.snapshot
  if (!snapshot.cashAccounts?.length) return <DashboardCard title="Cash and emergency fund" icon={Landmark} actionLabel="Add a cash account" onAction={() => actions.openSheet('cash')}>
    <MainValue>Nothing tracked</MainValue><Note>Add checking or savings to calculate your runway.</Note>
  </DashboardCard>
  return <DashboardCard title="Cash and emergency fund" icon={Landmark} actionLabel="Open cash accounts" onAction={() => actions.openSheet('cash')}>
    <MainValue>{money(snapshot.liquid, hidden)}</MainValue>
    <Note>{num(snapshot.expenses) > 0 ? `${num(snapshot.efMonths).toFixed(1)} of ${num(snapshot.efTargetMonths)} months available` : 'Add typical spending to calculate your runway'}</Note>
    {size === 'expanded' && <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3"><Stat label="Emergency target" value={money(snapshot.efTargetAmount, hidden)} /><Stat label="Average APY" value={data.accounts.some(item => num(item.interest_rate) > 0) ? rate(snapshot.weightedCashApy) : 'Rate missing'} /><Stat label="Estimated interest" value={num(snapshot.annualCashInterest) > 0 ? `${money(snapshot.annualCashInterest, hidden)}/yr` : 'Not available'} /><Stat label="Cash accounts" value={`${snapshot.cashAccounts?.length || 0}`} /></div>}
  </DashboardCard>
}

function DebtWidget({ size, data, actions, hidden }) {
  const snapshot = data.snapshot
  const active = data.debts.filter(item => num(item.balance) > 0)
  const rated = active.filter(item => item.interest_rate !== null && item.interest_rate !== undefined && item.interest_rate !== '')
  const minimumsKnown = active.every(item => item.minimum_payment !== null && item.minimum_payment !== undefined && item.minimum_payment !== '')
  return <DashboardCard title="Debt" icon={CreditCard} actionLabel={active.length ? 'Open debts' : 'Add debt'} onAction={() => actions.openSheet('debts')} tone={num(snapshot.debtMonthlyInterest) > 0 ? 'amber' : 'neutral'}>
    <MainValue negative={num(snapshot.totalDebt) > 0}>{active.length ? money(snapshot.totalDebt, hidden) : 'Nothing tracked'}</MainValue>
    <Note>{active.length ? rated.length ? `${money(snapshot.debtMonthlyInterest, hidden)}/mo estimated interest` : 'Add rates to estimate monthly interest.' : 'Add balances and rates to understand their cost.'}</Note>
    {size === 'expanded' && active.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3"><Stat label="Average APR" value={rated.length ? rate(snapshot.weightedDebtApr) : 'Rate missing'} /><Stat label="Required payments" value={minimumsKnown ? money(snapshot.requiredDebtPayments, hidden) : 'Payment missing'} /><Stat label="Planned payments" value={minimumsKnown ? money(snapshot.plannedDebtPayments, hidden) : 'Payment missing'} /><Stat label="Card utilization" value={active.some(item => item.type === 'credit_card') ? snapshot.cardUtilization == null ? 'Limit missing' : `${Math.round(snapshot.cardUtilization * 100)}%` : 'No cards tracked'} />{snapshot.debtFree && !snapshot.debtFree.stuck && minimumsKnown && <div className="col-span-2"><Stat label="At planned payments" value={`About ${snapshot.debtFree.months} months to debt-free`} /></div>}</div>}
  </DashboardCard>
}

function InvestmentWidget({ size, data, actions, hidden }) {
  const accounts = data.snapshot.investmentAccounts || []
  const ytd = accounts.reduce((sum, item) => sum + num(item.ytd_contribution), 0)
  const types = [...new Set(accounts.map(subtypeLabel))].slice(0, 3)
  return <DashboardCard title="Investments" icon={LineChart} actionLabel={accounts.length ? 'Open investments' : 'Add an account'} onAction={() => actions.openSheet('investment')}>
    <MainValue>{accounts.length ? money(data.snapshot.invested, hidden) : 'Nothing tracked'}</MainValue>
    <Note>{accounts.length ? num(data.snapshot.investmentMonthlyContributions) > 0 ? `${money(data.snapshot.investmentMonthlyContributions, hidden)}/mo in recorded contributions` : 'No monthly contribution recorded.' : size === 'expanded' ? 'Track retirement and brokerage accounts without entering holdings.' : 'Add retirement or brokerage totals.'}</Note>
    {size === 'expanded' && accounts.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3"><Stat label="Account types" value={types.join(' · ') || 'Subtype missing'} /><Stat label="Year to date" value={ytd > 0 ? money(ytd, hidden) : 'Not recorded'} /><div className="col-span-2"><p className="text-xs text-readable-muted">Balances and contributions only—not market performance.</p></div></div>}
  </DashboardCard>
}

function goalPercent(goal) {
  return Math.min(100, Math.round(num(goal.current_amount) / Math.max(1, num(goal.target_amount)) * 100))
}

function GoalsWidget({ widget, size, data, actions, hidden }) {
  const active = data.goals.filter(goal => num(goal.target_amount) > num(goal.current_amount))
  const selected = active.find(goal => String(goal.id) === String(widget.settings?.goalId)) || active[0]
  const visible = size === 'expanded' ? (selected ? [selected, ...active.filter(item => item.id !== selected.id)].slice(0, 3) : []) : selected ? [selected] : []
  return <DashboardCard title="Goals" icon={Target} actionLabel={selected ? 'Open goals' : 'Add a goal'} onAction={() => actions.openGoal(selected)}>
    {visible.length ? <div className="space-y-3">{visible.map(goal => <div key={goal.id}>
      <div className="flex items-baseline justify-between gap-2"><p className="min-w-0 truncate text-[14px] font-semibold text-white">{goal.name}</p><span className="shrink-0 text-xs font-semibold text-emerald-100">{goalPercent(goal)}%</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${goalPercent(goal)}%` }} /></div>
      <p className="mt-1 text-xs text-readable-secondary">{money(Math.max(0, num(goal.target_amount) - num(goal.current_amount)), hidden)} remaining{goal.deadline ? ` · ${dateLabel(goal.deadline)}` : ''}</p>
    </div>)}</div> : <><MainValue>No active goal</MainValue><Note>Create a savings, purchase, or investment goal to track it here.</Note></>}
  </DashboardCard>
}

function WatchlistWidget({ widget, size, data, actions, hidden }) {
  const selected = (widget.settings?.accountIds || []).map(id => data.accounts.find(item => String(item.id) === String(id))).filter(Boolean)
  const rows = selected.length ? selected : data.accounts.slice(0, size === 'expanded' ? 3 : 1)
  return <DashboardCard title="Account watchlist" icon={WalletCards} actionLabel={rows.length ? 'Manage accounts' : 'Add accounts'} onAction={() => actions.openSheet('accounts')}>
    {rows.length ? <div className="divide-y divide-white/[0.07]">{rows.slice(0, size === 'expanded' ? 3 : 1).map(account => {
      const age = daysSince(account.last_synced_at || account.last_verified_at)
      const freshness = age == null ? 'Not verified' : age === 0 ? 'Fresh today' : `${age}d old`
      const stale = age == null || age >= 90
      return <button key={account.id} type="button" onClick={() => actions.openAccount(account.id)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70">
        <span className="min-w-0"><span className="block truncate text-[14px] font-semibold text-white">{account.name}</span><span className="mt-0.5 block truncate text-xs text-readable-secondary">{[account.institution, subtypeLabel(account)].filter(Boolean).join(' · ')}</span></span>
        <span className="shrink-0 text-right"><span className="block text-[14px] font-semibold tabular-nums text-white">{money(account.balance, hidden)}</span><span className={`mt-0.5 block text-[11px] font-semibold ${stale ? 'text-amber-100' : 'text-readable-muted'}`}>{freshness}</span></span>
      </button>
    })}</div> : <><MainValue>No accounts</MainValue><Note>Choose up to three balances to keep close.</Note></>}
  </DashboardCard>
}

function metricValue(id, data, hidden) {
  const snapshot = data.snapshot
  const headline = Object.fromEntries(headlineMetrics(snapshot).map(item => [item.id, item]))
  const hasPlan = data.cashFlowItems.length > 0 || num(data.profile?.monthly_income) > 0 || num(data.profile?.monthly_expenses) > 0
  const activeDebts = data.debts.filter(item => num(item.balance) > 0)
  const ratedDebts = activeDebts.filter(item => item.interest_rate !== null && item.interest_rate !== undefined && item.interest_rate !== '')
  const cards = activeDebts.filter(item => item.type === 'credit_card')
  const investments = snapshot.investmentAccounts || []
  const values = {
    margin: { label: 'Left over monthly', value: hasPlan ? money(snapshot.cashFlowMargin, hidden) : 'Plan needed', negative: hasPlan && num(snapshot.cashFlowMargin) < 0 },
    unallocated: { label: 'Left to assign', value: hasPlan ? money(snapshot.unallocated, hidden) : 'Plan needed', negative: hasPlan && num(snapshot.unallocated) < 0 },
    emergency: { label: 'Emergency runway', value: num(snapshot.expenses) > 0 ? `${num(snapshot.efMonths).toFixed(1)} mo` : 'Spending needed' },
    'cash-apy': { label: 'Average cash APY', value: data.accounts.some(item => num(item.interest_rate) > 0) ? rate(snapshot.weightedCashApy) : 'Rate missing' },
    'debt-interest': { label: 'Debt interest', value: !activeDebts.length ? 'No debt tracked' : ratedDebts.length ? `${money(snapshot.debtMonthlyInterest, hidden)}/mo` : 'Rate missing', negative: num(snapshot.debtMonthlyInterest) > 0 },
    'debt-apr': { label: 'Average debt APR', value: !activeDebts.length ? 'No debt tracked' : ratedDebts.length ? rate(snapshot.weightedDebtApr) : 'Rate missing' },
    utilization: { label: 'Card utilization', value: !cards.length ? 'No cards tracked' : snapshot.cardUtilization == null ? 'Limit missing' : `${Math.round(snapshot.cardUtilization * 100)}%` },
    'investment-contributions': { label: 'Investment contributions', value: !investments.length ? 'No accounts' : num(snapshot.investmentMonthlyContributions) > 0 ? `${money(snapshot.investmentMonthlyContributions, hidden)}/mo` : 'Not recorded' },
  }
  return values[id] || { label: headline.margin?.label || 'Monthly margin', value: headline.margin?.value || money(0, hidden) }
}

function QuickMetricsWidget({ widget, size, data, actions, hidden }) {
  const ids = (widget.settings?.metrics || ['margin']).slice(0, size === 'expanded' ? 3 : 1)
  return <DashboardCard title="Quick metrics" icon={TrendingUp} actionLabel="Open Money" onAction={() => actions.openMoney()}>
    <div className={`grid gap-3 ${ids.length > 1 ? 'sm:grid-cols-3' : ''}`}>{ids.map(id => { const metric = metricValue(id, data, hidden); return <Stat key={id} label={metric.label} value={metric.value} negative={metric.negative} /> })}</div>
  </DashboardCard>
}

function RoutinesWidget({ size, data, actions }) {
  if (data.errors?.reminders) return <DashboardCard title="Routines" icon={CalendarClock} actionLabel="Retry" onAction={actions.retryHomeData}><MainValue>Unavailable</MainValue><Note>{data.errors.reminders}</Note></DashboardCard>
  const active = data.reminders.filter(item => item.status === 'active')
  const due = data.reminderModel?.due || []
  const visible = active.slice(0, size === 'expanded' ? 3 : 1)
  const duplicated = data.primaryAction?.kind === 'reminder'
  return <DashboardCard title="Routines" icon={CalendarClock} actionLabel="Manage routines" onAction={() => actions.openRoutines(due[0]?.id)}>
    <MainValue>{due.length ? `${due.length} due` : active.length ? 'All caught up' : 'None active'}</MainValue>
    <Note>{duplicated ? 'Today already has your highest-priority check-in.' : visible[0] ? `Next: ${visible[0].title} · ${dateLabel(visible[0].snoozed_until || visible[0].next_due_on)}` : 'Add a weekly or quarterly financial check-in.'}</Note>
    {size === 'expanded' && !duplicated && visible.length > 1 && <div className="mt-3 divide-y divide-white/[0.07] border-t border-white/[0.07] pt-2">{visible.slice(1).map(item => <div key={item.id} className="flex justify-between gap-3 py-2 text-xs"><span className="truncate text-readable-secondary">{item.title}</span><span className="shrink-0 text-white">{dateLabel(item.next_due_on)}</span></div>)}</div>}
  </DashboardCard>
}

function RecentWidget({ size, data, actions, hidden }) {
  if (data.errors?.activities) return <DashboardCard title="Recent progress" icon={Activity} actionLabel="Retry" onAction={actions.retryHomeData}><MainValue>Unavailable</MainValue><Note>{data.errors.activities}</Note></DashboardCard>
  const items = [
    ...data.activities.map(item => ({ id: `a:${item.id}`, label: item.label, date: item.occurred_at || item.created_at, amount: item.amount })),
    ...data.milestones.map(item => ({ id: `m:${item.id || item.source_key}`, label: item.label, date: item.earned_at })),
  ].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, size === 'expanded' ? 3 : 1)
  return <DashboardCard title="Recent progress" icon={Activity} actionLabel="See recent progress" onAction={actions.openProgress}>
    {items.length ? <div className="divide-y divide-white/[0.07]">{items.map(item => <div key={item.id} className="py-2 first:pt-0"><p className="truncate text-[14px] font-semibold text-white">{maskMoneyText(item.label, hidden)}</p><p className="mt-0.5 text-xs text-readable-secondary">{dateLabel(item.date)}{num(item.amount) > 0 ? ` · ${money(item.amount, hidden)}` : ''}</p></div>)}</div> : <><MainValue>Nothing yet</MainValue><Note>Completed Plan steps and approved updates will appear here.</Note></>}
  </DashboardCard>
}

function FreshnessWidget({ size, data, actions }) {
  const rows = [...data.accounts, ...data.debts].map(item => ({ ...item, age: daysSince(item.last_synced_at || item.last_verified_at) }))
  const stale = rows.filter(item => item.age == null || item.age >= 90)
  const oldest = [...rows].sort((left, right) => (right.age ?? Infinity) - (left.age ?? Infinity)).slice(0, size === 'expanded' ? 3 : 1)
  return <DashboardCard title="Data freshness" icon={RefreshCw} actionLabel={rows.length ? 'Update balances' : 'Add accounts'} onAction={() => actions.openSheet(rows.length ? 'balances' : 'accounts')} tone={stale.length ? 'amber' : 'neutral'}>
    <MainValue>{rows.length ? stale.length ? `${stale.length} to refresh` : 'Up to date' : 'No records'}</MainValue>
    <Note>{rows.length ? stale.length ? 'Balances older than 90 days can weaken your next recommendation.' : 'Your tracked balances are current.' : 'Add an account or debt to begin tracking freshness.'}</Note>
    {size === 'expanded' && oldest.length > 0 && <div className="mt-3 divide-y divide-white/[0.07] border-t border-white/[0.07] pt-2">{oldest.map(item => <div key={item.id} className="flex justify-between gap-3 py-2 text-xs"><span className="truncate text-readable-secondary">{item.name}</span><span className="shrink-0 text-white">{item.age == null ? 'Not verified' : item.age === 0 ? 'Today' : `${item.age}d ago`}</span></div>)}</div>}
  </DashboardCard>
}

function WidgetRenderer({ widget, data, actions, hidden }) {
  const props = { widget, size: widget.size, data, actions, hidden }
  if (widget.id === 'garden') return <GardenWidget {...props} />
  if (widget.id === 'net-worth') return <NetWorthWidget {...props} />
  if (widget.id === 'monthly-plan') return <MonthlyPlanWidget {...props} />
  if (widget.id === 'cash-emergency') return <CashWidget {...props} />
  if (widget.id === 'debt') return <DebtWidget {...props} />
  if (widget.id === 'investments') return <InvestmentWidget {...props} />
  if (widget.id === 'goals') return <GoalsWidget {...props} />
  if (widget.id === 'account-watchlist') return <WatchlistWidget {...props} />
  if (widget.id === 'quick-metrics') return <QuickMetricsWidget {...props} />
  if (widget.id === 'routines') return <RoutinesWidget {...props} />
  if (widget.id === 'recent-progress') return <RecentWidget {...props} />
  if (widget.id === 'freshness') return <FreshnessWidget {...props} />
  return null
}

function DeferredWidget({ defer, children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(!defer)
  useEffect(() => {
    if (!defer || visible) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { rootMargin: '240px 0px' })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [defer, visible])
  return <div ref={ref} className="h-full">{visible ? children : <div className="h-36 animate-pulse rounded-[22px] border border-white/[0.07] bg-white/[0.025]" aria-label="Dashboard card loading" />}</div>
}

export default function DashboardGrid({ layout, data, actions, hideAmounts = false }) {
  const widgets = useMemo(() => layout?.widgets || [], [layout?.widgets])
  if (!widgets.length) return <section className="rounded-[22px] border border-dashed border-white/[0.12] bg-white/[0.025] p-5 text-center"><p className="text-[15px] font-semibold text-white">Your dashboard is clear.</p><p className="mt-1 text-[13px] text-readable-secondary">Use Customize Home to add the information you want close by.</p></section>
  return <section aria-label="Your dashboard" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-6">
    {widgets.map((widget, index) => <div key={widget.id} className={widget.size === 'expanded' ? 'min-w-0 min-[360px]:col-span-2 lg:col-span-3' : 'min-w-0 min-[360px]:col-span-1 lg:col-span-2'}>
      <DeferredWidget defer={widget.size === 'expanded' && index > 1}>
        <WidgetRenderer widget={widget} data={data} actions={actions} hidden={hideAmounts} />
      </DeferredWidget>
    </div>)}
  </section>
}
