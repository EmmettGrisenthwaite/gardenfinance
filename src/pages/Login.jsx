import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sprout } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Login() {
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #020c05 0%, #031508 30%, #04101a 60%, #030b14 100%)' }}
    >
      {/* Ambient orbs */}
      <div
        className="fixed rounded-full animate-orb-1 pointer-events-none"
        style={{
          top: '-25%', left: '-20%', width: '70%', height: '70%',
          background: 'radial-gradient(circle at center, rgba(16,185,129,0.22) 0%, transparent 68%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        className="fixed rounded-full animate-orb-2 pointer-events-none"
        style={{
          bottom: '-30%', right: '-20%', width: '65%', height: '65%',
          background: 'radial-gradient(circle at center, rgba(20,184,166,0.18) 0%, transparent 68%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        className="fixed rounded-full animate-orb-3 pointer-events-none"
        style={{
          top: '30%', left: '40%', width: '45%', height: '45%',
          background: 'radial-gradient(circle at center, rgba(45,212,191,0.10) 0%, transparent 70%)',
          filter: 'blur(72px)',
        }}
      />
      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <Sprout className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-[27px] font-medium text-white tracking-tight">Garden Financial</h1>
          <p className="text-white/45 text-sm mt-1 font-medium">Grow your financial future</p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-3xl border p-7 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.055)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          {/* Tab switcher */}
          <div className="flex rounded-xl p-0.5 mb-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setMessage('') }}
                className={`flex-1 py-2 text-sm font-semibold rounded-[10px] transition-all duration-200 ${
                  mode === m
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full px-4 py-3 rounded-xl text-base md:text-sm text-white placeholder-white/25 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-base md:text-sm text-white placeholder-white/25 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl text-base md:text-sm text-white placeholder-white/25 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              />
            </div>

            {error && (
              <p className="text-sm text-rose-300 bg-rose-500/15 border border-rose-500/20 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-emerald-300 bg-emerald-500/15 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 mt-1 shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {loading
                ? 'Loading…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/25 mt-6 font-medium">
          Your finances. Your garden. Your future.
        </p>
      </motion.div>
    </div>
  )
}
