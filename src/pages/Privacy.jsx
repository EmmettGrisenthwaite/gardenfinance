import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Required for the Play listing, and for a finance app it is read.
 *
 * Written from what the code actually does — the tables in supabase/, the two
 * Edge Functions, and the absence of any analytics SDK — rather than from a
 * template. If the data flow changes, this page is part of the change.
 */
export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-10">
      <Link to="/settings" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-100 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>

      <h1 className="font-brand text-[26px] font-medium tracking-tight text-white">Privacy</h1>
      <p className="mt-2 text-sm leading-6 text-readable-secondary">
        What this app stores, where it goes, and how to get rid of it.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-white">What is collected</h2>
        <p className="text-sm leading-6 text-readable-secondary">
          Only what you enter, plus what it takes to sign you in: your email address, and the
          financial details you type — income, spending, account balances, debts and their rates,
          goals, and the plan steps you accept. If you connect a bank, the balances and transactions
          that connection returns.
        </p>
        <p className="text-sm leading-6 text-readable-secondary">
          There is no analytics SDK, no advertising SDK, and no third-party tracker in this app.
          Nothing about you is sold or shared for advertising, because nothing is collected for it.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-white">Where it lives</h2>
        <p className="text-sm leading-6 text-readable-secondary">
          In a Supabase-hosted Postgres database, encrypted in transit. Every table is protected by
          row-level security keyed to your user id, so a request authenticated as you can only ever
          read rows belonging to you.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-white">Who else sees it</h2>
        <p className="text-sm leading-6 text-readable-secondary">
          <strong className="font-semibold text-white">Anthropic</strong>, when you use the advisor.
          Your message and a summary of your figures are sent to Claude to produce a reply. The call
          is made by a server-side function, so the API key is never in the app you downloaded.
          Anthropic does not train models on data sent through its API.
        </p>
        <p className="text-sm leading-6 text-readable-secondary">
          <strong className="font-semibold text-white">Plaid</strong>, only if you choose to connect
          a bank. Plaid handles the login with your institution; this app never sees your banking
          credentials. Skip that feature and Plaid receives nothing.
        </p>
        <p className="text-sm leading-6 text-readable-secondary">
          The plan links out to providers such as Fidelity, Ally and Vanguard. Those are ordinary
          links — following one is a visit you make, and nothing about you is passed along with it.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-white">Getting it back, or getting rid of it</h2>
        <p className="text-sm leading-6 text-readable-secondary">
          Settings has both. <strong className="font-semibold text-white">Export</strong> downloads
          everything held about you as a JSON file.{' '}
          <strong className="font-semibold text-white">Delete</strong> removes your records
          permanently — accounts, debts, goals, plans, advisor history, the lot. Deletion is not
          reversible and there is no archived copy to restore from.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-white">What this app is not</h2>
        <p className="text-sm leading-6 text-readable-secondary">
          It is educational guidance built from arithmetic on figures you supply, not advice from a
          licensed financial planner, and it does not move money on your behalf. Every step is
          something you carry out yourself, at your own bank.
        </p>
      </section>

      <p className="mt-10 text-xs leading-5 text-readable-muted">
        Questions about your data can go to the address you signed up with.
      </p>
    </div>
  )
}
