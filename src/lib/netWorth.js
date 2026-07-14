import { supabase } from '@/lib/supabase'

// Records today's net-worth snapshot (once per day) and returns the change vs
// ~30 days ago — or the oldest point we have. { delta, days, has }.
export async function netWorthTrend(userId, current) {
  const currentPoint = typeof current === 'object' && current !== null
    ? {
        net_worth: Number(current.netWorth) || 0,
        assets: Number(current.assets) || 0,
        liabilities: Number(current.liabilities ?? current.totalDebt) || 0,
      }
    : { net_worth: Number(current), assets: 0, liabilities: 0 }
  const today = new Date().toISOString().slice(0, 10)
  const { data: rows, error: readError } = await supabase.from('net_worth_snapshots')
    .select('assets, liabilities, net_worth, snapshot_date').eq('user_id', userId)
    .order('snapshot_date', { ascending: true })
  if (readError) return { delta: 0, days: 0, has: false }
  const history = rows ?? []

  if (!history.some(s => s.snapshot_date === today) && Number.isFinite(currentPoint.net_worth)) {
    const { data: saved, error: writeError } = await supabase.from('net_worth_snapshots')
      .upsert(
        { user_id: userId, ...currentPoint, snapshot_date: today },
        { onConflict: 'user_id,snapshot_date' },
      )
      .select('assets, liabilities, net_worth, snapshot_date')
      .single()
    if (!writeError && saved) history.push(saved)
  } else if (Number.isFinite(currentPoint.net_worth)) {
    // The current value is authoritative. A daily snapshot should not be
    // permanently frozen at a stale value just because another screen wrote it
    // earlier in the day.
    const { data: saved, error: writeError } = await supabase.from('net_worth_snapshots')
      .update(currentPoint)
      .eq('user_id', userId)
      .eq('snapshot_date', today)
      .select('assets, liabilities, net_worth, snapshot_date')
      .single()
    if (!writeError && saved) {
      const index = history.findIndex(s => s.snapshot_date === today)
      if (index >= 0) history[index] = saved
    }
  }

  history.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  if (history.length < 2) return { delta: 0, days: 0, has: false, history }
  const latest = history[history.length - 1]
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const atOrBeforeCutoff = history.filter(snapshot => snapshot.snapshot_date <= cutoff)
  const baseline = atOrBeforeCutoff[atOrBeforeCutoff.length - 1] || history[0]
  const delta = Number(latest.net_worth) - Number(baseline.net_worth)
  const days = Math.round((new Date(latest.snapshot_date) - new Date(baseline.snapshot_date)) / 86400000)
  return { delta, days, has: days > 0, history }
}
