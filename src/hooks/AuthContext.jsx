import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setOnlineStatus } from '../lib/security'

const AuthContext = createContext(null)

const ADMIN_ID  = '5b9c6fb1-7a61-4a34-8bb0-ba89a0569e76'
const WAKIKI_ID = '59349492-13b2-482d-be42-c0d026f37fdd'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshIntervalRef = useRef(null)

  const calcAge = (birthDate) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const fetchProfile = async (uid) => {
    if (!uid || !supabase) return null
    try {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error) throw error
      return data || null
    } catch { return null }
  }

  const refreshProfile = async () => {
    if (!user?.id || !supabase) return
    try { const { data, error } = await supabase.rpc('get_my_profile'); if (!error && data) setProfile(data) } catch {}
  }

  const setPresence = async (status) => {
    try { await setOnlineStatus(status) } catch {}
  }

  // Rafraîchir le profil toutes les 30 secondes pour détecter les bans
  const startProfilePolling = (uid) => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    refreshIntervalRef.current = setInterval(async () => {
      if (!uid || !supabase) return
      try { const { data, error } = await supabase.rpc('get_my_profile'); if (!error && data) setProfile(data) } catch {}
    }, 30000)
  }

  const stopProfilePolling = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
  }

  useEffect(() => {
    if (!supabase) { setUser(null); setLoading(false); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id, session.access_token)
        setProfile(p)
        await setPresence(true)
        startProfilePolling(u.id)
      }
      setLoading(false)
    }).catch(() => { setUser(null); setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id, session.access_token)
        setProfile(p)
        await setPresence(true)
        startProfilePolling(u.id)
      } else {
        setProfile(null)
        stopProfilePolling()
      }
    })

    const heartbeat = window.setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (currentSession?.user) { try { await setOnlineStatus(true) } catch {} }
    }, 60000)

    const handleUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (session?.user) await setOnlineStatus(false)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleUnload)
      window.clearInterval(heartbeat)
      stopProfilePolling()
    }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email, password, pseudo, extra = {}) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }
    const cleanPseudo = pseudo.trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanPseudo)) {
      return { error: { message: 'Pseudo invalide : 3 à 20 caractères, lettres, chiffres et _ uniquement.' } }
    }

    const pseudoCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?pseudo=eq.${encodeURIComponent(cleanPseudo)}&select=id&limit=1`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    )
    const pseudoData = await pseudoCheck.json().catch(() => [])
    if (Array.isArray(pseudoData) && pseudoData.length > 0) {
      return { error: { message: 'Ce pseudo est déjà pris. Choisis-en un autre.' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          pseudo: cleanPseudo,
          bio: '',
          interests: [],
          age: extra.age || null,
          birth_date: extra.birth_date || null,
          sexe: extra.sexe || null,
          region: extra.region || '',
          dept: extra.dept || '',
          city: extra.city || '',
        }
      }
    })
    if (error) {
      if (error.message?.includes('already registered')) return { error: { message: 'Un compte existe déjà avec cet email.' } }
      if (error.message?.includes('Password should be')) return { error: { message: 'Le mot de passe doit faire au moins 6 caractères.' } }
      if (error.message?.includes('invalid email')) return { error: { message: 'Adresse email invalide.' } }
      return { error }
    }

    // Profile/message/notification creation is handled by the database trigger so
    // registration also works when email confirmation is enabled.
    return { data, error: null }
  }

  const signOut = async () => {
    if (supabase && user) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (session) await setPresence(false)
      await supabase.auth.signOut()
    }
    stopProfilePolling()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}