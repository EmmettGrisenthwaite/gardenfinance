export function selectAdvisorResponseAction({
  isLast = false,
  answerCount = 0,
  artifactCount = 0,
  plannable = false,
} = {}) {
  if (isLast && answerCount > 0) return 'answers'
  if (artifactCount > 0) return 'attachment'
  if (isLast && plannable) return 'add_to_plan'
  return null
}

export function selectPendingAdvisorAttachment({ plan, guide, goal } = {}) {
  if (plan) return { kind: 'plan', value: plan }
  if (guide) return { kind: 'guide', value: guide }
  if (goal) return { kind: 'goal', value: goal }
  return null
}
