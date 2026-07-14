import { createContext, useContext, useState, useCallback } from 'react'
import {
  STAGE_NAMES,
  STAGE_THRESHOLDS,
  gardenMomentum,
  milestonesToStage,
  sceneToneFromCashFlow,
} from '@/lib/gardenModel'

const GardenContext = createContext({
  stage: 0,
  milestones: [],
  milestoneTotal: 0,
  goals: [],
  momentum: 'resting',
  sceneTone: 'calm',
  burstAt: null,
  updateGarden: () => {},
  triggerBurst: () => {},
})

export { milestonesToStage, STAGE_NAMES, STAGE_THRESHOLDS }

export function GardenProvider({ children }) {
  const [stage, setStage] = useState(0)
  const [milestones, setMilestones] = useState([])
  const [milestoneTotal, setMilestoneTotal] = useState(0)
  const [goals, setGoals] = useState([])
  const [momentum, setMomentum] = useState('resting')
  const [sceneTone, setSceneTone] = useState('calm')
  const [burstAt, setBurstAt] = useState(null)

  const triggerBurst = useCallback(() => setBurstAt(Date.now()), [])

  const updateGarden = useCallback(({
    milestones: nextMilestones,
    milestoneTotal: nextTotal,
    goals: nextGoals = [],
    income = 0,
    expenses = 0,
  } = {}) => {
    const hasMilestones = Array.isArray(nextMilestones)
    const hasExplicitTotal = nextTotal !== null && nextTotal !== undefined && nextTotal !== ''
    const total = hasExplicitTotal
      ? Math.max(0, Number(nextTotal) || 0)
      : hasMilestones ? nextMilestones.length : 0

    if (hasMilestones) setMilestones(nextMilestones)
    setMilestoneTotal(total)
    setStage(milestonesToStage(total))
    setGoals(nextGoals)
    setMomentum(gardenMomentum({ milestones: hasMilestones ? nextMilestones : [], goals: nextGoals }))
    setSceneTone(sceneToneFromCashFlow(income, expenses))
  }, [])

  return (
    <GardenContext.Provider value={{
      stage,
      milestones,
      milestoneTotal,
      goals,
      momentum,
      sceneTone,
      burstAt,
      triggerBurst,
      updateGarden,
    }}>
      {children}
    </GardenContext.Provider>
  )
}

export const useGarden = () => useContext(GardenContext)
