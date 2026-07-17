export const HOW_TO_SLOW_MS = 6000
export const HOW_TO_TIMEOUT_MS = 18000

export function guideEvidenceFingerprint(subject = '', context = '') {
  const value = `${String(subject).trim()}\n${String(context).trim()}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `guide-v1-${(hash >>> 0).toString(36)}`
}

export function formatHowToResult(result) {
  const steps = Array.isArray(result?.steps)
    ? result.steps.map(step => String(step ?? '').trim()).filter(Boolean).slice(0, 6)
    : []
  return steps.map((step, index) => `${index + 1}. ${step.replace(/^\d+[.)]\s*/, '')}`).join('\n')
}
