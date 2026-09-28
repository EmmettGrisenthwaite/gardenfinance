import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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

  const switchMode = next => { setMode(next); setError(''); setMessage('') }
  const heading = mode === 'reset' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Sign in'

  return (
    <div className="min-h-dvh px-5 py-10 sm:flex sm:items-center sm:justify-center" style={{ background: '#08110e' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="mx-auto w-full max-w-sm"
      >
        <p className="font-brand text-[20px] font-semibold tracking-tight text-white">Garden Financial</p>

        <h1 className="mt-12 text-[26px] font-semibold tracking-[-0.02em] text-white sm:mt-10">{heading}</h1>
        {mode === 'reset' && <p className="mt-1 text-[15px] text-readable-secondary">Choose a new password for your account.</p>}
        {mode === 'signup' && <p className="mt-1 text-[15px] text-readable-secondary">A plan built from your real numbers, in about two minutes.</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="login-name" className="field-label">Name</label>
              <input id="login-name" type="text" value={name} onChange={e => setName(e.target.value)}
                autoComplete="name" required className="glass-input min-h-12 text-base md:text-sm" />
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="field-label">Email</label>
            <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@example.com" required className="glass-input min-h-12 text-base md:text-sm" />
          </div>

          <div>
            <label htmlFor="login-password" className="field-label">{mode === 'reset' ? 'New password' : 'Password'}</label>
            <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6}
              className="glass-input min-h-12 text-base md:text-sm" />
          </div>

          {mode === 'reset' && (
            <div>
              <label htmlFor="login-confirm" className="field-label">Confirm new password</label>
              <input id="login-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password" required minLength={6} className="glass-input min-h-12 text-base md:text-sm" />
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{message}</p>}

          <button type="submit" disabled={loading} className="btn-primary min-h-12 w-full text-[15px]">
            {loading ? 'One moment…' : mode === 'reset' ? 'Update password' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-3 text-[14px]">
          {mode === 'login' && <>
            <button type="button" onClick={() => switchMode('reset')} className="flex min-h-11 items-center text-readable-secondary hover:text-white">
              Forgot your password?
            </button>
            <p className="text-readable-muted">
              New here? <button type="button" onClick={() => switchMode('signup')} className="inline-flex min-h-11 items-center font-semibold text-emerald-200 hover:text-emerald-100">Create an account</button>
            </p>
          </>}
          {mode === 'signup' && (
            <p className="text-readable-muted">
              Already have an account? <button type="button" onClick={() => switchMode('login')} className="inline-flex min-h-11 items-center font-semibold text-emerald-200 hover:text-emerald-100">Sign in</button>
            </p>
          )}
          {mode === 'reset' && <>
            <button type="button" onClick={sendResetEmail} disabled={loading} className="flex min-h-11 items-center font-semibold text-emerald-200 hover:text-emerald-100 disabled:opacity-50">
              Email me a reset link instead
            </button>
            <button type="button" onClick={() => switchMode('login')} className="flex min-h-11 items-center text-readable-secondary hover:text-white">
              Back to sign in
            </button>
          </>}
        </div>

        {/* Reachable without an account: the store listing links here, and a
            policy you can only read after signing up is not a policy. */}
        <p className="mt-8 text-[13px] text-readable-muted">
          <Link to="/privacy" className="inline-flex min-h-11 items-center hover:text-white">Privacy</Link>
        </p>
      </motion.div>
    </div>
  )
}
