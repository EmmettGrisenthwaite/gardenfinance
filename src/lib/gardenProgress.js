import { supabase } from '@/lib/supabase'
import { milestoneEventsFromState } from './gardenModel.js'

function normalizeResult(data) {
  const value = Array.isArray(data) ? data[0] : data
  return {
    inserted: Boolean(value?.inserted),
    previousTotal: Number(value?.previousTotal ?? value?.previous_total) || 0,
    total: Number(value?.total) || 0,
  }
}

export async function listGardenMilestones(userId) {
  const { data, error } = await supabase
    .from('garden_milestones')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function recordGardenMilestone(event) {
  if (!event) return { inserted: false, previousTotal: 0, total: 0 }
  const { data, error } = await supabase.rpc('record_garden_milestone', {
    p_kind: event.kind,
    p_source_key: event.source_key,
    p_label: event.label,
    p_metadata: event.metadata || {},
    p_earned_at: event.earned_at || new Date().toISOString(),
  })
  if (error) throw error
  return normalizeResult(data)
}

export async function reconcileGardenMilestones(userId, state = {}) {
  const events = milestoneEventsFromState(state)
  const { data, error } = await supabase.rpc('reconcile_garden_milestones', {
    p_events: events,
  })
  if (error) throw error
  const result = normalizeResult(data)
  const milestones = await listGardenMilestones(userId)
  return { ...result, milestones, total: milestones.length }
}
