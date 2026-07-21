import { supabase } from './supabase.js'

function unwrap(data) {
  return Array.isArray(data) ? data[0] : data
}

function candidatePayload(candidate) {
  return {
    candidate_key: candidate.candidateKey,
    source_fingerprint: candidate.sourceFingerprint,
    title: candidate.title,
    detail: candidate.detail || null,
    cadence: candidate.cadence,
    anchor_date: candidate.anchorDate,
    linked_record_type: candidate.linkedRecordType || null,
    linked_record_id: candidate.linkedRecordId || null,
    user_edited: Boolean(candidate.userEdited),
    metadata: {
      ...(candidate.metadata || {}),
      evidence: candidate.evidence || null,
      action_label: candidate.actionLabel || null,
      action_target: candidate.actionTarget || null,
    },
  }
}

export async function listReminders(userId) {
  const { data, error } = await supabase.from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('next_due_on', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listReminderEvents(userId, { limit = 60 } = {}) {
  const { data, error } = await supabase.from('reminder_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function approveReminderCandidate(candidate) {
  const { data, error } = await supabase.rpc('approve_reminder_candidate', {
    p_candidate: candidatePayload(candidate),
  })
  if (error) throw error
  return data
}

export async function dismissReminderCandidate(candidate) {
  const { data, error } = await supabase.rpc('dismiss_reminder_candidate', {
    p_candidate: candidatePayload(candidate),
  })
  if (error) throw error
  return unwrap(data)
}

export async function saveReminder(reminder) {
  const { data, error } = await supabase.rpc('save_reminder', {
    p_reminder: {
      id: reminder.id || null,
      title: reminder.title,
      detail: reminder.detail || null,
      cadence: reminder.cadence,
      anchor_date: reminder.anchor_date,
      linked_record_type: reminder.linked_record_type || null,
      linked_record_id: reminder.linked_record_id || null,
      metadata: reminder.metadata || {},
    },
  })
  if (error) throw error
  return unwrap(data)
}

export async function setReminderStatus(reminderId, status, metadataPatch = {}) {
  const { data, error } = await supabase.rpc('set_reminder_status', {
    p_reminder_id: reminderId,
    p_status: status,
    p_metadata_patch: metadataPatch,
  })
  if (error) throw error
  return unwrap(data)
}

export async function actOnReminder(reminder, action, snoozedUntil = null) {
  const expectedDue = reminder?.next_due_on
  const sourceKey = [reminder?.id, expectedDue, action, snoozedUntil || ''].join(':')
  const { data, error } = await supabase.rpc('act_on_reminder', {
    p_reminder_id: reminder.id,
    p_expected_due_on: expectedDue,
    p_action: action,
    p_snoozed_until: snoozedUntil,
    p_source_key: sourceKey,
  })
  if (error) {
    const stale = /STALE_REMINDER_STATE/i.test(`${error.message || ''} ${error.details || ''}`)
    if (stale) {
      const conflict = new Error('This reminder changed on another screen. It has been refreshed before applying your action.')
      conflict.code = 'STALE_REMINDER_STATE'
      throw conflict
    }
    throw error
  }
  return data
}
