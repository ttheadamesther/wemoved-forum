import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

  const fetchProfile = async (uid, token) => {
    if (!uid) return null
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&limit=1`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token || ANON_KEY}` }
      })
      const data = await res.json()
      if (!data || !data[0]) return null
      const p = data[0]
      if (p.birth_date) {
        const freshAge = calcAge(p.birth_date)
        if (freshAge !== null && freshAge !== p.age) {
          fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
            method: 'PATCH',
            headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token || ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ age: freshAge })
          }).catch(() => {})
          p.age = freshAge
        }
      }
      return p
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

  // Rafraîchir le profil toutes les 30 secondes pour détecter les bans
  const startProfilePolling = (uid) => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    refreshIntervalRef.current = setInterval(async () => {
      if (!uid) return
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=banned,banned_until,role,xp,level,badges&limit=1`, {
          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
        })
        const data = await res.json()
        if (data && data[0]) {
          setProfile(prev => prev ? { ...prev, ...data[0] } : data[0])
        }
      } catch {}
    }, 30000) // toutes les 30 secondes
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
        await setOnlineStatus(u.id, session.access_token, true)
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
        await setOnlineStatus(u.id, session.access_token, true)
        startProfilePolling(u.id)
      } else {
        setProfile(null)
        stopProfilePolling()
      }
    })

    const handleUnload = async () => {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (session?.user) await setOnlineStatus(session.user.id, session.access_token, false)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleUnload)
      stopProfilePolling()
    }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email, password, pseudo, extra = {}) => {
    if (!supabase) return { error: { message: 'Supabase non configuré.' } }

    const pseudoCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?pseudo=eq.${encodeURIComponent(pseudo.trim())}&select=id&limit=1`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    )
    const pseudoData = await pseudoCheck.json()
    if (Array.isArray(pseudoData) && pseudoData.length > 0) {
      return { error: { message: 'Ce pseudo est déjà pris. Choisis-en un autre.' } }
    }

    const emailCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email.trim())}&select=id&limit=1`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    )
    const emailData = await emailCheck.json()
    if (Array.isArray(emailData) && emailData.length > 0) {
      return { error: { message: 'Un compte existe déjà avec cet email.' } }
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      if (error.message?.includes('already registered')) return { error: { message: 'Un compte existe déjà avec cet email.' } }
      if (error.message?.includes('Password should be')) return { error: { message: 'Le mot de passe doit faire au moins 6 caractères.' } }
      if (error.message?.includes('invalid email')) return { error: { message: 'Adresse email invalide.' } }
      return { error }
    }

    if (data.user) {
      const token = data.session?.access_token || ANON_KEY
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
          age:       extra.age        || null,
          birth_date: extra.birth_date || null,
          sexe:      extra.sexe   || null,
          region:    extra.region || '',
          dept:      extra.dept   || '',
          city:      extra.city   || '',
        })
      })

      if (!profileRes.ok) {
        await supabase.auth.admin?.deleteUser(data.user.id).catch(() => {})
        return { error: { message: 'Erreur lors de la création du profil. Réessaie.' } }
      }

      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_id: WAKIKI_ID,
          to_id:   data.user.id,
          body:    `👋 Bienvenue sur WeMoved, @${pseudo.trim()} ! Nous sommes ravis de t'accueillir dans la communauté. N'hésite pas à compléter ton profil et à te présenter sur le forum. Bonne aventure ! 🚀`,
          read:    false
        })
      })

      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: data.user.id,
          type:    'message',
          content: `💬 Bienvenue ! Tu as reçu un message de @Wakiki`,
          link:    `/messages?to=${WAKIKI_ID}`,
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