import {
  STAGE_NAMES,
  STAGE_THRESHOLDS,
  groupGardenGoals,
  stageProgress,
} from './gardenModel.js'

const LAYERS_BY_STAGE = [
  ['seedbed'],
  ['seedbed', 'sprouts'],
  ['seedbed', 'sprouts', 'groundCover'],
  ['seedbed', 'sprouts', 'groundCover', 'youngTrees'],
  ['seedbed', 'sprouts', 'groundCover', 'youngTrees', 'flowers'],
  ['seedbed', 'sprouts', 'groundCover', 'youngTrees', 'flowers', 'matureTrees'],
  ['seedbed', 'sprouts', 'groundCover', 'youngTrees', 'flowers', 'matureTrees', 'legacyGrove'],
  ['seedbed', 'sprouts', 'groundCover', 'youngTrees', 'flowers', 'matureTrees', 'legacyGrove', 'sanctuary'],
]

export const ILLUSTRATED_STAGE_MANIFEST = STAGE_NAMES.map((name, stage) => ({
  stage,
  name,
  threshold: STAGE_THRESHOLDS[stage],
  layers: LAYERS_BY_STAGE[stage],
  description: stage === 0
    ? 'A prepared seedbed, ready for your first permanent milestone.'
    : `${name} reflects ${STAGE_THRESHOLDS[stage]} or more permanent milestones.`,
}))

export function illustratedStage(stage = 0) {
  const safeStage = Math.max(0, Math.min(ILLUSTRATED_STAGE_MANIFEST.length - 1, Number(stage) || 0))
  return ILLUSTRATED_STAGE_MANIFEST[safeStage]
}

export function illustratedGoalLayout(goals = [], milestones = [], visibleLimit = 3) {
  const grouped = groupGardenGoals(goals, milestones, visibleLimit)
  const slots = [
    { key: 'west', x: 29, y: 61 },
    { key: 'east', x: 72, y: 61 },
    { key: 'north', x: 51, y: 46 },
  ]
  const visible = grouped.visible.map((goal, index) => {
    const target = Math.max(1, Number(goal.target_amount) || 0)
    const percent = Math.max(0, Math.min(100, Math.round((Number(goal.current_amount) || 0) / target * 100)))
    return {
      goal,
      percent,
      species: goal.goal_type === 'investment' ? 'investment' : 'savings',
      slot: slots[index],
      scale: 0.72 + (percent / 100) * 0.38,
      flowering: percent >= 75,
    }
  })

  return {
    ...grouped,
    visible,
    overflowCount: grouped.overflow.length,
    legacyFlowerCount: Math.min(9, grouped.legacy.length),
  }
}

export function illustratedGardenSummary({ stage = 0, milestoneTotal = 0, goals = [], milestones = [] } = {}) {
  const manifest = illustratedStage(stage)
  const progress = stageProgress(milestoneTotal)
  const layout = illustratedGoalLayout(goals, milestones)
  const next = progress.nextThreshold == null
    ? 'The sanctuary is fully grown.'
    : `${progress.remaining} ${progress.remaining === 1 ? 'milestone' : 'milestones'} to ${STAGE_NAMES[stage + 1]}.`
  return `${manifest.name} garden. ${milestoneTotal} permanent ${milestoneTotal === 1 ? 'milestone' : 'milestones'}. ${next} ${layout.visible.length} active ${layout.visible.length === 1 ? 'goal' : 'goals'} shown.`
}
