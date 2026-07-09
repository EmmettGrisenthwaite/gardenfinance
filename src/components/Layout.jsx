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
  const isSubPage   = pathname === '/settings'
  // The advisor chat is a full-screen composer (like a real chat app) — the
  // pill would either overlap the send button or force a permanent dead gap
  // above it, so it's hidden there too; the chat's own header carries a way back.
  const hideNav     = isSubPage || pathname === '/advisor'

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


  return (
    <div className="relative min-h-screen">
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
          {pathname !== '/advisor' && !isSubPage && (
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
          <main className={`flex-1 min-h-0 ${isImmersive ? 'overflow-hidden' : `overflow-auto ${isSubPage ? 'pb-6' : 'pb-28 md:pb-6'}`}`}>
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
        className={`md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
          (typing || hideNav) ? 'opacity-0 translate-y-8 pointer-events-none' : 'translate-y-0'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-0.5 bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/[0.11] px-1.5 py-1.5"
          style={{ boxShadow: '0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)' }}>
          {HUD_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 ${
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
                  <span className={`text-[8.5px] font-bold tracking-wide transition-all duration-200 ${
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
