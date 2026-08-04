import { useCallback, useEffect, useReducer } from 'react'
import { buildMoneyRoute } from '@/lib/moneyRoute'

const eventName = 'garden-financial:money-route-adjusted'
const storageKey = userId => `money-route-adjustments-${userId}`

function readAdjustments(userId, fingerprint) {
  if (!userId || typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) || 'null')
    return value?.baseFingerprint === fingerprint && value?.amounts && typeof value.amounts === 'object'
      ? value.amounts
      : null
  } catch {
    return null
  }
}

export function useMoneyRoute(input, userId) {
  const [revision, refresh] = useReducer(value => value + 1, 0)
  const baseRoute = buildMoneyRoute(input)
  const adjustments = readAdjustments(userId, baseRoute.baseFingerprint)
  const route = adjustments ? buildMoneyRoute({ ...input, adjustments }) : baseRoute

  useEffect(() => {
    const onAdjusted = () => refresh()
    window.addEventListener(eventName, onAdjusted)
    return () => window.removeEventListener(eventName, onAdjusted)
  }, [])

  const saveAdjustments = useCallback((amounts) => {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify({
        baseFingerprint: baseRoute.baseFingerprint,
        amounts,
      }))
    } catch { /* private browsing still keeps the current component usable */ }
    window.dispatchEvent(new Event(eventName))
  }, [baseRoute.baseFingerprint, userId])

  const clearAdjustments = useCallback(() => {
    try { window.localStorage.removeItem(storageKey(userId)) } catch {}
    window.dispatchEvent(new Event(eventName))
  }, [userId])

  // Reading revision here makes the storage-backed route refresh after the
  // shared browser event without putting mutable storage into React state.
  void revision
  return { route, saveAdjustments, clearAdjustments, hasAdjustments: Boolean(adjustments) }
}
