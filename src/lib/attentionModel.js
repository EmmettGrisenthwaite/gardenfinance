function dateOnly(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function reminderDueDate(reminder) {
  return reminder?.snoozed_until || reminder?.snooze_date || reminder?.next_due_on || null
}

function repairsFinancialEvidence(reminder = {}) {
  const relation = reminder.linked_record_type || reminder.metadata?.linked_record_type || ''
  const key = `${reminder.candidate_key || ''} ${reminder.metadata?.candidate_key || ''}`
  return ['money_records', 'monthly_plan', 'account', 'debt'].includes(relation)
    || /\b(balance|fresh|verify|monthly.plan|debt|account)\b/i.test(key)
}

function isOverdueEvidenceReminder(reminder, today) {
  const due = dateOnly(reminderDueDate(reminder))
  return Boolean(due && due < today && repairsFinancialEvidence(reminder))
}

/**
 * One shared attention budget for top-level surfaces.
 *
 * The model deliberately returns only one primary item. Counts remain passive
 * so Home can acknowledge background state without turning every subsystem
 * into another competing card.
 */
export function buildAttentionModel({
  setupState,
  planModel,
  reminderModel,
  activities = [],
  now = new Date(),
} = {}) {
  const today = dateOnly(now) || new Date().toISOString().slice(0, 10)
  const due = Array.isArray(reminderModel?.due) ? reminderModel.due : []
  const prerequisite = planModel?.prerequisite || setupState?.next || null
  const overdueEvidence = due.find(reminder => isOverdueEvidenceReminder(reminder, today))
  const activeStep = planModel?.focus?.find(step => !step?.proposed) || null
  const ordinaryReminder = due.find(reminder => reminder !== overdueEvidence) || overdueEvidence || null
  const proposal = planModel?.focus?.find(step => step?.proposed) || null

  let primary
  if (prerequisite) primary = { kind: 'setup', item: prerequisite }
  else if (overdueEvidence) primary = { kind: 'reminder', item: overdueEvidence, reason: 'stale-evidence' }
  else if (activeStep) primary = { kind: 'plan-step', item: activeStep }
  else if (ordinaryReminder) primary = { kind: 'reminder', item: ordinaryReminder, reason: 'due' }
  else if (proposal) primary = { kind: 'plan-proposal', item: proposal }
  else primary = { kind: 'plan-review', item: null }

  return {
    primary,
    counts: {
      remindersDue: due.length,
      reviews: Number(Boolean(planModel?.review)) + Number(reminderModel?.counts?.review || 0),
      pendingProgress: activities.filter(activity =>
        activity && !activity.prompt_seen_at && !['applied', 'dismissed'].includes(activity.status)).length,
    },
  }
}

export function reminderActionHref(reminder) {
  if (!reminder?.id) return '/plan#goals'
  return `/plan?reminder=${encodeURIComponent(reminder.id)}#goals`
}
