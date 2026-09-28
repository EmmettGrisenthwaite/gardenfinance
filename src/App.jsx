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
import Privacy from '@/pages/Privacy'
import { Loader2 } from 'lucide-react'
import { HOME_MONEY_REDIRECTS } from '@/lib/routes'

// The same colour as the shell it hands over to, so opening the app is one
// continuous dark screen rather than a splash followed by a different page.
function AppLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center" style={{ background: '#08110e' }} role="status" aria-label="Loading">
      <Loader2 className="status-spinner h-5 w-5 text-emerald-300" aria-hidden="true" />
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
    <div className="flex min-h-dvh items-center px-6" style={{ background: '#08110e' }}>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Page not found</h1>
        <p className="mt-1.5 text-[15px] leading-6 text-readable-secondary">That link doesn’t go anywhere in the app.</p>
        <Link to="/" className="btn-primary mt-5 min-h-11">Go to Home</Link>
      </div>
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
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
              <Route path="/plan/step/:stepId" element={<ProtectedRoute><StepDetail /></ProtectedRoute>} />
              <Route path="/money" element={<Navigate to={HOME_MONEY_REDIRECTS['/money']} replace />} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              {/* Public: a store listing links here, and it has to resolve for
                  someone who has not signed in. */}
              <Route path="/privacy" element={<Privacy />} />
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
