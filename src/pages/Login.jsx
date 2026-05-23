import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { Logo } from '../components/Logo'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [pseudo,   setPseudo]   = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handle = async () => {
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { data, error: err } = await signIn(email, password)
      setLoading(false)
      if (err) { setError(err.message); return }
      if (data?.session) { navigate('/', { replace: true }) }
      else { setError('Connexion échouée — vérifie tes identifiants.') }
    } else {
      if (!pseudo.trim())      { setLoading(false); setError('Le pseudo est obligatoire.'); return }
      if (pseudo.length < 3)   { setLoading(false); setError('Pseudo trop court (3 min).'); return }
      if (password.length < 6) { setLoading(false); setError('Mot de passe trop court (6 min).'); return }
      const { error: err } = await signUp(email, password, pseudo)
      setLoading(false)
      if (err) { setError(err.message); return }
      navigate('/', { replace: true })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo height={52} />
        </div>

        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 20 }}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h2>

        {mode === 'register' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Pseudo</label>
            <Input value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="ton_pseudo" style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" type="email" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Mot de passe</label>
          <Input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="••••••••" type="password" style={{ width: '100%' }} />
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', border: `1px solid ${C.red}`, borderRadius: 3, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <Btn onClick={handle} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
          {loading ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </Btn>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.textMid }}>
          {mode === 'login'
            ? <>Pas encore de compte ?{' '}<span onClick={() => { setMode('register'); setError('') }} style={{ color: C.accentTxt, fontWeight: 700, cursor: 'pointer' }}>S'inscrire</span></>
            : <>Déjà inscrit ?{' '}<span onClick={() => { setMode('login'); setError('') }} style={{ color: C.accentTxt, fontWeight: 700, cursor: 'pointer' }}>Se connecter</span></>
          }
        </div>
      </div>
    </div>
  )
}