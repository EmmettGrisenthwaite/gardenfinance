import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ILLUSTRATED_STAGE_MANIFEST,
  illustratedGardenSummary,
  illustratedGoalLayout,
  illustratedStage,
} from '../src/lib/illustratedGarden.js'

test('illustrated garden has eight deterministic, cumulative stage manifests', () => {
  assert.equal(ILLUSTRATED_STAGE_MANIFEST.length, 8)
  assert.deepEqual(ILLUSTRATED_STAGE_MANIFEST.map(stage => stage.threshold), [0, 1, 3, 6, 10, 16, 24, 36])
  for (let stage = 1; stage < ILLUSTRATED_STAGE_MANIFEST.length; stage += 1) {
    const prior = ILLUSTRATED_STAGE_MANIFEST[stage - 1].layers
    const current = ILLUSTRATED_STAGE_MANIFEST[stage].layers
    assert.ok(prior.every(layer => current.includes(layer)), `stage ${stage} keeps all earned layers`)
    assert.ok(current.length > prior.length, `stage ${stage} reveals a new layer`)
  }
  assert.equal(illustratedStage(-4).name, 'Seedbed')
  assert.equal(illustratedStage(99).name, 'Sanctuary')
})

test('goal plants use three stable slots and move excess goals into overflow', () => {
  const goals = Array.from({ length: 5 }, (_, index) => ({
    id: `g-${index}`,
    name: `Goal ${index}`,
    goal_type: index % 2 ? 'investment' : 'savings',
    current_amount: index * 20,
    target_amount: 100,
    created_at: `2026-01-0${index + 1}T00:00:00Z`,
  }))
  const milestones = Array.from({ length: 12 }, (_, index) => ({ kind: 'goal', source_key: `legacy-${index}` }))
  const layout = illustratedGoalLayout(goals, milestones)

  assert.deepEqual(layout.visible.map(item => item.slot.key), ['west', 'east', 'north'])
  assert.deepEqual(layout.visible.map(item => item.species), ['savings', 'investment', 'savings'])
  assert.equal(layout.overflowCount, 2)
  assert.equal(layout.legacyFlowerCount, 9)
  assert.equal(layout.visible[2].percent, 40)
})

test('accessible summary uses the same manifest and progress model', () => {
  const summary = illustratedGardenSummary({ stage: 4, milestoneTotal: 12, goals: [], milestones: [] })
  assert.match(summary, /Blooming garden/)
  assert.match(summary, /12 permanent milestones/)
  assert.match(summary, /4 milestones to Flourishing/)
})

test('purchase goals keep savings projections and garden visuals', () => {
  const layout = illustratedGoalLayout([{
    id: 'purchase', name: 'New car', goal_type: 'purchase',
    current_amount: 5000, target_amount: 20000, created_at: '2026-01-01T00:00:00Z',
  }])
  assert.equal(layout.visible[0].species, 'savings')
  assert.equal(layout.visible[0].percent, 25)
})
