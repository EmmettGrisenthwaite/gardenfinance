// ─── The deterministic finance engine (extended) ──────────────────────────────
// Additional artifact calculations that build on the core finance engine.
// Import core exports directly from './finance' when needed.

import { debtFreedom as baseDebtFreedom, THRESHOLDS } from './finance.js'

/**
 * Debt freedom calculation for a chosen total monthly payment.
 * Minimum payments are not stored by the app, so this deliberately avoids
 * claiming a comparison against "minimum payments" that cannot be calculated.
 */
export function debtFreedomWithExtra(debts, monthlyPayment = 0) {
  const base = baseDebtFreedom(debts, monthlyPayment)
  if (!base || base.stuck) {
    return {
      monthsToFreedom: 0,
      totalInterest: 0,
      payoffOrder: [],
      debtFreeDate: null,
      stuck: true,
    }
  }

  const debtFreeDate = new Date()
  debtFreeDate.setMonth(debtFreeDate.getMonth() + base.months)

  return {
    monthsToFreedom: base.months,
    totalInterest: base.totalInterest,
    payoffOrder: debts
      .filter((d) => Number(d.balance || 0) > 0)
      .sort((a, b) => Number(b.interest_rate || 0) - Number(a.interest_rate || 0))
      .map((d) => d.name),
    debtFreeDate,
    stuck: false,
  }
}

/**
 * Calculate goal projection based on monthly contribution.
 */
export function getProjection(goal, monthlyContribution) {
  if (!goal || !goal.target_amount) {
    return {
      reachedByDate: null,
      monthsToGoal: Infinity,
      onTrack: false,
      percentComplete: 0,
      remaining: goal?.target_amount || 0,
    }
  }

  const target = Number(goal.target_amount) || 0
  const current = Number(goal.current_amount) || 0
  const monthly = Number(monthlyContribution) || 0
  const remaining = target - current
  if (remaining <= 0) {
    return {
      reachedByDate: new Date(),
      monthsToGoal: 0,
      onTrack: true,
      percentComplete: 100,
      remaining: 0,
    }
  }
  if (monthly <= 0) {
    return {
      reachedByDate: null,
      monthsToGoal: Infinity,
      onTrack: false,
      percentComplete: Math.min(100, Math.max(0, (current / target) * 100)),
      remaining,
    }
  }

  let monthsToGoal
  if (goal.goal_type === 'investment') {
    const monthlyRate = THRESHOLDS.investReturn / 12
    let balance = current
    monthsToGoal = 0
    while (balance < target && monthsToGoal < 1200) {
      balance = balance * (1 + monthlyRate) + monthly
      monthsToGoal++
    }
  } else {
    monthsToGoal = Math.ceil(remaining / monthly)
  }
  const reachedByDate = new Date()
  reachedByDate.setMonth(reachedByDate.getMonth() + monthsToGoal)

  // Check if on track relative to deadline
  const targetDate = goal.deadline ? new Date(goal.deadline) : null
  const onTrack = targetDate ? reachedByDate <= targetDate : true
  const percentComplete = Math.min(
    100,
    (current / target) * 100
  )

  return {
    reachedByDate,
    monthsToGoal,
    onTrack,
    percentComplete,
    remaining,
  }
}

/**
 * Net worth trajectory projection with compounding.
 */
export function netWorthTrajectory(assets, debts, monthlySurplus, years = 10, annualReturn = 0.07) {
  const currentNetWorth = (Number(assets) || 0) - (Number(debts) || 0)
  const monthlyRate = annualReturn / 12
  const months = years * 12

  let balance = currentNetWorth
  let totalContributed = balance
  const trajectory = []

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + (Number(monthlySurplus) || 0)
    totalContributed += Number(monthlySurplus) || 0

    if (m % 12 === 0) {
      const year = m / 12
      trajectory.push({
        year,
        netWorth: Math.round(balance),
        totalContributed: Math.round(totalContributed),
        totalInterest: Math.round(balance - totalContributed),
      })
    }
  }

  return {
    currentNetWorth,
    year1: trajectory[0] || null,
    year5: trajectory[4] || null,
    year10: trajectory[9] || null,
    trajectory,
  }
}

/**
 * Format a date as "Month Year" (e.g., "March 2028").
 */
export function formatDateLabel(date) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Format months as "X years Y months".
 */
export function formatMonths(months) {
  if (!isFinite(months) || months <= 0) return '0 months'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const y = Math.floor(months / 12)
  const m = months % 12
  if (m === 0) return `${y} year${y === 1 ? '' : 's'}`
  return `${y} year${y === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'}`
}
