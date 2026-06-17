import { createContext, useContext, useState, useCallback } from 'react'
import { computeScores, getCloudStyle, hasRecentWindfall } from '@/lib/gardenUtils'

const GardenContext = createContext({
  stage: 0,
  weather: {},
  goals: [],
  debts: [],
  updateGarden: () => {},
})

// Stage curve tuned to the earned-points scoring:
//   0  (0–11)   barren brown — empty / nothing set up yet
//   1  (12–29)  sprouting    — income tracked, first signs of life
//   2  (30–49)  greening     — basics in (a goal, accounts)
//   3  (50–69)  growing      — habits forming, surplus + savings
//   4  (70–89)  thriving     — strong across the board
//   5  (90–100) flourishing  — excellent financial health
function scoreToStage(score) {
  if (score >= 90) return 5
  if (score >= 70) return 4
  if (score >= 50) return 3
  if (score >= 30) return 2
  if (score >= 12) return 1
  return 0
}

export function GardenProvider({ children }) {
  const [stage,   setStage]   = useState(0)
  const [goals,   setGoals]   = useState([])
  const [debts,   setDebts]   = useState([])
  const [weather, setWeather] = useState({
    windStrength:    0.2,
    hasDeficit:      false,
    deficitSeverity: 0,
    surplusRatio:    0,
    cloudCount:      0,
    darkClouds:      false,
    hasWindfall:     false,
    pollenCount:     0,
    butterflyCount:  0,
    emergencyMonths: 0,
    hasRetirement:   false,
    netWorth:        0,
    netWorthTier:    0,
    savingsTier:     0,
    investTier:      0,
    debtLevel:       0,
  })

  const updateGarden = useCallback((budgets = [], newGoals = [], newDebts = [], newAccounts = []) => {
    const scores = computeScores(budgets, newGoals, newDebts, newAccounts)
    const { totalScore, surplusRatio, hasDeficit, deficitSeverity, recurringIncome } = scores
    const newStage = scoreToStage(totalScore)
    const cloud    = getCloudStyle(surplusRatio)
    const windfall = hasRecentWindfall(budgets)

    // Visual richness derived from accounts
    const liquidTypes     = ['checking', 'savings', 'emergency', 'money_market']
    const retirementTypes = ['roth_ira', 'trad_ira', '401k', '403b', 'hsa', 'pension', 'brokerage']
    const liquidTotal     = newAccounts
      .filter(a => liquidTypes.includes(a.type))
      .reduce((s, a) => s + Number(a.balance), 0)
    const hasRetirement   = newAccounts.some(a => retirementTypes.includes(a.type))
    const recurringExpenses = budgets
      .filter(b => b.type === 'expense' && b.recurring !== false)
      .reduce((s, b) => s + Number(b.amount), 0)
    const emergencyMonths = recurringExpenses > 0 ? liquidTotal / recurringExpenses : 0

    // ── Net worth calculation for garden visual richness ──────────────────────
    const totalAccountValue = newAccounts.reduce((s, a) => s + Number(a.balance), 0)
    const totalDebtBalance  = newDebts.reduce((s, d) => s + Number(d.balance), 0)
    const netWorth = totalAccountValue - totalDebtBalance
    const netWorthTier =
      netWorth >= 200000 ? 4 :
      netWorth >= 50000  ? 3 :
      netWorth >= 10000  ? 2 :
      netWorth >= 0      ? 1 : 0

    // ── Per-zone growth: trees that grow with each category's total value ──────
    const investAcctTypes = ['roth_ira', 'trad_ira', '401k', '403b', 'hsa', 'pension', 'brokerage', 'crypto']
    const savingsGoalsVal = newGoals.filter(g => g.goal_type !== 'investment').reduce((s, g) => s + Number(g.current_amount), 0)
    const investGoalsVal  = newGoals.filter(g => g.goal_type === 'investment').reduce((s, g) => s + Number(g.current_amount), 0)
    const liquidAcctVal   = newAccounts.filter(a => liquidTypes.includes(a.type)).reduce((s, a) => s + Number(a.balance), 0)
    const investAcctVal   = newAccounts.filter(a => investAcctTypes.includes(a.type)).reduce((s, a) => s + Number(a.balance), 0)
    const valueTier = (v) => v >= 50000 ? 4 : v >= 15000 ? 3 : v >= 5000 ? 2 : v >= 1000 ? 1 : 0
    const savingsTier = valueTier(savingsGoalsVal + liquidAcctVal)
    const investTier  = valueTier(investGoalsVal + investAcctVal)

    // Debt quadrant: weed density (0 = clear, 1 = heavily overgrown)
    const annualIncome = recurringIncome * 12
    const debtLevel = totalDebtBalance === 0 ? 0
      : annualIncome > 0 ? Math.min(totalDebtBalance / (annualIncome * 1.5), 1)
      : 1

    setStage(newStage)
    setGoals(newGoals)
    setDebts(newDebts)
    setWeather({
      windStrength:    hasDeficit ? Math.min(0.4 + deficitSeverity * 0.6, 1) : 0.15,
      hasDeficit,
      deficitSeverity,
      surplusRatio,
      cloudCount:      cloud.count,
      darkClouds:      cloud.dark,
      hasWindfall:     windfall,
      pollenCount:     Math.round((newStage / 5) * 12),
      // Extra butterflies for having retirement savings (visual reward)
      butterflyCount:  Math.max(0, newStage - 1) + (hasRetirement ? 2 : 0),
      emergencyMonths,
      hasRetirement,
      netWorth,
      netWorthTier,
      savingsTier,
      investTier,
      debtLevel,
    })
  }, [])

  return (
    <GardenContext.Provider value={{ stage, weather, goals, debts, updateGarden }}>
      {children}
    </GardenContext.Provider>
  )
}

export const useGarden = () => useContext(GardenContext)
