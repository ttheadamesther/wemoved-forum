import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { setOnlineStatus } from '../lib/security'

const AuthContext = createContext(null)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshIntervalRef = useRef(null)
  const mountedRef = useRef(true)

  const fetchProfile = async (uid) => {
    if (!uid || !supabase) return null

    try {
      const { data, error } = await supabase.rpc('get_my_profile')

      if (error) {
        console.warn('[Auth] Impossible de récupérer le profil:', error.message)
        return null
      }

      return data || null
    } catch (error) {
      console.warn('[Auth] Erreur profil:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (!user?.id || !supabase) return

    const p = await fetchProfile(user.id)

    if (mountedRef.current && p) {
      setProfile(p)
    }
  }

  const setPresence = async (status) => {
    if (!supabase) return

    try {
      await setOnlineStatus(status)
    } catch (error) {
      console.warn('[Auth] Erreur présence:', error)
    }
  }

  const stopProfilePolling = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
  }

  const startProfilePolling = (uid) => {
    stopProfilePolling()

    if (!uid || !supabase) return

    refreshIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return

      const p = await fetchProfile(uid)

      if (mountedRef.current && p) {
        setProfile(p)
      }
    }, 30000)
  }

  useEffect(() => {
    mountedRef.current = true

    if (!supabase) {
      setUser(null)
      setProfile(null)
      setLoading(false)

      return () => {
        mountedRef.current = false
      }
    }

    let subscription = null
    let heartbeat = null
    let authInitTimeout = null

    const initializeAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession()

        const timeoutPromise = new Promise((resolve) => {
          authInitTimeout = setTimeout(() => {
            console.warn('[Auth] getSession a dépassé 10 secondes.')
            resolve({
              data: { session: null },
              error: new Error('Auth initialization timeout')
            })
          }, 10000)
        })

        const result = await Promise.race([
          sessionPromise,
          timeoutPromise
        ])

        if (authInitTimeout) {
          clearTimeout(authInitTimeout)
          authInitTimeout = null
        }

        const session = result?.data?.session || null
        const u = session?.user || null

        if (!mountedRef.current) return

        setUser(u)

        // Le site ne doit jamais attendre le profil pour s'afficher.
        setLoading(false)

        if (!u) {
          setProfile(null)
          stopProfilePolling()
          return
        }

        // Tout ce qui est secondaire est exécuté après l'initialisation Auth.
        void (async () => {
          const p = await fetchProfile(u.id)

          if (mountedRef.current && p) {
            setProfile(p)
          }

          if (mountedRef.current) {
            void setPresence(true)
            startProfilePolling(u.id)
          }
        })()
      } catch (error) {
        console.error('[Auth] Erreur initialisation:', error)

        if (!mountedRef.current) return

        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }

    void initializeAuth()

    // IMPORTANT : aucun await Supabase directement dans onAuthStateChange.
    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user || null

      if (!mountedRef.current) return

      setUser(u)

      if (!u) {
        setProfile(null)
        stopProfilePolling()
        return
      }

      // On sort du callback Supabase avant de lancer les appels async.
      setTimeout(() => {
        if (!mountedRef.current) return

        void (async () => {
          const p = await fetchProfile(u.id)

          if (mountedRef.current && p) {
            setProfile(p)
          }

          if (mountedRef.current) {
            void setPresence(true)
            startProfilePolling(u.id)
          }
        })()
      }, 0)
    })

    subscription = authListener?.data?.subscription || null

    heartbeat = window.setInterval(async () => {
      if (!mountedRef.current) return

      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession()

        if (currentSession?.user) {
          await setOnlineStatus(true)
        }
      } catch (error) {
        console.warn('[Auth] Heartbeat:', error)
      }
    }, 60000)

    const handleUnload = () => {
      try {
        void setOnlineStatus(false)
      } catch {}
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      mountedRef.current = false

      if (authInitTimeout) {
        clearTimeout(authInitTimeout)
      }

      if (subscription) {
        subscription.unsubscribe()
      }

      if (heartbeat) {
        window.clearInterval(heartbeat)
      }

      window.removeEventListener('beforeunload', handleUnload)

      stopProfilePolling()
    }
  }, [])

  const signIn = async (email, password) => {
    if (!supabase) {
      return {
        error: {
          message: 'Supabase non configuré.'
        }
      }
    }

    return await supabase.auth.signInWithPassword({
      email,
      password
    })
  }

  const signUp = async (email, password, pseudo, extra = {}) => {
    if (!supabase) {
      return {
        error: {
          message: 'Supabase non configuré.'
        }
      }
    }

    const cleanPseudo = pseudo.trim()

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanPseudo)) {
      return {
        error: {
          message:
            'Pseudo invalide : 3 à 20 caractères, lettres, chiffres et _ uniquement.'
        }
      }
    }

    try {
      const pseudoCheck = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?pseudo=eq.${encodeURIComponent(
          cleanPseudo
        )}&select=id&limit=1`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`
          }
        }
      )

      const pseudoData = await pseudoCheck.json().catch(() => [])

      if (Array.isArray(pseudoData) && pseudoData.length > 0) {
        return {
          error: {
            message: 'Ce pseudo est déjà pris. Choisis-en un autre.'
          }
        }
      }
    } catch (error) {
      console.warn('[Auth] Vérification pseudo:', error)
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
          city: extra.city || ''
        }
      }
    })

    if (error) {
      if (error.message?.includes('already registered')) {
        return {
          error: {
            message: 'Un compte existe déjà avec cet email.'
          }
        }
      }

      if (error.message?.includes('Password should be')) {
        return {
          error: {
            message: 'Le mot de passe doit faire au moins 6 caractères.'
          }
        }
      }

      if (error.message?.includes('invalid email')) {
        return {
          error: {
            message: 'Adresse email invalide.'
          }
        }
      }

      return { error }
    }

    return {
      data,
      error: null
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setUser(null)
      setProfile(null)
      stopProfilePolling()
      return
    }

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session?.user) {
        await setPresence(false)
      }

      await supabase.auth.signOut()
    } catch (error) {
      console.warn('[Auth] Erreur déconnexion:', error)
    }

    stopProfilePolling()

    if (mountedRef.current) {
      setUser(null)
      setProfile(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error(
      'useAuth doit être utilisé dans <AuthProvider>'
    )
  }

  return ctx
}
