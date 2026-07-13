import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { profilePatchForCompletedSteps } from '@/lib/stepEffects'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // PGRST116 means the user has not completed setup yet. Any other error is
    // an infrastructure/RLS problem and must not be mistaken for a new user.
    if (error && error.code !== 'PGRST116') {
      setProfile(null)
      setProfileError(error.message ?? 'Could not load your profile.')
      return null
    }

    let nextProfile = data ?? null

    // Repair facts for steps completed before step-to-profile memory existed.
    // This keeps direct visits to any page from seeing stale onboarding answers.
    if (nextProfile) {
      const { data: plans, error: plansError } = await supabase
        .from('advisor_plans')
        .select('steps')
        .eq('user_id', userId)
      if (!plansError) {
        const completed = (plans ?? []).flatMap(plan =>
          Array.isArray(plan.steps)
            ? plan.steps.filter(step => step?.done).map(step => step.text || '')
            : [],
        )
        const patch = profilePatchForCompletedSteps(completed, nextProfile)
        if (patch) {
          const { error: memoryError } = await supabase.from('profiles').update(patch).eq('id', userId)
          if (!memoryError) nextProfile = { ...nextProfile, ...patch }
        }
      }
    }

    setProfileError(null)
    setProfile(nextProfile)
    return nextProfile
  }

  async function refreshProfile() {
    if (!user) return null
    setProfileError(null)
    return fetchProfile(user.id)
  }

  // Persist facts proved by a completed plan step so suggestions, the advisor,
  // and the finance engine all read the same updated memory.
  async function rememberCompletedStep(stepText) {
    if (!user) return null
    const patch = profilePatchForCompletedSteps([stepText], profile)
    if (!patch) return null

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) throw error
    setProfile(current => current ? { ...current, ...patch } : current)
    return patch
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setProfileError(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      else {
        setProfile(null)
        setProfileError(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, profileError, refreshProfile, rememberCompletedStep }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
