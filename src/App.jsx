import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { GardenProvider } from '@/context/GardenContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import AIAdvisor from '@/pages/AIAdvisor'
import Plan from '@/pages/Plan'
import StepDetail from '@/pages/StepDetail'
import Settings from '@/pages/Settings'
import { Sprout, Compass } from 'lucide-react'
import { HOME_MONEY_REDIRECTS } from '@/lib/routes'

const gardenExperience = import.meta.env.VITE_GARDEN_EXPERIENCE === '3d' ? '3d' : 'illustrated'
const LegacyDashboard = lazy(() => import('@/pages/Dashboard'))

function AppLoader() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5"
      style={{ background: 'linear-gradient(155deg, #020c05 0%, #031508 30%, #04101a 60%, #030b14 100%)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        <Sprout className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>
      <div className="w-6 h-6 border-emerald-400/80 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 2.5 }} />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  // Supabase recovery links create a temporary authenticated session while
  // the user is still on the password-reset form.
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('reset') === '1'
  if (user && !isPasswordRecovery) return <Navigate to="/" replace />
  return children
}

function NotFound() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5 p-6 text-center"
      style={{ background: 'linear-gradient(155deg, #020c05 0%, #031508 30%, #04101a 60%, #030b14 100%)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        <Compass className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="font-display text-2xl font-medium text-white tracking-tight">Page not found</h1>
        <p className="text-sm text-white/45 mt-1.5 max-w-sm">
          This corner of the garden doesn’t exist. Let’s get you back home.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        Back to your garden
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GardenProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute>{gardenExperience === '3d'
                ? <Suspense fallback={<AppLoader />}><LegacyDashboard /></Suspense>
                : <Home />}</ProtectedRoute>} />
              <Route path="/advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
              <Route path="/plan/step/:stepId" element={<ProtectedRoute><StepDetail /></ProtectedRoute>} />
              <Route path="/money" element={<Navigate to={HOME_MONEY_REDIRECTS['/money']} replace />} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/budget"   element={<Navigate to={HOME_MONEY_REDIRECTS['/budget']} replace />} />
              <Route path="/debt"     element={<Navigate to={HOME_MONEY_REDIRECTS['/debt']} replace />} />
              <Route path="/accounts" element={<Navigate to={HOME_MONEY_REDIRECTS['/accounts']} replace />} />
              <Route path="/goals"    element={<Navigate to="/plan#goals" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GardenProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
