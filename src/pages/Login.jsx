import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Sprout } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Login() {
  const [mode,     setMode]     = useState(() => new URLSearchParams(window.location.search).get('reset') === '1' ? 'reset' : 'login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'reset') {
      if (password.length < 6) {
        setError('Your new password must be at least 6 characters.')
      } else if (password !== confirmPassword) {
        setError('Your passwords do not match.')
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) setError(error.message)
        else navigate('/')
      }
    } else if (mode === 'signup') {
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

  async function sendResetEmail() {
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Enter your email first.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?reset=1`,
    })
    if (error) setError(error.message)
    else setMessage('Check your email for a password reset link.')
    setLoading(false)
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 overflow-hidden"
      style={{ background: '#08110e' }}
    >
      {/* Same quiet depth treatment as the app shell — one whisper of forest
          glow up top, grounding vignette below. */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(110% 55% at 50% -8%, rgba(18,58,44,0.45) 0%, transparent 62%)' }}
      />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/35" />

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
          <h1 className="font-brand text-[27px] font-semibold text-white tracking-tight">Garden Financial</h1>
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
          {mode === 'reset' ? (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white">Reset your password</h2>
              <p className="text-xs text-white/50 mt-1">Choose a new password for your Garden account.</p>
            </div>
          ) : (
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
          )}

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

            {mode !== 'reset' && <div>
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
            </div>}

            {mode === 'reset' && <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-base md:text-sm text-white placeholder-white/25 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
              />
            </div>}

            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">{mode === 'reset' ? 'New password' : 'Password'}</label>
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

            {mode === 'reset' && <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl text-base md:text-sm text-white placeholder-white/25 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
              />
            </div>}

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
                : mode === 'reset' ? 'Update password' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'login' && (
            <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}
              className="w-full mt-4 text-xs font-semibold text-emerald-300/80 hover:text-emerald-200 transition-colors">
              Forgot your password?
            </button>
          )}
          {mode === 'reset' && (
            <div className="mt-4 space-y-2 text-center">
              <button type="button" onClick={sendResetEmail} disabled={loading}
                className="text-xs font-semibold text-emerald-300/80 hover:text-emerald-200 disabled:opacity-50 transition-colors">
                Email me a reset link instead
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}
                className="block w-full text-xs text-white/40 hover:text-white/70 transition-colors">
                Back to sign in
              </button>
            </div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
