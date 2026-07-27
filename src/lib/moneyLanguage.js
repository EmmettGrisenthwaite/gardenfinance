// One vocabulary for money numbers.
//
// Two rules, both aimed at reducing confusion:
//  1. A number has ONE name. Home and Money previously called the same figure
//     "Monthly margin" and "Cash-flow margin" — same value, two names, so it
//     read as two different facts.
//  2. A zero says "nothing yet", never a meaningless statistic. "0.00% weighted
//     APY" on accounts with no recorded rate looks like a terrible rate rather
//     than missing data.
//
// Language is deliberately plain: this app is for people learning money, so
// "average rate" beats "weighted APR" and duplicated subtitles are dropped
// rather than padded.

import { subtypeLabel } from './moneyModel.js'

const num = value => Number(value) || 0

export function formatMoney(value) {
  const amount = num(value)
  return `${amount < 0 ? '-' : ''}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

// Trailing zeros read as false precision on a rate: 4% not 4.00%, 3.8% not 3.80%.
function formatRate(value) {
  const rate = num(value)
  const rounded = Math.round(rate * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

function plural(count, singular, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`
}

// ── Headline metrics ─────────────────────────────────────────────────────────
// The four numbers that describe the month. Home shows a subset; Money shows
// them all. Both read from here so the names can never drift apart again.
export function headlineMetrics(snapshot = {}) {
  const margin = num(snapshot.cashFlowMargin)
  const income = num(snapshot.income)
  const efMonths = num(snapshot.efMonths)
  const efTarget = num(snapshot.efTargetMonths)
  const debtInterest = num(snapshot.debtMonthlyInterest)
  const activeDebts = (snapshot.debts || []).filter(debt => num(debt.balance) > 0)
  const unallocated = num(snapshot.unallocated)
  const allocated = num(snapshot.futureAllocations)

  return [
    {
      id: 'margin',
      label: 'Left over monthly',
      value: formatMoney(margin),
      // The percentage only means something once income is known.
      note: income > 0
        ? `${Math.round(num(snapshot.savingsRate) * 100)}% of your income`
        : 'Add your income to see this as a share',
      negative: margin < 0,
    },
    {
      id: 'emergency',
      label: 'Emergency fund',
      // "0.6 of 3 months" answers "is that good?" in the value itself, which
      // a bare "0.6 mo" never did.
      value: efTarget > 0 ? `${efMonths.toFixed(1)} of ${efTarget} mo` : `${efMonths.toFixed(1)} mo`,
      note: num(snapshot.expenses) > 0
        ? `${formatMoney(snapshot.liquid)} saved of ${formatMoney(snapshot.efTargetAmount)}`
        : 'Add your spending to set a target',
      negative: false,
    },
    {
      id: 'debtInterest',
      label: 'Debt interest',
      value: debtInterest > 0 ? `${formatMoney(debtInterest)}/mo` : '$0',
      note: debtInterestNote(snapshot, activeDebts),
      negative: debtInterest > 0,
    },
    {
      id: 'unallocated',
      label: 'Left to assign',
      value: formatMoney(unallocated),
      note: allocated > 0
        ? `${formatMoney(allocated)} already assigned`
        : 'Nothing assigned to goals yet',
      negative: unallocated < 0,
    },
  ]
}

function debtInterestNote(snapshot, activeDebts) {
  if (!activeDebts.length) return 'No debt tracked'
  // "Weighted APR" across a single debt is just that debt's rate — name it.
  if (activeDebts.length === 1) {
    const debt = activeDebts[0]
    const rate = num(debt.interest_rate)
    return rate > 0 ? `${formatRate(rate)} APR on ${debt.name || 'your debt'}` : `No rate recorded for ${debt.name || 'this debt'}`
  }
  const rated = activeDebts.filter(debt => num(debt.interest_rate) > 0)
  if (!rated.length) return `${plural(activeDebts.length, 'debt')} · no rates recorded`
  return `${formatRate(snapshot.weightedDebtApr)} average across ${plural(activeDebts.length, 'debt')}`
}

// ── "Your money" section cards ───────────────────────────────────────────────
// Each card gets a meta line (what's inside) and an optional detail line. The
// detail is omitted entirely when it would restate the title or report a zero.
export function moneySections({
  snapshot = {},
  accountGroups = {},
  cashFlowItems = [],
  activeDebts = [],
  assetTotal = 0,
} = {}) {
  const cash = accountGroups.cash || []
  const investment = accountGroups.investment || []
  const asset = accountGroups.asset || []
  const cashTotal = cash.reduce((sum, account) => sum + num(account.balance), 0)
  const planOutflow = num(snapshot.expenses) + num(snapshot.futureAllocations)

  return [
    {
      id: 'plan',
      sheet: 'plan',
      title: 'Monthly plan',
      total: `${formatMoney(planOutflow)}/mo`,
      meta: cashFlowItems.length
        ? `${formatMoney(snapshot.income)} in · ${formatMoney(planOutflow)} planned out`
        : 'Set up your income and spending',
      detail: cashFlowItems.length ? `${plural(cashFlowItems.length, 'category', 'categories')} tracked` : null,
    },
    {
      id: 'cash',
      sheet: 'cash',
      title: 'Cash accounts',
      total: formatMoney(cashTotal),
      meta: cash.length ? plural(cash.length, 'account') : 'No accounts added yet',
      detail: cashYieldDetail(snapshot, cash),
    },
    {
      id: 'investment',
      sheet: 'investment',
      title: 'Investments',
      total: formatMoney(snapshot.invested),
      meta: investment.length ? plural(investment.length, 'account') : 'No accounts added yet',
      detail: num(snapshot.investmentMonthlyContributions) > 0
        ? `${formatMoney(snapshot.investmentMonthlyContributions)}/mo going in`
        : null,
    },
    {
      id: 'asset',
      sheet: 'asset',
      title: 'Property and other assets',
      total: formatMoney(assetTotal),
      // Previously the detail repeated the title word-for-word when empty.
      meta: asset.length ? plural(asset.length, 'asset') : 'Nothing added yet',
      detail: asset.length ? asset.map(account => subtypeLabel(account)).join(' · ') : null,
    },
    {
      id: 'debts',
      sheet: 'debts',
      title: 'Debts',
      total: formatMoney(snapshot.totalDebt),
      meta: activeDebts.length ? `${plural(activeDebts.length, 'debt')} · ${debtRateSummary(snapshot, activeDebts)}` : 'No debt tracked',
      detail: debtDetail(snapshot, activeDebts),
      wide: true,
    },
  ]
}

function cashYieldDetail(snapshot, cash) {
  if (!cash.length) return null
  const withRate = cash.filter(account => num(account.interest_rate) > 0)
  // No recorded rate is missing data, not a 0% rate — say so, and make it a
  // nudge to fill it in rather than a scary statistic. Kept short: this line
  // truncates on a 320px card.
  if (!withRate.length) return 'Add your rate'
  const yearly = num(snapshot.annualCashInterest)
  const rateLabel = withRate.length === 1
    ? `${formatRate(withRate[0].interest_rate)} APY`
    : `${formatRate(snapshot.weightedCashApy)} average APY`
  return yearly >= 1 ? `${rateLabel} · about ${formatMoney(yearly)}/yr` : rateLabel
}

function debtRateSummary(snapshot, activeDebts) {
  const rated = activeDebts.filter(debt => num(debt.interest_rate) > 0)
  if (!rated.length) return 'no rates recorded'
  if (activeDebts.length === 1) return `${formatRate(activeDebts[0].interest_rate)} APR`
  return `${formatRate(snapshot.weightedDebtApr)} average APR`
}

function debtDetail(snapshot, activeDebts) {
  if (!activeDebts.length) return null
  if (snapshot.cardUtilization != null) {
    return `${Math.round(num(snapshot.cardUtilization) * 100)}% of your credit limit used`
  }
  const required = num(snapshot.requiredDebtPayments)
  return required > 0 ? `${formatMoney(required)}/mo minimum payments` : null
}
