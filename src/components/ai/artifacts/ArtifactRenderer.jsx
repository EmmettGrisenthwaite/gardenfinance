import DebtPayoffArtifact from './DebtPayoffArtifact'
import GoalProjectionArtifact from './GoalProjectionArtifact'
import NetWorthTrajectoryArtifact from './NetWorthTrajectoryArtifact'

/**
 * Artifact renderer dispatcher.
 * Renders the correct interactive artifact based on the artifact type.
 */
export default function ArtifactRenderer({ artifact, debts, goals, accounts, profile, onAddStep, onUpdateGoal }) {
  if (!artifact) return null

  const { type, params = {} } = artifact

  switch (type) {
    case 'debt_payoff':
      return (
        <DebtPayoffArtifact
          debts={debts}
          monthlySurplus={(Number(profile?.monthly_income) || 0) - (Number(profile?.monthly_expenses) || 0)}
          onAddStep={onAddStep}
        />
      )

    case 'goal_projection': {
      const goal = goals?.find(g => g.id === params.goalId) || goals?.[0] || null
      return (
        <GoalProjectionArtifact
          goal={goal}
          monthlyIncome={Number(profile?.monthly_income) || 0}
          onUpdateGoal={onUpdateGoal}
        />
      )
    }

    case 'net_worth': {
      const assets = accounts?.reduce((s, a) => s + (Number(a.balance) || 0), 0) || 0
      const totalDebt = debts?.reduce((s, d) => s + (Number(d.balance) || 0), 0) || 0
      const monthlySurplus = (Number(profile?.monthly_income) || 0) - (Number(profile?.monthly_expenses) || 0)
      return (
        <NetWorthTrajectoryArtifact
          assets={assets}
          debts={totalDebt}
          monthlySurplus={monthlySurplus}
        />
      )
    }

    default:
      return null
  }
}
