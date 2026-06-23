import { useState } from 'react'
import { Wallet, Pencil, Check, X, Plus, Trash2, CreditCard, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'

const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`

// One inline-editable money figure.
function EditableStat({ label, value, onSave, color = 'text-white', prefix = '$' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value ?? 0))

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
          <div className="flex items-center bg-white/[0.06] border border-emerald-400/50 rounded-lg px-2 py-1 flex-1 min-w-0">
            {prefix && <span className="text-white/40 text-sm">{prefix}</span>}
            <input autoFocus type="number" inputMode="decimal" value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full bg-transparent text-sm font-bold text-white tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <button onClick={commit} aria-label="Save" className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
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

// Compact "Your money" card — ingrained budget. Monthly income/expenses → surplus,
// a single net-worth number, and a simple debts list. Feeds the advisor + the
// garden's weather. Not a tab.
export default function MoneyCard({ income, expenses, netWorth, balances = {}, debts = [], onSaveMoney, onSaveTypeBalance, onAddDebt, onDeleteDebt }) {
  const surplus = Number(income || 0) - Number(expenses || 0)
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0)
  const [open, setOpen] = useState(false)
  const [addingDebt, setAddingDebt] = useState(false)
  const [dName, setDName] = useState('')
  const [dBal, setDBal] = useState('')

  function submitDebt(e) {
    e.preventDefault()
    const bal = parseFloat(dBal)
    if (!dName.trim() || isNaN(bal)) return
    onAddDebt({ name: dName.trim(), balance: bal })
    setDName(''); setDBal(''); setAddingDebt(false)
  }

  return (
    <div className="bg-white/[0.055] rounded-2xl border border-white/[0.08] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors ${open ? 'border-b border-white/10' : ''}`}>
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

      {/* Accounts by type — feeds the advisor (liquid cash vs invested) */}
      <div className="px-4 pb-2 pt-2 border-t border-white/[0.06]">
        <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-2">Accounts</div>
        <div className="grid grid-cols-3 gap-3">
          <EditableStat label="Checking"    value={balances.checking}  onSave={v => onSaveTypeBalance('checking', v)}  color="text-sky-200" />
          <EditableStat label="Savings"     value={balances.savings}   onSave={v => onSaveTypeBalance('savings', v)}   color="text-emerald-200" />
          <EditableStat label="Investments" value={balances.brokerage} onSave={v => onSaveTypeBalance('brokerage', v)} color="text-violet-200" />
        </div>
      </div>

      {/* Net worth */}
      <div className="px-4 pb-3 pt-1 border-t border-white/[0.06]">
        <EditableStat label="Net worth" value={netWorth}
          onSave={v => onSaveMoney({ net_worth: v })}
          color={Number(netWorth) >= 0 ? 'text-white' : 'text-rose-300'} />
      </div>

      {/* Debts */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/[0.015]">
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
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/30" />
            <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 w-24">
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
