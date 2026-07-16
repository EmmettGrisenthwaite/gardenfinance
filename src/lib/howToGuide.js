export const HOW_TO_SLOW_MS = 6000
export const HOW_TO_TIMEOUT_MS = 18000

export function formatHowToResult(result) {
  const steps = Array.isArray(result?.steps)
    ? result.steps.map(step => String(step ?? '').trim()).filter(Boolean).slice(0, 6)
    : []
  return steps.map((step, index) => `${index + 1}. ${step.replace(/^\d+[.)]\s*/, '')}`).join('\n')
}
