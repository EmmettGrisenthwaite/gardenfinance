import { Check, MessageCircle } from 'lucide-react'

/**
 * The refinement between a generated plan and a committed one.
 *
 * At most three questions, each a tap rather than a sentence, each stating what
 * it will change before it is answered. The answers fold back into the plan as
 * revisions, and the last screen is the revised plan with one button to keep it
 * — so the interview always ends somewhere, rather than trailing off into a
 * conversation the user has to close themselves.
 *
 * Questions whose answer cannot be reduced to two taps never reach here; they
 * stay chat prompts, and "talk it through" hands this one over as well.
 */
export default function PlanInterview({ interview, onAnswer, onDiscuss, onFinish, busy = false, finishLabel }) {
  if (!interview || interview.status === 'unavailable') return null
  const { question, answered, progress, status } = interview

  return (
    <section aria-label="Refine your plan" className="mt-4 rounded-2xl border border-emerald-200/16 bg-emerald-300/[0.035] p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-emerald-100/80">
          {status === 'complete' ? 'Your answers' : 'A few questions first'}
        </p>
        {progress.total > 0 && (
          <p className="text-[11px] font-semibold tabular-nums text-readable-muted">
            {Math.min(progress.index + (status === 'complete' ? 0 : 1), progress.total)} of {progress.total}
          </p>
        )}
      </div>

      {/* What has already been decided, and what each decision did. Kept visible
          so the plan below never changes for a reason the user cannot see. */}
      {answered.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {answered.map(item => (
            <li key={item.id} className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <p className="text-xs leading-5 text-readable-secondary">
                <span className="text-readable-muted">{item.choiceLabel}</span>
                {' — '}
                <span className="font-medium text-white">{item.summary}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {question && (
        <div className="mt-3">
          <p className="text-[13px] font-semibold leading-5 text-white">{question.question}</p>
          <p className="mt-0.5 text-xs leading-5 text-readable-muted">{question.why}</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {question.options.map(option => (
              <button
                key={option.id} type="button" disabled={busy}
                onClick={() => onAnswer(question.id, option.id)}
                className="min-h-11 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-left text-[13px] font-medium text-readable-secondary transition-colors hover:border-emerald-400/40 hover:bg-emerald-300/[0.07] hover:text-white disabled:opacity-50"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-4 text-readable-muted">{question.changes}</p>
            <button
              type="button" onClick={() => onDiscuss(question)} disabled={busy}
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-emerald-100/80 hover:text-emerald-100 disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Talk it through
            </button>
          </div>
        </div>
      )}

      {status === 'complete' && onFinish && (
        <button
          type="button" onClick={onFinish} disabled={busy}
          className="btn-primary mt-3 min-h-11 w-full disabled:opacity-50"
        >
          {busy ? 'Saving…' : finishLabel}
        </button>
      )}
    </section>
  )
}
