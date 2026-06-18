import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { GardenProvider } from '@/context/GardenContext'
import { Toaster } from '@/components/ui/toaster'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Budget from '@/pages/Budget'
import Debt from '@/pages/Debt'
import AIAdvisor from '@/pages/AIAdvisor'
import Accounts from '@/pages/Accounts'
import Plan from '@/pages/Plan'
const GardenPreview = lazy(() => import('@/pages/GardenPreview'))
import { Sprout, Compass } from 'lucide-react'

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
  if (user) return <Navigate to="/" replace />
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
              {import.meta.env.DEV && (
                <Route path="/garden-preview" element={<Suspense fallback={null}><GardenPreview /></Suspense>} />
              )}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
              <Route path="/goals" element={<Navigate to="/plan" replace />} />
              <Route path="/debt" element={<ProtectedRoute><Debt /></ProtectedRoute>} />
              <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
              <Route path="/advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </GardenProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
