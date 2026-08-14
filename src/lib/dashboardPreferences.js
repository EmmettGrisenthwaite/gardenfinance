import { supabase } from './supabase.js'

function unwrap(data) {
  return Array.isArray(data) ? data[0] : data
}

export async function getDashboardPreferences(userId) {
  const { data, error } = await supabase.from('dashboard_preferences')
    .select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data || null
}

export async function saveDashboardLayout(layout, expectedRevision, { force = false } = {}) {
  const { data, error } = await supabase.rpc('save_dashboard_layout', {
    p_layout: layout,
    p_expected_revision: expectedRevision ?? null,
    p_force: Boolean(force),
  })
  if (error) {
    if (error.code === '40001' || /DASHBOARD_LAYOUT_CONFLICT/i.test(`${error.message || ''} ${error.details || ''}`)) {
      const conflict = new Error('This dashboard changed on another device.')
      conflict.code = 'DASHBOARD_LAYOUT_CONFLICT'
      throw conflict
    }
    throw error
  }
  return unwrap(data)
}

export async function setDashboardPrivacy(hidden) {
  const { data, error } = await supabase.rpc('set_dashboard_privacy', { p_hide_amounts: Boolean(hidden) })
  if (error) throw error
  return unwrap(data)
}
