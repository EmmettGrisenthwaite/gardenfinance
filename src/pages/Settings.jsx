import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getMemories, deleteMemory, createMemory } from '@/lib/memory'
import Onboarding from '@/components/Onboarding'
import {
  ChevronLeft, UserCircle, Pencil, Wallet, ArrowRight, Download, ShieldCheck,
  LogOut, Trash2, Loader2, Brain, X, Plus,
} from 'lucide-react'

const APP_VERSION = '1.0'

const EMPLOYMENT = { w2: 'Salaried / W-2', freelance: 'Freelance / self-employed', student: 'Student', other: 'Other' }
const GOALS = {
  emergency_fund: 'Build emergency fund', pay_debt: 'Pay off debt', start_investing: 'Start investing',
  major_purchase: 'Save for a major purchase', optimize: 'Optimize finances', organize: 'Get organized',
}

const CATEGORY_LABELS = {
  income: 'Income', employment: 'Employment', life_event: 'Life Event',
  risk_preference: 'Risk', goal: 'Goal', debt: 'Debt',
  family: 'Family', health: 'Health', investment: 'Investment', other: 'Other',
}

const CATEGORY_COLORS = {
  income: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
  employment: 'bg-blue-500/15 text-blue-300 border-blue-400/25',
  life_event: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
  risk_preference: 'bg-purple-500/15 text-purple-300 border-purple-400/25',
  goal: 'bg-orange-500/15 text-orange-300 border-orange-400/25',
  debt: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
  family: 'bg-pink-500/15 text-pink-300 border-pink-400/25',
  health: 'bg-red-500/15 text-red-300 border-red-400/25',
  investment: 'bg-sky-500/15 text-sky-300 border-sky-400/25',
  other: 'bg-white/10 text-white/50 border-white/15',
}

function Row({ icon: Icon, title, sub, onClick, to, danger, busy, trailing }) {
  const cls = `w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
    danger ? 'hover:bg-rose-500/10' : 'hover:bg-white/[0.04]'}`
  const inner = (
    <>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        danger ? 'bg-rose-500/15 text-rose-300' : 'bg-white/[0.06] text-emerald-300'}`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-semibold ${danger ? 'text-rose-200' : 'text-white'}`}>{title}</span>
        {sub && <span className="block text-xs text-white/45 truncate">{sub}</span>}
      </span>
      {trailing}
    </>
  )
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button onClick={onClick} disabled={busy} className={cls}>{inner}</button>
}

function Card({ label, children }) {
  return (
    <div>
      {label && <div className="text-[10px] font-semibold text-white/45 uppercase tracking-wide px-1 mb-1.5">{label}</div>}
      <div className="bg-white/[0.05] rounded-2xl border border-white/[0.10] overflow-hidden divide-y divide-white/[0.06]">
        {children}
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [editProfile, setEditProfile] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [memories, setMemories] = useState([])
  const [memoriesLoading, setMemoriesLoading] = useState(true)
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [newFact, setNewFact] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [addingMemory, setAddingMemory] = useState(false)
  const [deletingMemory, setDeletingMemory] = useState(null)
  const [operationError, setOperationError] = useState(null)

  const name = user.user_metadata?.full_name || profile?.first_name || 'there'
  const bits = [
    profile?.age && `${profile.age}`,
    profile?.employment_type && EMPLOYMENT[profile.employment_type],
    profile?.primary_goal && GOALS[profile.primary_goal],
  ].filter(Boolean)

  useEffect(() => {
    loadMemories()
  }, [])

  async function loadMemories() {
    setMemoriesLoading(true)
    try {
      const m = await getMemories()
      setMemories(m)
    } catch (err) {
      setOperationError(err.message ?? 'Could not load advisor memories.')
    } finally {
      setMemoriesLoading(false)
    }
  }

  async function handleAddMemory() {
    if (!newFact.trim()) return
    setAddingMemory(true)
    setOperationError(null)
    try {
      const created = await createMemory(newFact.trim(), newCategory)
      if (!created) throw new Error('Could not save that memory.')
      setNewFact('')
      setNewCategory('other')
      setShowAddMemory(false)
      await loadMemories()
    } catch (err) {
      setOperationError(err.message ?? 'Could not save that memory.')
    } finally {
      setAddingMemory(false)
    }
  }

  async function handleDeleteMemory(id) {
    setDeletingMemory(id)
    setOperationError(null)
    try {
      await deleteMemory(id)
      await loadMemories()
    } catch (err) {
      setOperationError(err.message ?? 'Could not forget that memory.')
    } finally {
      setDeletingMemory(null)
    }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setOperationError(signOutError.message ?? 'Could not sign out.')
      return
    }
    navigate('/login')
  }

  async function exportData() {
    setExporting(true)
    setOperationError(null)
    try {
      const uid = user.id
      const [g, d, a, p, c, s, m, bl, cf, r, re] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', uid),
        supabase.from('debts').select('*').eq('user_id', uid),
        supabase.from('accounts').select('*').eq('user_id', uid),
        supabase.from('advisor_plans').select('*').eq('user_id', uid),
        supabase.from('conversations').select('*').eq('user_id', uid),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', uid),
        supabase.from('advisor_memories').select('*').eq('user_id', uid),
        supabase.from('budget_limits').select('*').eq('user_id', uid),
        supabase.from('cash_flow_items').select('*').eq('user_id', uid),
        supabase.from('reminders').select('*').eq('user_id', uid),
        supabase.from('reminder_events').select('*').eq('user_id', uid),
      ])
      const failed = [g, d, a, p, c, s, m, bl, cf, r, re].find(result => result.error)
      if (failed) throw failed.error
      const payload = {
        exported_at: new Date().toISOString(),
        account: { email: user.email, name },
        profile, goals: g.data ?? [], debts: d.data ?? [], accounts: a.data ?? [],
        plans: p.data ?? [], conversations: c.data ?? [], net_worth_snapshots: s.data ?? [],
        memories: m.data ?? [], budget_limits: bl.data ?? [], cash_flow_items: cf.data ?? [],
        reminders: r.data ?? [], reminder_events: re.data ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `garden-financial-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setOperationError(err.message ?? 'Could not export your data.')
    } finally { setExporting(false) }
  }

  async function deleteEverything() {
    setDeleting(true)
    setOperationError(null)
    const uid = user.id
    try {
      const results = await Promise.all([
        supabase.from('goals').delete().eq('user_id', uid),
        supabase.from('debts').delete().eq('user_id', uid),
        supabase.from('accounts').delete().eq('user_id', uid),
        supabase.from('advisor_plans').delete().eq('user_id', uid),
        supabase.from('conversations').delete().eq('user_id', uid),
        supabase.from('net_worth_snapshots').delete().eq('user_id', uid),
        supabase.from('advisor_memories').delete().eq('user_id', uid),
        supabase.from('budget_limits').delete().eq('user_id', uid),
        supabase.from('cash_flow_items').delete().eq('user_id', uid),
        // Reminder events are removed by the reminder table's ON DELETE CASCADE.
        supabase.from('reminders').delete().eq('user_id', uid),
        supabase.from('profiles').delete().eq('id', uid),
      ])
      const failed = results.find(result => result.error)
      if (failed) throw failed.error
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      navigate('/login')
    } catch (err) {
      setOperationError(err.message ?? 'Some data could not be deleted. Nothing was hidden; please retry.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto w-full px-4 pb-10"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="p-1.5 -ml-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-[22px] font-medium text-white">Settings</h1>
      </div>

      {operationError && (
        <p className="mb-4 text-xs text-rose-200 bg-rose-500/15 border border-rose-400/25 px-3 py-2 rounded-lg">
          {operationError}
        </p>
      )}

      <div className="space-y-5">
        {/* Account */}
        <Card label="Account">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-11 h-11 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-6 h-6 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{name}</div>
              <div className="text-xs text-white/45 truncate">{user.email}</div>
            </div>
          </div>
          <Row icon={Pencil} title="Edit your profile"
            sub={bits.length ? bits.join(' · ') : 'Age, work, goals — powers your advisor'}
            onClick={() => setEditProfile(true)}
            trailing={<ArrowRight className="w-4 h-4 text-white/30" />} />
          <Row icon={Wallet} title="Your money" sub="Income, accounts, assets & debts"
            to="/money" trailing={<ArrowRight className="w-4 h-4 text-white/30" />} />
        </Card>

        {/* What your advisor remembers */}
        <Card label="What your advisor remembers">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-emerald-300" />
              <span className="text-sm text-white/70">
                {memories.length} fact{memories.length !== 1 ? 's' : ''} remembered
              </span>
            </div>

            {memoriesLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                <span className="text-xs text-white/40">Loading memories…</span>
              </div>
            ) : memories.length === 0 ? (
              <p className="text-xs text-white/40 py-1">
                Your advisor hasn't learned anything about you yet. Chat with it and it'll remember durable facts.
              </p>
            ) : (
              <div className="space-y-2">
                {memories.map((mem) => (
                  <motion.div
                    key={mem.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-2 group"
                  >
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
                      CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.other
                    }`}>
                      {CATEGORY_LABELS[mem.category] || 'Other'}
                    </span>
                    <span className="text-sm text-white/70 flex-1 min-w-0">{mem.fact}</span>
                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      disabled={deletingMemory === mem.id}
                      aria-label={`Forget memory: ${mem.fact}`}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-white/40 hover:text-rose-300 flex-shrink-0"
                      title="Forget this memory"
                    >
                      {deletingMemory === mem.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Add memory */}
            <AnimatePresence>
              {showAddMemory ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2"
                >
                  <textarea
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    placeholder="e.g., My employer matches 4% on my 401k"
                    rows={2}
                    className="w-full bg-white/[0.06] border border-white/[0.12] rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/40 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-emerald-400/40"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddMemory}
                      disabled={addingMemory || !newFact.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {addingMemory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddMemory(false)}
                      className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowAddMemory(true)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300/70 hover:text-emerald-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add a memory manually
                </button>
              )}
            </AnimatePresence>
          </div>
        </Card>

        {/* Data & privacy */}
        <Card label="Data & privacy">
          <Row icon={Download} title="Export my data" sub="Download everything as JSON"
            onClick={exportData} busy={exporting}
            trailing={!exporting && <ArrowRight className="w-4 h-4 text-white/30" />} />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="w-8 h-8 rounded-lg bg-white/[0.06] text-sky-300 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <p className="text-xs text-white/50 leading-relaxed">
              Your data is private to your account. Garden Financial offers educational
              guidance — it isn't a substitute for a licensed financial planner.
            </p>
          </div>
        </Card>

        {/* Session */}
        <Card>
          <Row icon={LogOut} title="Sign out" onClick={signOut} />
        </Card>

        {/* Danger zone */}
        <Card label="Danger zone">
          {!confirmDelete ? (
            <Row icon={Trash2} title="Delete app data" sub="Permanently erase your Garden data" danger
              onClick={() => setConfirmDelete(true)} />
          ) : (
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-rose-100 font-medium">Delete all Garden data?</p>
              <p className="text-xs text-white/55 leading-relaxed">
                This permanently deletes your profile, money, goals, debts, plans, advisor
                history, and memories from this app, then signs you out. Your Supabase login
                remains available. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button onClick={deleteEverything} disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting…' : 'Delete app data'}
                </button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-[11px] text-white/25 pt-1">Garden Financial · v{APP_VERSION}</p>
      </div>

      {editProfile && <Onboarding profileOnly onClose={() => setEditProfile(false)} />}
    </motion.div>
  )
}
