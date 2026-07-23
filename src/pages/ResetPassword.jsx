import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { Logo } from '../components/Logo'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password,  setPassword]  = useState('')
  const [confirm,    setConfirm]  = useState('')
  const [error,      setError]    = useState('')
  const [loading,    setLoading]  = useState(false)
  const [ready,      setReady]    = useState(false)
  const [done,       setDone]     = useState(false)

  // Vérifie qu'une session de recovery est bien présente (posée automatiquement
  // par le client Supabase quand il détecte le token dans l'URL après le clic sur le lien du mail).
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        if (session) { setReady(true); return }
        // Le token peut mettre un instant à être traité — on réessaie une fois
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          setReady(!!s2)
        }, 800)
      } catch {
        setReady(false)
      }
    })()
  }, [])

  const submit = async () => {
    setError('')
    if (password.length < 6) { setError('6 caractères minimum.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { error: err } = await supabase.auth.updateUser({ password })
      setLoading(false)
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (e) {
      setLoading(false)
      setError("Une erreur est survenue. Réessaie plus tard.")
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo height={52} />
        </div>

        {done ? (
          <>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>✅</div>
            <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>Mot de passe mis à jour !</h2>
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center' }}>
              Redirection vers la connexion…
            </div>
          </>
        ) : !ready ? (
          <>
            <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>Lien invalide ou expiré</h2>
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 20 }}>
              Ce lien de réinitialisation n'est plus valide. Demandes-en un nouveau depuis la page de connexion.
            </div>
            <Btn onClick={() => navigate('/login')} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
              Retour à la connexion
            </Btn>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 20 }}>Nouveau mot de passe</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Nouveau mot de passe</label>
              <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Confirmer le mot de passe</label>
              <Input value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="••••••••" type="password" style={{ width: '100%' }} />
            </div>

            {error && (
              <div style={{ background: '#ffe0e0', border: `1px solid ${C.red}`, borderRadius: 3, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <Btn onClick={submit} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
              {loading ? '…' : 'Valider'}
            </Btn>
          </>
        )}
      </div>
    </div>
  )
}