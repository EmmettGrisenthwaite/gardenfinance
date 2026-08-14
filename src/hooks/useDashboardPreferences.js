import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildDefaultDashboard, normalizeDashboardLayout } from '@/lib/dashboardModel'
import { getDashboardPreferences, saveDashboardLayout, setDashboardPrivacy } from '@/lib/dashboardPreferences'

const cacheKey = userId => `garden-dashboard-${userId}`

function readCache(userId) {
  if (!userId || typeof window === 'undefined') return null
  try { return JSON.parse(window.localStorage.getItem(cacheKey(userId)) || 'null') } catch { return null }
}

function writeCache(userId, value) {
  if (!userId || typeof window === 'undefined') return
  try { window.localStorage.setItem(cacheKey(userId), JSON.stringify(value)) } catch {}
}

export function useDashboardPreferences(userId, context = {}) {
  const cached = useMemo(() => readCache(userId), [userId])
  const defaultLayout = useMemo(() => buildDefaultDashboard(context), [context])
  const contextRef = useRef(context)
  contextRef.current = context
  const [row, setRow] = useState(cached)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [privacySaving, setPrivacySaving] = useState(false)

  const applyRow = useCallback(next => {
    setRow(next)
    writeCache(userId, next)
  }, [userId])

  const load = useCallback(async ({ create = true } = {}) => {
    if (!userId) return null
    try {
      const remote = await getDashboardPreferences(userId)
      if (remote) {
        const canonical = { ...remote, layout: normalizeDashboardLayout(remote.layout, contextRef.current) }
        applyRow(canonical)
        setError(null)
        return canonical
      }
      if (!create) return null
      const initial = buildDefaultDashboard(contextRef.current)
      const saved = await saveDashboardLayout(initial, null)
      const canonical = { ...saved, layout: normalizeDashboardLayout(saved.layout, contextRef.current) }
      applyRow(canonical)
      setError(null)
      return canonical
    } catch (loadError) {
      setError(loadError.message || 'Dashboard preferences could not sync yet.')
      return null
    } finally {
      setLoading(false)
    }
  }, [applyRow, userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load({ create: false }) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  const layout = useMemo(() => normalizeDashboardLayout(row?.layout || defaultLayout, context), [row?.layout, defaultLayout, context])

  const saveLayout = useCallback(async (nextLayout, { force = false } = {}) => {
    const normalized = normalizeDashboardLayout(nextLayout, contextRef.current)
    try {
      const saved = await saveDashboardLayout(normalized, row?.layout_revision ?? null, { force })
      const canonical = { ...saved, layout: normalizeDashboardLayout(saved.layout, contextRef.current) }
      applyRow(canonical)
      setError(null)
      return { saved: canonical }
    } catch (saveError) {
      if (saveError.code === 'DASHBOARD_LAYOUT_CONFLICT') {
        const latest = await getDashboardPreferences(userId)
        return { conflict: latest ? { ...latest, layout: normalizeDashboardLayout(latest.layout, contextRef.current) } : null }
      }
      setError(saveError.message || 'Dashboard changes could not be saved.')
      throw saveError
    }
  }, [applyRow, row?.layout_revision, userId])

  const setHideAmounts = useCallback(async hidden => {
    const previous = Boolean(row?.hide_amounts)
    const optimistic = { ...(row || {}), layout, hide_amounts: Boolean(hidden) }
    applyRow(optimistic)
    setPrivacySaving(true)
    try {
      const saved = await setDashboardPrivacy(hidden)
      applyRow({ ...saved, layout: normalizeDashboardLayout(saved.layout, contextRef.current) })
      setError(null)
    } catch (privacyError) {
      applyRow({ ...optimistic, hide_amounts: previous })
      setError(privacyError.message || 'Privacy preference could not sync.')
    } finally {
      setPrivacySaving(false)
    }
  }, [applyRow, layout, row])

  return {
    layout,
    revision: row?.layout_revision ?? null,
    hideAmounts: Boolean(row?.hide_amounts),
    loading,
    error,
    privacySaving,
    saveLayout,
    setHideAmounts,
    refetch: load,
  }
}
