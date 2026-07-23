import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { Logo } from '../components/Logo'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const [showForgot,   setShowForgot]   = useState(false)
  const [resetEmail,   setResetEmail]   = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError,   setResetError]   = useState('')
  const [resetSent,    setResetSent]    = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handle = async () => {
    setError('')
    setLoading(true)
    const { data, error: err } = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err.message); return }
    if (data?.session) { navigate('/', { replace: true }) }
    else { setError('Connexion échouée — vérifie tes identifiants.') }
  }

  const openForgot = () => {
    setResetEmail(email)
    setResetError('')
    setResetSent(false)
    setShowForgot(true)
  }

  const handleReset = async () => {
    setResetError('')
    if (!resetEmail.trim()) { setResetError('Entre ton adresse email.'); return }
    setResetLoading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      })
      setResetLoading(false)
      if (err) { setResetError(err.message); return }
      setResetSent(true)
    } catch (e) {
      setResetLoading(false)
      setResetError("Une erreur est survenue. Réessaie plus tard.")
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo height={52} />
        </div>

        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 20 }}>Connexion</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" type="email" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Mot de passe</label>
          <Input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="••••••••" type="password" style={{ width: '100%' }} />
        </div>

        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <button onClick={openForgot} type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
            Mot de passe oublié ?
          </button>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', border: `1px solid ${C.red}`, borderRadius: 3, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <Btn onClick={handle} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
          {loading ? '…' : 'Se connecter'}
        </Btn>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.textMid }}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={{ color: C.accentTxt, fontWeight: 700 }}>S'inscrire</Link>
        </div>
      </div>

      {/* ── MODALE MOT DE PASSE OUBLIÉ ── */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowForgot(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>

            {resetSent ? (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>📬</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 6 }}>Email envoyé !</div>
                <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 20 }}>
                  Si un compte existe pour <strong>{resetEmail}</strong>, tu vas recevoir un lien pour réinitialiser ton mot de passe.
                </div>
                <Btn onClick={() => setShowForgot(false)} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
                  Fermer
                </Btn>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🔑</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 6 }}>Mot de passe oublié ?</div>
                <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 16 }}>
                  Entre ton email, on t'envoie un lien de réinitialisation.
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Input
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="email@exemple.com"
                    type="email"
                    style={{ width: '100%' }}
                  />
                </div>

                {resetError && (
                  <div style={{ background: '#ffe0e0', border: `1px solid ${C.red}`, borderRadius: 3, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 12 }}>
                    {resetError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowForgot(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                  <button onClick={handleReset} disabled={resetLoading}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 13, cursor: resetLoading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {resetLoading ? '…' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}