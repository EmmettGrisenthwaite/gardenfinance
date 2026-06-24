import { supabase } from '@/lib/supabase'

// Records today's net-worth snapshot (once per day) and returns the change vs
// ~30 days ago — or the oldest point we have. { delta, days, has }.
export async function netWorthTrend(userId, current) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: rows } = await supabase.from('net_worth_snapshots')
    .select('net_worth, snapshot_date').eq('user_id', userId)
    .order('snapshot_date', { ascending: true })
  const history = rows ?? []

  if (!history.some(s => s.snapshot_date === today) && Number.isFinite(current)) {
    await supabase.from('net_worth_snapshots')
      .insert({ user_id: userId, net_worth: current, snapshot_date: today })
      .then(() => {}, () => {})
    history.push({ net_worth: current, snapshot_date: today })
  }

  if (history.length < 2) return { delta: 0, days: 0, has: false }
  const latest = history[history.length - 1]
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const baseline = history.find(s => s.snapshot_date >= cutoff) || history[0]
  const delta = Number(latest.net_worth) - Number(baseline.net_worth)
  const days = Math.round((new Date(latest.snapshot_date) - new Date(baseline.snapshot_date)) / 86400000)
  return { delta, days, has: days > 0 }
}
