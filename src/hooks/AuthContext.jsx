import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const ADMIN_ID = '5b9c6fb1-7a61-4a34-8bb0-ba89a0569e76'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid, token) => {
    if (!uid) return null
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&limit=1`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token || ANON_KEY}` }
      })
      const data = await res.json()
      return (data && data[0]) ?? null
    } catch { return null }
  }

  const refreshProfile = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&limit=1`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      })
      const data = await res.json()
      if (data && data[0]) setProfile(data[0])
    } catch {}
  }

  const setOnlineStatus = async (uid, token, status) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        method: 'PATCH',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token || ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ online: status })
      })
    } catch {}
  }

  useEffect(() => {
    if (!supabase) { setUser(null); setLoading(false); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id, session.access_token)
        setProfile(p)
        await setOnlineStatus(u.id, session.access_token, true)
      }
      setLoading(false)
    }).catch(() => { setUser(null); setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id, session.access_token)
        setProfile(p)
        await setOnlineStatus(u.id, session.access_token, true)
      } else {
        setProfile(null)
      }
    })

    const handleUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (session?.user) await setOnlineStatus(session.user.id, session.access_token, false)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => { subscription.unsubscribe(); window.removeEventListener('beforeunload', handleUnload) }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email, password, pseudo, extra = {}) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }

    // ── 1. Vérification pseudo unique ──
    const pseudoCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?pseudo=eq.${encodeURIComponent(pseudo.trim())}&select=id&limit=1`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    )
    const pseudoData = await pseudoCheck.json()
    if (Array.isArray(pseudoData) && pseudoData.length > 0) {
      return { error: { message: 'Ce pseudo est déjà pris. Choisis-en un autre.' } }
    }

    // ── 2. Vérification email unique ──
    const emailCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email.trim())}&select=id&limit=1`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    )
    const emailData = await emailCheck.json()
    if (Array.isArray(emailData) && emailData.length > 0) {
      return { error: { message: 'Un compte existe déjà avec cet email.' } }
    }

    // ── 3. Création du compte Supabase Auth ──
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      // Traduire les erreurs Supabase en français
      if (error.message?.includes('already registered')) return { error: { message: 'Un compte existe déjà avec cet email.' } }
      if (error.message?.includes('Password should be')) return { error: { message: 'Le mot de passe doit faire au moins 6 caractères.' } }
      if (error.message?.includes('invalid email')) return { error: { message: 'Adresse email invalide.' } }
      return { error }
    }

    if (data.user) {
      const token = data.session?.access_token || ANON_KEY

      // ── 4. Création du profil ──
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          id:        data.user.id,
          pseudo:    pseudo.trim(),
          email:     email.trim().toLowerCase(),
          role:      'membre',
          bio:       '',
          interests: [],
          friends:   0,
          posts:     0,
          joined:    new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          online:    true,
          banned:    false,
          votes:     { mimi: 0, cool: 0, sexy: 0, loose: 0 },
          photo_likes: {},
          age:       extra.age    || null,
          sexe:      extra.sexe   || null,
          region:    extra.region || '',
          dept:      extra.dept   || '',
          city:      extra.city   || '',
        })
      })

      if (!profileRes.ok) {
        // Si le profil n'a pas pu être créé, on supprime le compte auth pour éviter les orphelins
        await supabase.auth.admin?.deleteUser(data.user.id).catch(() => {})
        return { error: { message: 'Erreur lors de la création du profil. Réessaie.' } }
      }

      // ── 5. Message de bienvenue ──
      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: ADMIN_ID,
          to_id:   data.user.id,
          body:    `👋 Bienvenue sur WeMoved, @${pseudo.trim()} ! Nous sommes ravis de t'accueillir dans la communauté. N'hésite pas à compléter ton profil et à te présenter sur le forum. Bonne aventure ! 🚀`,
          read:    false
        })
      })
    }

    return { data, error: null }
  }

  const signOut = async () => {
    if (supabase && user) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (session) await setOnlineStatus(user.id, session.access_token, false)
      await supabase.auth.signOut()
    }
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