import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Sprout, LayoutDashboard, Target, CreditCard, DollarSign, Bot, LogOut, Wallet } from 'lucide-react'
import Onboarding from '@/components/Onboarding'

const sidebarItems = [
  { to: '/',        label: 'Garden',     icon: LayoutDashboard },
  { to: '/budget',  label: 'Budget',     icon: DollarSign },
  { to: '/goals',   label: 'Goals',      icon: Target },
  { to: '/debt',    label: 'Debt',       icon: CreditCard },
  { to: '/accounts',label: 'Accounts',   icon: Wallet },
  { to: '/advisor', label: 'AI Advisor', icon: Bot },
]

const bottomNavItems = [
  { to: '/',        label: 'Garden',  icon: LayoutDashboard },
  { to: '/budget',  label: 'Budget',  icon: DollarSign },
  { to: '/goals',   label: 'Goals',   icon: Target },
  { to: '/debt',    label: 'Debt',    icon: CreditCard },
  { to: '/advisor', label: 'Advisor', icon: Bot },
]

export default function Layout({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const needsOnboarding = profile === null && !loading

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {needsOnboarding && <Onboarding />}

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm">Garden Financial</div>
              <div className="text-xs text-gray-400">Grow your wealth</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {sidebarItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="text-xs text-gray-400 truncate px-3 mb-2">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 w-full transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Content area (header + main) ── */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Mobile top header */}
        <header className="md:hidden flex-shrink-0 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm tracking-tight">Garden Financial</span>
          </div>
          <NavLink
            to="/accounts"
            className={({ isActive }) =>
              `p-2 rounded-xl transition-colors ${
                isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Wallet className="w-5 h-5" />
          </NavLink>
        </header>

        {/* Scrollable main content */}
        <main className="flex-1 overflow-auto min-h-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation (fixed) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-14">
          {bottomNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
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
