import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STAGE_NAMES,
  gardenMomentum,
  groupGardenGoals,
  milestoneEventsFromState,
  milestonesToStage,
  sceneToneFromCashFlow,
  stageProgress,
} from '../src/lib/gardenModel.js'

test('garden uses the eight-stage permanent growth curve', () => {
  assert.equal(STAGE_NAMES.length, 8)
  assert.deepEqual([0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 15, 16, 23, 24, 35, 36, 90].map(milestonesToStage), [
    0, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7,
  ])
  assert.deepEqual(stageProgress(17), {
    stage: 5,
    currentThreshold: 16,
    nextThreshold: 24,
    percent: 13,
    remaining: 7,
  })
})

test('milestone events use stable source keys and include reached goals once', () => {
  const events = milestoneEventsFromState({
    plans: [{ id: 'plan-a', updated_at: '2026-01-01T00:00:00Z', steps: [
      { id: 'step-a', text: 'Do the thing', done: true, completedAt: '2026-01-02T00:00:00Z' },
      { text: 'Legacy thing', done: true },
      { id: 'step-b', text: 'Not yet', done: false },
    ] }],
    goals: [
      { id: 'goal-a', name: 'Cushion', target_amount: 1000, current_amount: 1000, goal_type: 'savings' },
      { id: 'goal-b', name: 'Trip', target_amount: 2000, current_amount: 500 },
    ],
  })

  assert.deepEqual(events.map(event => event.source_key), ['step:step-a', 'step:plan-a:1', 'goal:goal-a'])
  assert.equal(events[2].metadata.goalType, 'savings')
})

test('recent activity changes momentum without changing earned progress', () => {
  const now = new Date('2026-07-14T12:00:00Z').getTime()
  assert.equal(gardenMomentum({ milestones: [{ earned_at: '2026-07-10T12:00:00Z' }], now }), 'lively')
  assert.equal(gardenMomentum({ milestones: [{ earned_at: '2026-06-25T12:00:00Z' }], now }), 'gentle')
  assert.equal(gardenMomentum({ milestones: [{ earned_at: '2026-05-01T12:00:00Z' }], now }), 'resting')
  assert.equal(gardenMomentum({ now }), 'resting')
})

test('active goals stay readable while reached goals form a legacy grove', () => {
  const goals = Array.from({ length: 7 }, (_, index) => ({
    id: `goal-${index}`,
    name: `Goal ${index}`,
    target_amount: 100,
    current_amount: index === 6 ? 100 : index * 5,
    created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
  }))
  const milestones = [{ id: 'm1', kind: 'goal', source_key: 'goal:goal-6', label: 'Goal 6', earned_at: '2026-02-01T00:00:00Z' }]
  const grouped = groupGardenGoals(goals, milestones)

  assert.equal(grouped.visible.length, 5)
  assert.equal(grouped.overflow.length, 1)
  assert.equal(grouped.legacy.length, 1)

  goals[6].current_amount = 50
  const regressed = groupGardenGoals(goals, milestones)
  assert.equal(regressed.overflow.length, 2)
  assert.equal(regressed.legacy.length, 1)
})

test('cash-flow strain is gentle scene tone, not a growth score', () => {
  assert.equal(sceneToneFromCashFlow(5000, 5200), 'strained')
  assert.equal(sceneToneFromCashFlow(5000, 4000), 'calm')
  assert.equal(sceneToneFromCashFlow(0, 4000), 'calm')
})
