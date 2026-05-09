import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Budget from '@/pages/Budget'
import Goals from '@/pages/Goals'
import Debt from '@/pages/Debt'
import AIAdvisor from '@/pages/AIAdvisor'
import Accounts from '@/pages/Accounts'
import { Sprout } from 'lucide-react'

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
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
          <Route path="/debt" element={<ProtectedRoute><Debt /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}
