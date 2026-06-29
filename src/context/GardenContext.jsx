import { createContext, useContext, useState, useCallback } from 'react'
import { getCloudStyle } from '@/lib/gardenUtils'

const GardenContext = createContext({
  stage: 0,
  weather: {},
  goals: [],
  debts: [],
  milestones: { completedSteps: 0, totalSteps: 0, goalsReached: 0, done: 0 },
  updateGarden: () => {},
})

// The garden is a MILESTONE reward: it grows as you complete plan steps (and
// reach goals). Cumulative thresholds — small early wins feel good, and it never
// shrinks just from adding new steps.
//   0 done  → 0 barren        1 → 1 sprouting     3 → 2 greening
//   6 → 3 growing            10 → 4 thriving     15+ → 5 flourishing
export function milestonesToStage(done) {
  if (done >= 15) return 5
  if (done >= 10) return 4
  if (done >= 6)  return 3
  if (done >= 3)  return 2
  if (done >= 1)  return 1
  return 0
}

export const STAGE_NAMES = ['Barren', 'Sprouting', 'Greening', 'Growing', 'Thriving', 'Flourishing']
// The done-count at which each stage begins — used to show "N more to bloom".
export const STAGE_THRESHOLDS = [0, 1, 3, 6, 10, 15]

export function GardenProvider({ children }) {
  const [stage,      setStage]      = useState(0)
  const [goals,      setGoals]      = useState([])
  const [debts,      setDebts]      = useState([])
  const [milestones, setMilestones] = useState({ completedSteps: 0, totalSteps: 0, goalsReached: 0, done: 0 })
  const [weather,    setWeather]    = useState({
    windStrength: 0.2, hasDeficit: false, deficitSeverity: 0, surplusRatio: 0,
    cloudCount: 0, darkClouds: false, hasWindfall: false, pollenCount: 0,
    butterflyCount: 0, emergencyMonths: 0, hasRetirement: false, netWorth: 0,
    netWorthTier: 0, savingsTier: 0, investTier: 0, debtLevel: 0,
  })

  // Growth is driven by milestones; a light weather layer still reflects the
  // user's money picture (negative surplus → clouds/rain).
  const updateGarden = useCallback(({
    completedSteps = 0, totalSteps = 0, goalsReached = 0,
    surplusRatio = 0, netWorth = 0, goals: gGoals = [], debts: gDebts = [],
  } = {}) => {
    const done     = completedSteps + goalsReached
    const newStage = milestonesToStage(done)
    const cloud    = getCloudStyle(surplusRatio)
    const hasDeficit      = surplusRatio < 0
    const deficitSeverity = hasDeficit ? Math.min(Math.abs(surplusRatio), 1) : 0

    // No per-account data anymore: quadrants scale foliage uniformly with stage.
    const tier = Math.max(0, Math.min(4, newStage - 1))
    const totalDebt = gDebts.reduce((s, d) => s + Number(d.balance || 0), 0)

    setStage(newStage)
    setMilestones({ completedSteps, totalSteps, goalsReached, done })
    setGoals(gGoals)
    setDebts(gDebts)
    setWeather({
      windStrength:    hasDeficit ? Math.min(0.4 + deficitSeverity * 0.6, 1) : 0.15,
      hasDeficit, deficitSeverity, surplusRatio,
      cloudCount:      cloud.count,
      darkClouds:      cloud.dark,
      hasWindfall:     false,
      pollenCount:     Math.round((newStage / 5) * 12),
      butterflyCount:  Math.max(0, newStage - 1),
      emergencyMonths: 0,
      hasRetirement:   false,
      netWorth,
      netWorthTier:    netWorth >= 200000 ? 4 : netWorth >= 50000 ? 3 : netWorth >= 10000 ? 2 : netWorth >= 0 ? 1 : 0,
      savingsTier:     tier,
      investTier:      tier,
      debtLevel:       totalDebt > 0 ? Math.min(0.4 + (totalDebt > 20000 ? 0.4 : 0), 1) : 0,
    })
  }, [])

  return (
    <GardenContext.Provider value={{ stage, weather, goals, debts, milestones, updateGarden }}>
      {children}
    </GardenContext.Provider>
  )
}

export const useGarden = () => useContext(GardenContext)
