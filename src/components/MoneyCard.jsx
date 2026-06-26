import { useState, useRef } from 'react'
import { Wallet, Pencil, Check, X, Plus, Trash2, CreditCard, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Layers } from 'lucide-react'

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`

// Fidelity-style allocation donut (SVG ring → transparent center on glass).
function AllocationDonut({ parts, size = 52, stroke = 9 }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      {total > 0 && parts.map((p, i) => {
        if (!p.value) return null
        const len = (p.value / total) * c
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={p.color} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
        )
        offset += len
        return el
      })}
    </svg>
  )
}

// One inline-editable money figure. Commits on Enter, the check button, OR blur
// (tabbing/clicking away) so a typed value is never silently lost. Escape cancels.
function EditableStat({ label, value, onSave, color = 'text-white', prefix = '$' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value ?? 0))
  const cancelled = useRef(false)

  function commit() {
    const n = parseFloat(val)
    onSave(isNaN(n) ? 0 : Math.max(0, n))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-1">{label}</div>
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-white/[0.085] border border-emerald-400/50 rounded-lg px-2 py-1 flex-1 min-w-0">
            {prefix && <span className="text-white/40 text-sm">{prefix}</span>}
            <input autoFocus type="number" inputMode="decimal" value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { cancelled.current = true; setEditing(false) } }}
              onBlur={() => { if (cancelled.current) { cancelled.current = false; return } commit() }}
              className="w-full bg-transparent text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <button onMouseDown={e => e.preventDefault()} onClick={commit} aria-label="Save" className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => { setVal(String(value ?? 0)); setEditing(true) }}
      className="min-w-0 text-left group">
      <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-1 flex items-center gap-1">
        {label}
        <Pencil className="w-2.5 h-2.5 text-white/0 group-hover:text-white/30 transition-colors" />
      </div>
      <div className={`text-base md:text-lg font-bold tabular-nums leading-tight ${color}`}>{fmt(value)}</div>
    </button>
  )
}

// Read-only stat (the Investments total once it's split across accounts). Tapping
// it opens the advanced panel where the itemized accounts are edited.
function StaticStat({ label, value, color = 'text-white', onClick }) {
  return (
    <button onClick={onClick} className="min-w-0 text-left group">
      <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-1 flex items-center gap-1">
        {label}
        <Layers className="w-2.5 h-2.5 text-violet-300/60 group-hover:text-violet-300 transition-colors" />
      </div>
      <div className={`text-base md:text-lg font-bold tabular-nums leading-tight ${color}`}>{fmt(value)}</div>
    </button>
  )
}

const QUICK_NAMES = ['Roth IRA', 'Traditional IRA', '401(k)', 'Brokerage', 'HSA']

// One investment account row — name + balance editable inline (commit on blur).
function InvestRow({ account, onUpdate, onDelete }) {
  const [name, setName] = useState(account.name ?? '')
  const [bal, setBal]   = useState(String(account.balance ?? 0))
  return (
    <div className="flex items-center gap-2">
      <input value={name} onChange={e => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== account.name) onUpdate(account.id, { name }) }}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-white/[0.095] bg-white/[0.065] text-white/90 text-sm focus:outline-none focus:border-violet-400/40 transition-colors" />
      <div className="flex items-center bg-white/[0.065] border border-white/[0.095] rounded-lg px-2 py-1.5 w-24 focus-within:border-violet-400/40 transition-colors">
        <span className="text-white/40 text-sm">$</span>
        <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)}
          onBlur={() => { const n = parseFloat(bal); if (!isNaN(n) && n !== Number(account.balance)) onUpdate(account.id, { balance: n }) }}
          className="w-full min-w-0 bg-transparent text-sm font-semibold text-violet-200 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </div>
      <button type="button" onClick={() => onDelete(account.id)} aria-label="Remove account"
        className="p-1 text-white/25 hover:text-rose-400 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// Advanced panel: itemize investment accounts. Each is an accounts row (type
// 'brokerage', named); the Investments total above is their sum.
function InvestmentsPanel({ accounts, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState('')
  const [bal, setBal]   = useState('')

  function add() {
    const b = parseFloat(bal)
    if (!name.trim() || isNaN(b) || b < 0) return
    onAdd({ name: name.trim(), balance: b })
    setName(''); setBal('')
  }

  return (
    <div className="mt-2.5 rounded-xl bg-white/[0.045] border border-white/[0.10] p-3 space-y-2.5">
      {accounts.length > 0 && (
        <div className="space-y-1.5">
          {accounts.map(a => <InvestRow key={a.id} account={a} onUpdate={onUpdate} onDelete={onDelete} />)}
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_NAMES.map(n => (
          <button key={n} type="button" onClick={() => setName(n)}
            className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              name === n ? 'border-violet-400/60 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-white/[0.065] text-white/55 hover:text-white/85'}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Account name"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-white/[0.11] bg-white/[0.085] text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-400/30" />
        <div className="flex items-center bg-white/[0.085] border border-white/[0.11] rounded-lg px-2 py-1.5 w-24">
          <span className="text-white/40 text-sm">$</span>
          <input type="number" inputMode="decimal" value={bal} onChange={e => setBal(e.target.value)} placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            className="w-full min-w-0 bg-transparent text-sm text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        <button type="button" onClick={add} disabled={!name.trim() || bal === '' || !(parseFloat(bal) >= 0)}
          className="p-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg transition-colors flex-shrink-0"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[11px] text-white/35">Add each account you hold — your advisor sees them all, and the Investments total updates automatically.</p>
    </div>
  )
}

// Compact "Your money" card — ingrained budget. Monthly income/expenses → surplus,
// a single net-worth number, and a simple debts list. Feeds the advisor + the
// garden's weather. Not a tab.
export default function MoneyCard({ income, expenses, netWorth, balances = {}, debts = [], investAccounts = [], onSaveMoney, onSaveTypeBalance, onAddInvest, onUpdateInvest, onDeleteInvest, onAddDebt, onDeleteDebt }) {
  const surplus = Number(income || 0) - Number(expenses || 0)
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const [open, setOpen] = useState(false)
  const [showInvest, setShowInvest] = useState(false)
  const [addingDebt, setAddingDebt] = useState(false)
  const [dName, setDName] = useState('')
  const [dBal, setDBal] = useState('')
  // Investments are "itemized" once there are 2+ accounts — then the top stat is
  // a read-only total and all editing happens in the advanced panel.
  const itemized = investAccounts.length >= 2

  function submitDebt(e) {
    e.preventDefault()
    const bal = parseFloat(dBal)
    if (!dName.trim() || isNaN(bal)) return
    onAddDebt({ name: dName.trim(), balance: bal })
    setDName(''); setDBal(''); setAddingDebt(false)
  }

  return (
    <div className="bg-white/[0.075] rounded-2xl border border-white/[0.11] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 bg-white/[0.045] hover:bg-white/[0.075] transition-colors ${open ? 'border-b border-white/10' : ''}`}>
        <Wallet className="w-4 h-4 text-emerald-300 flex-shrink-0" />
        <span className="text-sm font-semibold text-white">Your money</span>
        {!open && (
          <span className="ml-auto flex items-center gap-2 text-[11px] tabular-nums">
            <span className={surplus >= 0 ? 'text-sky-300' : 'text-rose-300'}>{surplus < 0 ? '-' : '+'}{fmt(Math.abs(surplus))}/mo</span>
            <span className="text-white/30">·</span>
            <span className="text-white/70">{fmt(netWorth)} net</span>
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-white/40 ml-auto" /> : <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />}
      </button>

      {open && (<>
      {/* Income · Expenses · Surplus */}
      <div className="grid grid-cols-3 gap-3 px-4 py-3.5">
        <EditableStat label="Income / mo"   value={income}   onSave={v => onSaveMoney({ monthly_income: v })}   color="text-emerald-300" />
        <EditableStat label="Expenses / mo" value={expenses} onSave={v => onSaveMoney({ monthly_expenses: v })} color="text-rose-300" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-1">Surplus / mo</div>
          <div className={`text-base md:text-lg font-bold tabular-nums leading-tight flex items-center gap-1 ${surplus >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>
            {surplus >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {surplus < 0 ? '-' : ''}{fmt(Math.abs(surplus))}
          </div>
        </div>
      </div>

      {/* Accounts by type — donut + editable amounts (feeds the advisor) */}
      <div className="px-4 pb-2 pt-2 border-t border-white/[0.095]">
        <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-2">Accounts</div>
        <div className="flex items-center gap-3.5">
          <AllocationDonut parts={[
            { value: Number(balances.checking) || 0,  color: '#38bdf8' },
            { value: Number(balances.savings) || 0,   color: '#34d399' },
            { value: Number(balances.brokerage) || 0, color: '#a78bfa' },
          ]} />
          <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
            <EditableStat label="Checking"    value={balances.checking}  onSave={v => onSaveTypeBalance('checking', v)}  color="text-sky-200" />
            <EditableStat label="Savings"     value={balances.savings}   onSave={v => onSaveTypeBalance('savings', v)}   color="text-emerald-200" />
            {itemized
              ? <StaticStat label="Investments" value={balances.brokerage} color="text-violet-200" onClick={() => setShowInvest(true)} />
              : <EditableStat label="Investments" value={balances.brokerage} onSave={v => onSaveTypeBalance('brokerage', v)} color="text-violet-200" />}
          </div>
        </div>

        {/* Advanced — itemize investment accounts (Roth IRA, 401k, brokerage…) */}
        <button onClick={() => setShowInvest(s => !s)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-300/80 hover:text-violet-200 transition-colors">
          <Layers className="w-3 h-3" />
          {showInvest ? 'Hide investment accounts' : 'Advanced — add investment accounts'}
          {showInvest ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showInvest && (
          <InvestmentsPanel
            accounts={investAccounts}
            onAdd={onAddInvest} onUpdate={onUpdateInvest} onDelete={onDeleteInvest} />
        )}
      </div>

      {/* Net worth */}
      <div className="px-4 pb-3 pt-1 border-t border-white/[0.095]">
        <EditableStat label="Net worth" value={netWorth}
          onSave={v => onSaveMoney({ net_worth: v })}
          color={Number(netWorth) >= 0 ? 'text-white' : 'text-rose-300'} />
      </div>

      {/* Debts */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/[0.035]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-white/45" /> Debts
            {totalDebt > 0 && <span className="text-rose-300 tabular-nums">· {fmt(totalDebt)}</span>}
          </span>
          {!addingDebt && (
            <button onClick={() => setAddingDebt(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {debts.length > 0 && (
          <div className="space-y-1 mb-2">
            {debts.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm group/d">
                <span className="text-white/80 truncate">{d.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-rose-300 tabular-nums font-medium">{fmt(d.balance)}</span>
                  <button onClick={() => onDeleteDebt(d.id)} aria-label="Remove debt"
                    className="p-1 text-white/25 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {addingDebt ? (
          <form onSubmit={submitDebt} className="flex gap-2 items-center">
            <input autoFocus value={dName} onChange={e => setDName(e.target.value)} placeholder="e.g. Visa"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-white/[0.11] bg-white/[0.085] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            <div className="flex items-center bg-white/[0.085] border border-white/[0.11] rounded-lg px-2 py-1.5 w-24">
              <span className="text-white/40 text-sm">$</span>
              <input type="number" inputMode="decimal" value={dBal} onChange={e => setDBal(e.target.value)} placeholder="0"
                className="w-full bg-transparent text-sm text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <button type="submit" className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"><Check className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setAddingDebt(false)} className="p-1.5 text-white/40 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </form>
        ) : debts.length === 0 && (
          <p className="text-[11px] text-white/35">No debts tracked — nice. Add any loans or cards so your advisor can plan payoff.</p>
        )}
      </div>
      </>)}
    </div>
  )
}
