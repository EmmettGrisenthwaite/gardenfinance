import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Sprout, LayoutDashboard, Target, CreditCard, DollarSign, Bot, LogOut, Wallet, ClipboardList } from 'lucide-react'
import Onboarding from '@/components/Onboarding'

const NAV_ITEMS = [
  { to: '/',        label: 'Garden',  icon: LayoutDashboard },
  { to: '/budget',  label: 'Budget',  icon: DollarSign },
  { to: '/goals',   label: 'Goals',   icon: Target },
  { to: '/debt',    label: 'Debt',    icon: CreditCard },
  { to: '/accounts',label: 'Accounts',icon: Wallet },
  { to: '/advisor', label: 'Advisor', icon: Bot },
  { to: '/plan',    label: 'Plan',    icon: ClipboardList },
]

// Bottom HUD shows 5 items (Accounts is in the sidebar & mobile header)
const HUD_ITEMS = [
  { to: '/',        label: 'Garden',  icon: LayoutDashboard },
  { to: '/goals',   label: 'Goals',   icon: Target },
  { to: '/advisor', label: 'Advisor', icon: Bot },
  { to: '/plan',    label: 'Plan',    icon: ClipboardList },
  { to: '/budget',  label: 'Budget',  icon: DollarSign },
]

export default function Layout({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const needsOnboarding = profile === null && !loading
  // Immersive, full-height pages manage their own scroll and run edge-to-edge
  // (no main padding): the garden dashboard and the advisor chat.
  const isGarden    = pathname === '/'
  const isImmersive = isGarden || pathname === '/advisor'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="relative min-h-screen">
      {needsOnboarding && <Onboarding />}

      {/* ── Premium ambient background ── */}
      <div
        className="fixed inset-0 z-0 overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #020c05 0%, #031508 30%, #04101a 60%, #030b14 100%)' }}
      >
        {/* Orb 1 — soft emerald, top-left (single-hue palette keeps it calm) */}
        <div
          className="absolute rounded-full animate-orb-1 pointer-events-none"
          style={{
            top: '-25%', left: '-20%',
            width: '75%', height: '75%',
            background: 'radial-gradient(circle at center, rgba(16,185,129,0.16) 0%, transparent 68%)',
            filter: 'blur(48px)',
          }}
        />
        {/* Orb 2 — deep sage, bottom-right */}
        <div
          className="absolute rounded-full animate-orb-2 pointer-events-none"
          style={{
            bottom: '-30%', right: '-20%',
            width: '70%', height: '70%',
            background: 'radial-gradient(circle at center, rgba(52,153,124,0.13) 0%, transparent 68%)',
            filter: 'blur(48px)',
          }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Top & bottom vignette */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/25 via-transparent to-black/35" />
      </div>

      {/* ── UI layer: app shell fills the viewport; pages scroll inside main ── */}
      <div className="relative z-10 flex h-dvh">

        {/* ── Desktop glass sidebar ── */}
        <aside className="hidden md:flex w-56 shrink-0 p-3">
          <div className="flex flex-col w-full h-full bg-white/15 backdrop-blur-xl rounded-2xl border border-white/25 shadow-2xl overflow-hidden">

            {/* Logo */}
            <div className="px-4 py-4 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-green-500/90 rounded-xl flex items-center justify-center shadow-lg">
                  <Sprout className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-display font-semibold text-white text-[15px] tracking-tight drop-shadow">Garden Financial</div>
                  <div className="text-[10px] text-white/55">Grow your wealth</div>
                </div>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/30 text-white shadow-sm'
                        : 'text-white/65 hover:bg-white/15 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* User + logout */}
            <div className="p-2 border-t border-white/15">
              <div className="text-[10px] text-white/40 truncate px-3 mb-1">{user?.email}</div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/55 hover:bg-white/15 hover:text-white w-full transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Content column ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Mobile top bar */}
          <header className="md:hidden flex-shrink-0 px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-500/90 rounded-lg flex items-center justify-center shadow">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-semibold text-white text-[15px] tracking-tight drop-shadow">Garden Financial</span>
            </div>
            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `p-2 rounded-xl transition-all backdrop-blur-sm ${
                  isActive
                    ? 'bg-white/30 text-white'
                    : 'text-white/60 hover:bg-white/20 hover:text-white'
                }`
              }
            >
              <Wallet className="w-5 h-5" />
            </NavLink>
          </header>

          {/* Page content — immersive pages (garden, advisor) are full-bleed and
              own their scroll; other pages keep clearance for the floating nav */}
          <main className={`flex-1 min-h-0 ${isImmersive ? 'overflow-hidden' : 'overflow-auto pb-28 md:pb-6'}`}>
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile HUD: floating pill nav ── */}
      <nav
        className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/15 px-2 py-1.5"
          style={{ boxShadow: '0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)' }}>
          {HUD_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-b from-green-400/25 to-emerald-500/10 ring-1 ring-green-300/30 text-white'
                    : 'text-white/45 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 transition-all duration-200 ${
                    isActive ? 'text-green-300 scale-110 drop-shadow-[0_0_6px_rgba(134,239,172,0.6)]' : ''}`} />
                  <span className={`text-[8.5px] font-bold tracking-widest transition-all duration-200 ${
                    isActive ? 'text-green-100' : 'text-white/45'}`}>
                    {label.toUpperCase()}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
