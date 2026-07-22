export function selectHomeAction({ setupState, planModel, plan, planLoading = false, scenario = null } = {}) {
  const prerequisite = planModel?.prerequisite || (setupState?.next ? {
    title: setupState.next.label,
    cta: setupState.next.cta,
    sheet: setupState.next.sheet,
  } : null)
  if (prerequisite) {
    return {
      kind: 'setup',
      eyebrow: 'Complete your money picture',
      title: prerequisite.title,
      detail: prerequisite.detail || 'Add the missing detail so your Plan and Advisor can make more useful recommendations.',
      cta: prerequisite.cta || 'Add details',
      sheet: prerequisite.sheet,
    }
  }

  const unfinished = planModel?.focus?.find(step => !step.proposed)
    || (planModel ? null : (Array.isArray(plan?.steps) ? plan.steps.find(step => !step.done && !step.supersededAt) : null))
  if (unfinished) {
    return {
      kind: 'plan-step',
      // Name the chapter so the next step reads as part of THEIR story, not a
      // generic to-do ("Extinguish · up next" instead of a bare label).
      eyebrow: scenario?.chapter ? `${scenario.chapter} · up next` : 'Up next in your Plan',
      title: unfinished.text || 'Continue your next step',
      detail: unfinished.detail || unfinished.impact || 'One focused action keeps your financial plan moving.',
      doneWhen: unfinished.doneWhen || null,
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

  const proposal = planModel?.focus?.find(step => step.proposed)
  if (proposal) {
    return {
      kind: 'plan-proposal',
      eyebrow: 'Proposed next move',
      title: proposal.text,
      detail: proposal.detail || 'Review this grounded suggestion before adding it to your Plan.',
      doneWhen: proposal.doneWhen || null,
      cta: 'Review focused plan',
      href: '/plan',
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
