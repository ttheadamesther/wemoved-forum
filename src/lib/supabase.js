import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL     || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('wemoved.fr')

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'wemoved-auth',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        ...(isProduction ? {
          cookieOptions: {
            domain: '.wemoved.fr',
            sameSite: 'Lax',
            secure: true,
          }
        } : {})
      }
    })
  : null

if (!supabase) {
  console.warn('⚠️ Supabase non configuré — mode démo actif.')
}