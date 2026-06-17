import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { GardenProvider } from '@/context/GardenContext'
import { Toaster } from '@/components/ui/toaster'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Budget from '@/pages/Budget'
import Goals from '@/pages/Goals'
import Debt from '@/pages/Debt'
import AIAdvisor from '@/pages/AIAdvisor'
import Accounts from '@/pages/Accounts'
import Plan from '@/pages/Plan'
import GardenPreview from '@/pages/GardenPreview'
import { Sprout, Compass } from 'lucide-react'

function AppLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
        <Sprout className="w-8 h-8 text-white" />
      </div>
      <div className="w-6 h-6 border-3 border-green-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 2.5 }} />
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
        <Compass className="w-8 h-8 text-white" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          This corner of the garden doesn’t exist. Let’s get you back home.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
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
                <Route path="/garden-preview" element={<GardenPreview />} />
              )}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
              <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
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
