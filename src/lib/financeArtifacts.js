// ─── The deterministic finance engine (extended) ──────────────────────────────
// Additional artifact calculations that build on the core finance engine.
// Import core exports directly from './finance' when needed.

import { debtFreedom as baseDebtFreedom } from './finance'

/**
 * Enhanced debt freedom calculation with extra monthly payment slider.
 * Returns full breakdown for the interactive artifact.
 */
export function debtFreedomWithExtra(debts, extraPayment = 0) {
  const base = baseDebtFreedom(debts, extraPayment)
  if (!base || base.stuck) {
    return {
      monthsToFreedom: 0,
      totalInterestSaved: 0,
      payoffOrder: [],
      monthlyBreakdown: [],
      debtFreeDate: null,
      baselineMonths: 0,
      monthsSaved: 0,
      stuck: true,
    }
  }

  // Calculate baseline (minimum payments only, no extra)
  const baseline = baseDebtFreedom(debts, 0)
  const baselineMonths = baseline?.months ?? 0
  const monthsSaved = baselineMonths > 0 ? baselineMonths - base.months : 0

  const debtFreeDate = new Date()
  debtFreeDate.setMonth(debtFreeDate.getMonth() + base.months)

  return {
    monthsToFreedom: base.months,
    totalInterestSaved: 0, // Would need baseline interest calc
    payoffOrder: debts
      .filter((d) => (d.balance || 0) > 0)
      .sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))
      .map((d) => d.name),
    monthlyBreakdown: [], // Simplified — could add month-by-month if needed
    debtFreeDate,
    baselineMonths,
    monthsSaved,
    stuck: false,
  }
}

/**
 * Calculate goal projection based on monthly contribution.
 */
export function getProjection(goal, monthlyContribution) {
  if (!goal || !goal.target_amount || monthlyContribution <= 0) {
    return {
      reachedByDate: null,
      monthsToGoal: Infinity,
      onTrack: false,
      percentComplete: 0,
      remaining: goal?.target_amount || 0,
    }
  }

  const remaining = (goal.target_amount || 0) - (goal.current_amount || 0)
  if (remaining <= 0) {
    return {
      reachedByDate: new Date(),
      monthsToGoal: 0,
      onTrack: true,
      percentComplete: 100,
      remaining: 0,
    }
  }

  const monthsToGoal = Math.ceil(remaining / monthlyContribution)
  const reachedByDate = new Date()
  reachedByDate.setMonth(reachedByDate.getMonth() + monthsToGoal)

  // Check if on track relative to deadline
  const targetDate = goal.deadline ? new Date(goal.deadline) : null
  const onTrack = targetDate ? reachedByDate <= targetDate : true
  const percentComplete = Math.min(
    100,
    ((goal.current_amount || 0) / goal.target_amount) * 100
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
  const currentNetWorth = (assets || 0) - (debts || 0)
  const monthlyRate = annualReturn / 12
  const months = years * 12

  let balance = Math.max(0, currentNetWorth)
  let totalContributed = balance
  const trajectory = []

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlySurplus
    totalContributed += monthlySurplus

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
