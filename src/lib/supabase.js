import { createClient } from '@supabase/supabase-js'

// trim() enlève les espaces invisibles qui cassent la connexion
const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL     || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

if (!supabase) {
  console.warn('⚠️ Supabase non configuré — mode démo actif.')
}
