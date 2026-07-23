import { buildAttentionModel, reminderActionHref } from './attentionModel.js'

export function selectHomeAction({
  setupState,
  planModel,
  reminderModel,
  activities,
  plan,
  planLoading = false,
  scenario = null,
  now,
} = {}) {
  const attention = buildAttentionModel({ setupState, planModel, reminderModel, activities, now })
  const selected = attention.primary

  if (selected.kind === 'setup') {
    const prerequisite = selected.item
    return {
      kind: 'setup',
      eyebrow: 'Complete your money picture',
      title: prerequisite.title || prerequisite.label,
      detail: prerequisite.detail || 'Add the missing detail so your Plan and Advisor can make more useful recommendations.',
      cta: prerequisite.cta || 'Add details',
      sheet: prerequisite.sheet,
    }
  }

  if (selected.kind === 'reminder') {
    const reminder = selected.item
    return {
      kind: 'reminder',
      eyebrow: selected.reason === 'stale-evidence' ? 'Keep your numbers current' : 'Check-in due',
      title: reminder.title,
      detail: reminder.detail || 'A quick check-in keeps your next recommendation grounded.',
      cta: reminder.metadata?.action_label || 'Open check-in',
      href: reminderActionHref(reminder),
    }
  }

  const fallbackStep = !planModel && Array.isArray(plan?.steps)
    ? plan.steps.find(step => !step.done && !step.supersededAt)
    : null
  const unfinished = selected.kind === 'plan-step' ? selected.item : fallbackStep
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

  const proposal = selected.kind === 'plan-proposal' ? selected.item : null
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
