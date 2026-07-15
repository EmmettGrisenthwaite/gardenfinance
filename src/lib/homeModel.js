export function selectHomeAction({ setupState, plan, planLoading = false } = {}) {
  if (setupState?.next) {
    return {
      kind: 'setup',
      eyebrow: 'Complete your money picture',
      title: setupState.next.label,
      detail: 'Add the missing detail so your Plan and Advisor can make more useful recommendations.',
      cta: setupState.next.cta || 'Add details',
      sheet: setupState.next.sheet,
    }
  }

  const unfinished = Array.isArray(plan?.steps) ? plan.steps.find(step => !step.done) : null
  if (unfinished) {
    return {
      kind: 'plan-step',
      eyebrow: 'Up next in your Plan',
      title: unfinished.text || 'Continue your next step',
      detail: unfinished.impact || unfinished.detail || 'One focused action keeps your financial plan moving.',
      cta: 'View step',
      href: unfinished.id ? `/plan/step/${unfinished.id}` : '/plan',
    }
  }

  if (planLoading) {
    return {
      kind: 'loading',
      eyebrow: 'Finding your next move',
      title: 'Reviewing your Plan',
      detail: 'Your money details are ready while your next action loads.',
      cta: null,
    }
  }

  return {
    kind: 'plan-review',
    eyebrow: 'Your next chapter',
    title: plan ? 'Review what comes next' : 'Build your first focused Plan',
    detail: plan
      ? 'Your current steps are complete. Review a personalized next chapter before adding anything.'
      : 'Turn your money picture into a short, practical sequence of actions.',
    cta: plan ? 'Review next chapter' : 'Build my Plan',
    href: '/plan',
  }
}
