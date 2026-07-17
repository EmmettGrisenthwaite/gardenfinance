function suppliedDoneWhen(step) {
  const value = step?.doneWhen ?? step?.done_when
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// Older and user-authored steps predate structured completion criteria. Keep
// their action text untouched, but give every focused surface an observable
// finish line derived only from the step itself.
export function doneWhenForStep(step = {}) {
  const supplied = suppliedDoneWhen(step)
  if (supplied) return supplied

  const text = String(step.text || '').toLowerCase()
  const kind = String(step.outcome?.kind || '').toLowerCase()
  const asksToConfirm = /\b(check|confirm|find|ask|verify)\b/.test(text)

  if (kind === 'recurring_setup' || /\b(automatic|recurring|autopay)\b/.test(text)) {
    return 'The recurring action is scheduled and visible in the linked account.'
  }
  if (/\b(roll over|rollover|consolidat(?:e|ing))\b|\broll\b.*\b(401k|401ks|ira)\b/.test(text)) {
    return 'The rollover is complete and the receiving account shows the transferred balance.'
  }
  if (kind === 'account_opening' || /\b(open|create)\b.*\b(account|ira|401k|403b|hsa|hysa|brokerage)\b/.test(text)) {
    return 'The account is open and appears in Money.'
  }
  if (/\bemployer(?:'s)?\s+match(?:es|ing)?\b|\b401k match\b|\b401\(k\) match\b|\bmatching contribution\b/.test(text)) {
    return 'Your employer match rate and required contribution are confirmed and recorded.'
  }
  if (/\b(health )?insurance|coverage\b/.test(text)) {
    return asksToConfirm
      ? 'Your coverage status is confirmed and recorded.'
      : 'Your coverage is active and recorded.'
  }
  if (kind === 'debt_payment' || /\b(pay|payment|debt|credit card|loan)\b/.test(text)) {
    return 'The payment is complete and the debt balance reflects it.'
  }
  if (kind === 'transfer' || kind === 'contribution'
    || /\b(move|transfer|deposit|contribute|invest|fund|save)\b/.test(text)) {
    return 'The money has moved and the destination balance reflects it.'
  }
  if (/\bgoal\b/.test(text)) {
    return 'The goal change is saved and visible in Plan.'
  }
  if (kind === 'information_only' || asksToConfirm) {
    return 'The requested information is confirmed and recorded.'
  }
  return 'The action is finished and its result is recorded in the app.'
}
