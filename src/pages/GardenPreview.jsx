import { useEffect, useState } from 'react'
import { useGarden } from '@/context/GardenContext'
import Garden3D from '@/components/garden/Garden3D'

// ── Dev-only sandbox for iterating on the 3D garden without auth/real data ──
// Visit /garden-preview (dev builds only). Use the controls to exercise every
// visual state: net-worth tiers, deficit/surplus weather, goal mixes, stages.

// Ordered to walk the full progression: barren (0) → flourishing (5).
const SCENARIOS = {
  '0 · Brand new (empty)': {
    budgets: [], goals: [], debts: [], accounts: [],
  },
  '1 · Struggling (deficit)': {
    budgets: [
      { type: 'income',  amount: 3200, recurring: true },
      { type: 'expense', category: 'Housing',   amount: 1900, recurring: true },
      { type: 'expense', category: 'Food',      amount: 700,  recurring: true },
      { type: 'expense', category: 'Transport', amount: 1100, recurring: true },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund', goal_type: 'savings', current_amount: 300, target_amount: 6000 },
      { id: 'g2', name: 'Pay off card',   goal_type: 'savings', current_amount: 0,   target_amount: 4000 },
    ],
    debts: [{ balance: 14000 }, { balance: 6000 }],
    accounts: [{ type: 'checking', balance: 600 }],
  },
  '2 · First steps (greening)': {
    budgets: [
      { type: 'income',  amount: 4000, recurring: true },
      { type: 'expense', category: 'Housing', amount: 2000, recurring: true },
      { type: 'expense', category: 'Food',    amount: 700,  recurring: true },
      { type: 'expense', category: 'Other',   amount: 700,  recurring: true },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund', goal_type: 'savings', current_amount: 400, target_amount: 6000 },
    ],
    debts: [],
    accounts: [{ type: 'checking', balance: 1600 }],
  },
  '3 · Growing (habits forming)': {
    budgets: [
      { type: 'income',  amount: 5000, recurring: true },
      { type: 'expense', category: 'Housing',   amount: 2200, recurring: true },
      { type: 'expense', category: 'Food',      amount: 700,  recurring: true },
      { type: 'expense', category: 'Transport', amount: 500,  recurring: true },
      { type: 'expense', category: 'Savings',   amount: 500,  recurring: true },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund', goal_type: 'savings',    current_amount: 4000, target_amount: 8000 },
      { id: 'g2', name: 'New Car',        goal_type: 'savings',    current_amount: 3000, target_amount: 12000 },
      { id: 'g3', name: 'Roth IRA',       goal_type: 'investment', current_amount: 2000, target_amount: 7000 },
    ],
    debts: [{ balance: 5000 }],
    accounts: [
      { type: 'checking', balance: 3000 },
      { type: 'savings',  balance: 5000 },
    ],
  },
  '4 · Healthy (thriving)': {
    budgets: [
      { type: 'income',  amount: 7000, recurring: true },
      { type: 'expense', category: 'Housing', amount: 1800, recurring: true },
      { type: 'expense', category: 'Food',    amount: 650,  recurring: true },
      { type: 'expense', category: 'Savings', amount: 1500, recurring: true },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund',     goal_type: 'savings',    current_amount: 5200,  target_amount: 6000 },
      { id: 'g2', name: 'House Down Payment', goal_type: 'savings',    current_amount: 22000, target_amount: 60000 },
      { id: 'g3', name: 'Dream Vacation',     goal_type: 'savings',    current_amount: 3400,  target_amount: 3500 },
      { id: 'g4', name: 'Roth IRA',           goal_type: 'investment', current_amount: 34000, target_amount: 50000 },
      { id: 'g5', name: 'Brokerage',          goal_type: 'investment', current_amount: 12000, target_amount: 40000 },
      { id: 'g6', name: '401k',               goal_type: 'investment', current_amount: 88000, target_amount: 100000 },
    ],
    debts: [{ balance: 8000 }],
    accounts: [
      { type: 'checking', balance: 9000 },
      { type: 'savings',  balance: 18000 },
      { type: 'roth_ira', balance: 34000 },
      { type: '401k',     balance: 88000 },
      { type: 'brokerage',balance: 12000 },
    ],
  },
  '5 · Wealthy (flourishing)': {
    budgets: [
      { type: 'income',  amount: 18000, recurring: true },
      { type: 'expense', category: 'Housing', amount: 3500, recurring: true },
      { type: 'expense', category: 'Savings', amount: 6000, recurring: true },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund', goal_type: 'savings',    current_amount: 30000,  target_amount: 30000 },
      { id: 'g4', name: 'Roth IRA',       goal_type: 'investment', current_amount: 50000,  target_amount: 50000 },
      { id: 'g5', name: 'Brokerage',      goal_type: 'investment', current_amount: 180000, target_amount: 200000 },
      { id: 'g6', name: '401k',           goal_type: 'investment', current_amount: 240000, target_amount: 250000 },
    ],
    debts: [],
    accounts: [
      { type: 'checking',  balance: 40000 },
      { type: 'savings',   balance: 80000 },
      { type: 'roth_ira',  balance: 50000 },
      { type: '401k',      balance: 240000 },
      { type: 'brokerage', balance: 180000 },
    ],
  },
}

export default function GardenPreview() {
  const { updateGarden, stage, weather } = useGarden()
  const [scenario, setScenario] = useState('0 · Brand new (empty)')

  useEffect(() => {
    const s = SCENARIOS[scenario]
    updateGarden(s.budgets, s.goals, s.debts, s.accounts)
  }, [scenario, updateGarden])

  return (
    <div className="fixed inset-0 bg-black">
      <Garden3D />

      {/* Dev control panel */}
      <div className="absolute top-3 left-3 z-50 bg-black/70 backdrop-blur-md rounded-xl border border-white/15 p-3 text-white text-xs font-mono space-y-2 max-w-[240px]">
        <div className="font-bold text-green-300 tracking-wide">GARDEN PREVIEW · dev</div>
        <div className="space-y-1">
          {Object.keys(SCENARIOS).map(name => (
            <button
              key={name}
              onClick={() => setScenario(name)}
              className={`block w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                scenario === name ? 'bg-green-500/30 text-white' : 'text-white/60 hover:bg-white/10'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="pt-1 border-t border-white/10 text-white/50 leading-relaxed">
          stage <span className="text-white">{stage}</span> ·
          nwTier <span className="text-white">{weather.netWorthTier}</span> ·
          nw <span className="text-white">${Math.round(weather.netWorth ?? 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
