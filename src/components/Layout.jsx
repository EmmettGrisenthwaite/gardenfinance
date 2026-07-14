import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Sprout, LayoutDashboard, Target, Bot, Settings, Wallet } from 'lucide-react'
import Onboarding from '@/components/Onboarding'

// Four focused tabs. Money is a first-class part of setup because the Plan and
// Advisor both become more useful once the user's real numbers are entered.
const NAV_ITEMS = [
  { to: '/',        label: 'Garden',  icon: LayoutDashboard },
  { to: '/money',   label: 'Money',   icon: Wallet },
  { to: '/advisor', label: 'Advisor', icon: Bot },
  { to: '/plan',    label: 'Plan',    icon: Target },
]
const HUD_ITEMS = NAV_ITEMS

export default function Layout({ children }) {
  const { user, profile, loading, profileError, refreshProfile } = useAuth()
  const { pathname } = useLocation()
  const needsOnboarding = profile === null && !loading && !profileError
  // Immersive, full-height pages manage their own scroll and run edge-to-edge
  // (no main padding): the garden dashboard and the advisor chat.
  const isGarden    = pathname === '/'
  const isImmersive = isGarden || pathname === '/advisor'
  // Secondary pages reached from the gear / links — back-button navigation, so
  // the floating tab bar is hidden (it would imply they're top-level tabs).
  // A step's detail page is one of these: its back button returns to the Plan.
  const isSubPage   = pathname === '/settings' || pathname.startsWith('/plan/step/')
  // Top-level tabs keep the dock; only secondary routes hide it. Advisor uses
  // the shared dock-clearance variable so its composer stays above the dock.
  const hideNav     = isSubPage

  // Hide the floating nav while a text field is focused (mobile keyboard up) so
  // it never covers an input's save button. Focus events alone are fragile —
  // tapping a button between two fields (e.g. an inline "add row") blurs the
  // field for a tick before the next one focuses, which used to pop the nav
  // back up mid-entry. Debounce the "show again" transition, and back it with
  // window.visualViewport, which is the actual signal for "keyboard is open."
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(el.type)))

    let showTimer = null
    const hide = () => { clearTimeout(showTimer); setTyping(true) }
    const scheduleShow = () => {
      clearTimeout(showTimer)
      showTimer = setTimeout(() => { if (!isField(document.activeElement)) setTyping(false) }, 250)
    }

    const onIn  = e => { if (isField(e.target)) hide() }
    const onOut = () => scheduleShow()
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)

    const vv = window.visualViewport
    const onViewportResize = () => {
      if (!vv) return
      const keyboardOpen = window.innerHeight - vv.height > 120
      if (keyboardOpen) hide(); else scheduleShow()
    }
    vv?.addEventListener('resize', onViewportResize)

    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      vv?.removeEventListener('resize', onViewportResize)
      clearTimeout(showTimer)
    }
  }, [])


  const dockVisible = !typing && !hideNav

  return (
    <div className="relative min-h-screen"
      style={{ '--mobile-dock-clearance': dockVisible ? 'calc(5.65rem + env(safe-area-inset-bottom))' : '0px' }}>
      {needsOnboarding && <Onboarding />}

      {/* ── Background — solid, professional deep green-charcoal ── */}
      <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: '#08110e' }}>
        {/* A single whisper of depth up top so it never reads as flat */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(110% 55% at 50% -8%, rgba(18,58,44,0.45) 0%, transparent 62%)' }}
        />
        {/* Subtle grounding vignette at the bottom */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/35" />
      </div>

      {/* ── UI layer: app shell fills the viewport; pages scroll inside main ── */}
      <div className="relative z-10 flex h-dvh">

        {/* ── Desktop glass sidebar ── */}
        <aside className="hidden md:flex w-56 shrink-0 p-3">
          <div className="flex flex-col w-full h-full bg-white/[0.085] backdrop-blur-md rounded-2xl border border-white/[0.12] shadow-2xl overflow-hidden">

            {/* Logo */}
            <div className="px-4 py-4 border-b border-white/[0.11]">
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

            {/* User + settings */}
            <div className="p-2 border-t border-white/[0.11]">
              <div className="text-[10px] text-white/40 truncate px-3 mb-1">{user?.email}</div>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm w-full transition-all ${
                    isActive ? 'bg-white/30 text-white shadow-sm' : 'text-white/55 hover:bg-white/15 hover:text-white'}`
                }
              >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </NavLink>
            </div>
          </div>
        </aside>

        {/* ── Content column ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Mobile top bar */}
          {/* The advisor and back-button sub-pages carry their own headers; skip
              the global bar there to avoid a redundant double header on mobile. */}
          {isGarden && (
          <header className="md:hidden flex-shrink-0 px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-500/90 rounded-lg flex items-center justify-center shadow">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-semibold text-white text-[15px] tracking-tight drop-shadow">Garden Financial</span>
            </div>
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                `p-2 rounded-xl transition-all backdrop-blur-sm ${
                  isActive ? 'text-white bg-white/15' : 'text-white/55 hover:bg-white/20 hover:text-white'}`
              }
            >
              <Settings className="w-5 h-5" />
            </NavLink>
          </header>
          )}

          {/* Page content — immersive pages (garden, advisor) are full-bleed and
              own their scroll; other pages keep clearance for the floating nav */}
          <main className={`flex-1 min-h-0 ${isImmersive ? 'overflow-hidden' : `overflow-auto ${isSubPage ? 'pb-6' : 'pb-[var(--mobile-dock-clearance)] md:pb-6'}`}`}>
            {profileError && (
              <div role="alert" className="mx-auto mt-3 max-w-xl px-4">
                <div className="flex items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5">
                  <p className="flex-1 text-xs text-rose-100">We couldn't load your profile. Your data is safe; try again.</p>
                  <button onClick={refreshProfile} className="shrink-0 text-xs font-semibold text-rose-200 hover:text-white">Try again</button>
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile HUD: floating pill nav (hidden on sub-pages + while typing) ── */}
      <nav
        className={`md:hidden fixed bottom-2.5 left-3 right-3 z-50 transition-all duration-200 ${
          (typing || hideNav) ? 'opacity-0 translate-y-8 pointer-events-none' : 'translate-y-0'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid w-full max-w-sm grid-cols-4 items-center gap-1 rounded-[20px] border border-white/[0.11] bg-[#09110e]/92 p-1.5 backdrop-blur-2xl"
          style={{ boxShadow: '0 14px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          {HUD_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[15px] px-2 py-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                  isActive
                    ? 'bg-white/[0.09] text-white ring-1 ring-white/[0.08]'
                    : 'text-white/40 hover:bg-white/[0.05] hover:text-white/75'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-[19px] w-[19px] transition-colors duration-200 ${isActive ? 'text-emerald-300' : ''}`} />
                  <span className={`text-[10px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-white/40'}`}>
                    {label}
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
