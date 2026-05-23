import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { Logo } from '../components/Logo'
import { useAuth } from '../hooks/useAuth'
import { GeoSelects } from '../components/GeoSelects'

// ✅ Défini HORS du composant pour éviter le re-render à chaque frappe
const Field = ({ label, required, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>
      {label} {required && <span style={{ color: C.red }}>*</span>}
    </label>
    {children}
  </div>
)

export default function Register() {
  const [pseudo,   setPseudo]   = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [age,      setAge]      = useState('')
  const [sexe,     setSexe]     = useState('')
  const [region,   setRegion]   = useState('')
  const [dept,     setDept]     = useState('')
  const [city,     setCity]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { signUp } = useAuth()
  const navigate   = useNavigate()

  const handle = async () => {
    setError('')
    if (!pseudo.trim())       return setError('Le pseudo est obligatoire.')
    if (pseudo.length < 3)    return setError('Le pseudo doit faire au moins 3 caractères.')
    if (!email.trim())        return setError('L\'email est obligatoire.')
    if (password.length < 6)  return setError('Le mot de passe doit faire au moins 6 caractères.')
    if (password !== confirm)  return setError('Les mots de passe ne correspondent pas.')
    if (!sexe)                return setError('Le sexe est obligatoire.')
    if (!age || age < 18)     return setError('Tu dois avoir au moins 18 ans.')
    setLoading(true)
    const { error: err } = await signUp(email, password, pseudo, { age: parseInt(age), sexe, region, dept, city })
    setLoading(false)
    if (err) return setError(err.message)
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '36px 40px', width: 420, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo height={52} />
        </div>

        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>Créer un compte</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: C.textDim, marginBottom: 24 }}>Rejoins la communauté WeMoved</p>

        <Field label="Pseudo" required>
          <Input value={pseudo} onChange={e => setPseudo(e.target.value)} placeholder="ton_pseudo" style={{ width: '100%' }} />
          <span style={{ fontSize: 10, color: C.textDim, marginTop: 3, display: 'block' }}>Visible par tous — 3 caractères min.</span>
        </Field>

        <Field label="Email" required>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" type="email" style={{ width: '100%' }} />
        </Field>

        <Field label="Mot de passe" required>
          <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={{ width: '100%' }} />
          <span style={{ fontSize: 10, color: C.textDim, marginTop: 3, display: 'block' }}>6 caractères minimum.</span>
        </Field>

        <Field label="Confirmer le mot de passe" required>
          <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" type="password"
            style={{ width: '100%', borderColor: confirm && confirm !== password ? C.red : undefined }} />
          {confirm && confirm !== password && <span style={{ fontSize: 10, color: C.red, marginTop: 3, display: 'block' }}>Ne correspond pas.</span>}
        </Field>

        {/* Âge + Sexe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Âge <span style={{ color: C.red }}>*</span></label>
            <Input value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 25" type="number" min="18" max="99" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Sexe <span style={{ color: C.red }}>*</span></label>
            <select value={sexe} onChange={e => setSexe(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${C.borderMid}`, borderRadius: 2, fontSize: 13, color: C.text, background: C.white, fontFamily: "'Open Sans',sans-serif" }}>
              <option value="">Choisir…</option>
              <option value="homme">Homme</option>
              <option value="femme">Femme</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        {/* Localisation */}
        <Field label="Localisation">
          <GeoSelects region={region} dept={dept} city={city} onRegion={setRegion} onDept={setDept} onCity={setCity} />
          <span style={{ fontSize: 10, color: C.textDim, marginTop: 3, display: 'block' }}>Optionnel — visible sur ton profil.</span>
        </Field>

        {error && (
          <div style={{ background: '#ffe0e0', border: `1px solid ${C.red}`, borderRadius: 3, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <Btn onClick={handle} variant="yellow" style={{ width: '100%', padding: '9px 0', fontSize: 13 }}>
          {loading ? '…' : 'Créer mon compte'}
        </Btn>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.textMid }}>
          Déjà inscrit ?{' '}
          <Link to="/login" style={{ color: C.accentTxt, fontWeight: 700 }}>Se connecter</Link>
        </div>
      </div>
    </div>
  )
}
