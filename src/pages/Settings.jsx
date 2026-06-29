import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Onboarding from '@/components/Onboarding'
import {
  ChevronLeft, UserCircle, Pencil, Wallet, ArrowRight, Download, ShieldCheck,
  LogOut, Trash2, Loader2,
} from 'lucide-react'

const APP_VERSION = '1.0'

const EMPLOYMENT = { w2: 'Salaried / W-2', freelance: 'Freelance / self-employed', student: 'Student', other: 'Other' }
const GOALS = {
  emergency_fund: 'Build emergency fund', pay_debt: 'Pay off debt', start_investing: 'Start investing',
  major_purchase: 'Save for a major purchase', optimize: 'Optimize finances', organize: 'Get organized',
}

// One labelled row inside a settings card.
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
  // Go back if there's somewhere to go, else home — keeps a cold-started PWA /
  // deep link from trying to navigate out of the app on the back button.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))
  const [editProfile, setEditProfile] = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  const name  = user.user_metadata?.full_name || profile?.first_name || 'there'
  const bits  = [
    profile?.age && `${profile.age}`,
    profile?.employment_type && EMPLOYMENT[profile.employment_type],
    profile?.primary_goal && GOALS[profile.primary_goal],
  ].filter(Boolean)

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function exportData() {
    setExporting(true)
    try {
      const uid = user.id
      const [g, d, a, p, c, s, b] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', uid),
        supabase.from('debts').select('*').eq('user_id', uid),
        supabase.from('accounts').select('*').eq('user_id', uid),
        supabase.from('advisor_plans').select('*').eq('user_id', uid),
        supabase.from('conversations').select('*').eq('user_id', uid),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', uid),
        supabase.from('budgets').select('*').eq('user_id', uid),
      ])
      const payload = {
        exported_at: new Date().toISOString(),
        account: { email: user.email, name },
        profile, goals: g.data ?? [], debts: d.data ?? [], accounts: a.data ?? [],
        plans: p.data ?? [], conversations: c.data ?? [], net_worth_snapshots: s.data ?? [],
        budgets: b.data ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `garden-financial-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  async function deleteEverything() {
    setDeleting(true)
    const uid = user.id
    try {
      await Promise.allSettled([
        supabase.from('goals').delete().eq('user_id', uid),
        supabase.from('debts').delete().eq('user_id', uid),
        supabase.from('accounts').delete().eq('user_id', uid),
        supabase.from('advisor_plans').delete().eq('user_id', uid),
        supabase.from('conversations').delete().eq('user_id', uid),
        supabase.from('net_worth_snapshots').delete().eq('user_id', uid),
        supabase.from('budgets').delete().eq('user_id', uid),
        supabase.from('profiles').delete().eq('id', uid),
      ])
    } catch { /* best-effort */ }
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto w-full px-4 pt-2 pb-10">

      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={goBack} aria-label="Back"
          className="p-2 -ml-2 rounded-lg text-white/55 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-[22px] font-medium text-white">Settings</h1>
      </div>

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
              guidance — it isn’t a substitute for a licensed financial planner.
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
            <Row icon={Trash2} title="Delete account" sub="Permanently erase all your data" danger
              onClick={() => setConfirmDelete(true)} />
          ) : (
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-rose-100 font-medium">Delete everything?</p>
              <p className="text-xs text-white/55 leading-relaxed">
                This permanently deletes your profile, money, goals, debts, plans, and advisor
                history, then signs you out. This can’t be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button onClick={deleteEverything} disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting…' : 'Delete forever'}
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
