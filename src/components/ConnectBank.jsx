import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { AlertCircle, Building2, Check, Landmark, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import {
  createPlaidLinkToken, exchangePlaidPublicToken, listPlaidConnections,
  removePlaidConnection, syncPlaidAccounts,
} from '@/lib/plaid'

function timeAgo(value) {
  if (!value) return 'Never synced'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'Just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `Synced ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Synced ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Synced ${days}d ago`
}

function ConnectionRow({ connection, onSync, onDisconnect, busy }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const timer = setTimeout(() => setArmed(false), 2500)
    return () => clearTimeout(timer)
  }, [armed])
  const needsReconnect = connection.status === 'error'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${needsReconnect ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}>
        <Building2 className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-readable-primary">{connection.institution_name || 'Connected bank'}</p>
        <p className={`mt-0.5 text-xs ${needsReconnect ? 'text-amber-200' : 'text-readable-secondary'}`}>
          {needsReconnect ? 'Needs reconnecting — sync to try again' : timeAgo(connection.last_synced_at)}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={() => onSync(connection.id)} aria-label={`Sync ${connection.institution_name || 'this bank'}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-readable-secondary transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </button>
      <button type="button" disabled={busy}
        onClick={() => { if (armed) onDisconnect(connection.id); else setArmed(true) }}
        aria-label={armed ? 'Tap again to disconnect' : `Disconnect ${connection.institution_name || 'this bank'}`}
        className={`flex h-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
          armed ? 'w-auto gap-1 border border-rose-400/40 bg-rose-500/20 px-2.5 text-rose-200' : 'w-10 text-readable-secondary hover:bg-rose-400/10 hover:text-rose-100'}`}>
        <Trash2 className="h-4 w-4" />
        {armed && <span className="text-[11px] font-semibold whitespace-nowrap">Sure?</span>}
      </button>
    </div>
  )
}

// Entry point for real bank accounts: opens Plaid Link, exchanges the result
// for stored accounts/debts, and lists what's already connected. Degrades
// quietly (no broken button) if the server hasn't been given Plaid API keys
// yet — see supabase/functions/_shared/plaidClient.ts for setup.
export default function ConnectBank({ onConnected }) {
  const [connections, setConnections] = useState([])
  const [linkToken, setLinkToken] = useState(null)
  const [starting, setStarting] = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [syncingId, setSyncingId] = useState(null)
  const [error, setError] = useState(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setConnections(await listPlaidConnections())
    } catch {
      // Non-fatal — the manual account list still works without this.
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setExchanging(true)
      setError(null)
      try {
        await exchangePlaidPublicToken({
          publicToken,
          institutionId: metadata?.institution?.institution_id,
          institutionName: metadata?.institution?.name,
        })
        await refresh()
        onConnected?.()
      } catch (caught) {
        setError(caught.message || 'Could not finish connecting this bank.')
      } finally {
        setExchanging(false)
        setLinkToken(null)
      }
    },
    onExit: () => setLinkToken(null),
  })

  useEffect(() => { if (ready && linkToken) open() }, [ready, linkToken, open])

  async function startLink() {
    setError(null)
    setNotConfigured(false)
    setStarting(true)
    try {
      setLinkToken(await createPlaidLinkToken())
    } catch (caught) {
      if (caught.notConfigured) setNotConfigured(true)
      else setError(caught.message || 'Could not start the bank connection.')
    } finally {
      setStarting(false)
    }
  }

  async function handleSync(id) {
    setSyncingId(id)
    setError(null)
    try {
      await syncPlaidAccounts(id)
      await refresh()
      onConnected?.()
    } catch (caught) {
      setError(caught.message || 'Could not refresh this bank.')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleDisconnect(id) {
    setSyncingId(id)
    setError(null)
    try {
      await removePlaidConnection(id)
      await refresh()
      onConnected?.()
    } catch (caught) {
      setError(caught.message || 'Could not disconnect this bank.')
    } finally {
      setSyncingId(null)
    }
  }

  const busy = starting || exchanging

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.06] p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-white"><Landmark className="h-4 w-4 text-emerald-200" /> Connect a real bank</p>
          <p className="mt-1 text-[13px] leading-5 text-readable-secondary">Securely link an account through Plaid — balances sync automatically. Your login is never seen or stored by Garden Financial.</p>
        </div>
      </div>

      {notConfigured && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-xs leading-5 text-readable-muted">
          Bank linking isn't set up on this server yet — an admin needs to add Plaid API keys. Manual accounts below still work normally.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3.5 py-3 text-[13px] leading-5 text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {connections.length > 0 && (
        <div className="space-y-2">
          {connections.map(connection => (
            <ConnectionRow key={connection.id} connection={connection} onSync={handleSync} onDisconnect={handleDisconnect} busy={syncingId === connection.id} />
          ))}
        </div>
      )}

      {!notConfigured && (
        <button type="button" onClick={startLink} disabled={busy} className="btn-primary min-h-11 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {exchanging ? 'Connecting your accounts…' : starting ? 'Opening…' : connections.length ? 'Connect another bank' : 'Connect a bank'}
        </button>
      )}
    </div>
  )
}
