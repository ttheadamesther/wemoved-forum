import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const keys = Object.keys(localStorage)
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (authKey) {
      const data = JSON.parse(localStorage.getItem(authKey))
      if (data?.access_token) return data.access_token
    }
  } catch {}
  return ANON_KEY
}

const PANEL = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderTop: `3px solid ${C.accentDk}`,
  borderRadius: 14,
  padding: 24,
  marginBottom: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
}

const Row = ({ icon, label, children }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
    <span style={{ fontSize: 20, width: 28, textAlign: 'center', marginTop: 2 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  </div>
)

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  // ── Pseudo ──
  const [newPseudo,    setNewPseudo]    = useState('')
  const [pseudoError,  setPseudoError]  = useState('')
  const [pseudoOk,     setPseudoOk]     = useState(false)
  const [savingPseudo, setSavingPseudo] = useState(false)
  const [editPseudo,   setEditPseudo]   = useState(false)

  // ── Email ──
  const [newEmail,    setNewEmail]    = useState('')
  const [emailError,  setEmailError]  = useState('')
  const [emailOk,     setEmailOk]     = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [editEmail,   setEditEmail]   = useState(false)

  // ── Mot de passe ──
  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [pwdError,    setPwdError]    = useState('')
  const [pwdOk,       setPwdOk]       = useState(false)
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [editPwd,     setEditPwd]     = useState(false)

  // ── Supprimer compte ──
  const [showDelete,   setShowDelete]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,     setDeleting]     = useState(false)

  if (!user || !profile) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Non connecté</div>

  const apiFetch = async (path, opts = {}) => {
    const token = await getToken()
    return fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
    })
  }

  const savePseudo = async () => {
    setPseudoError(''); setPseudoOk(false)
    if (!newPseudo.trim()) return setPseudoError('Le pseudo ne peut pas être vide.')
    if (newPseudo.trim().length < 3) return setPseudoError('3 caractères minimum.')
    if (newPseudo.trim().length > 20) return setPseudoError('20 caractères maximum.')
    if (!/^[a-zA-Z0-9_]+$/.test(newPseudo.trim())) return setPseudoError('Lettres, chiffres et _ uniquement.')
    setSavingPseudo(true)
    const check = await apiFetch(`/rest/v1/profiles?pseudo=ilike.${newPseudo.trim()}&id=neq.${user.id}&limit=1`)
    const existing = await check.json()
    if (Array.isArray(existing) && existing.length > 0) { setPseudoError('Ce pseudo est déjà pris.'); setSavingPseudo(false); return }
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', body: JSON.stringify({ pseudo: newPseudo.trim() }) })
    await refreshProfile()
    setSavingPseudo(false); setPseudoOk(true); setEditPseudo(false); setNewPseudo('')
  }

  const saveEmail = async () => {
    setEmailError(''); setEmailOk(false)
    if (!newEmail.trim() || !newEmail.includes('@')) return setEmailError('Email invalide.')
    setSavingEmail(true)
    const token = await getToken()
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { error } = await sb.auth.updateUser({ email: newEmail.trim() })
    setSavingEmail(false)
    if (error) return setEmailError(error.message)
    setEmailOk(true); setEditEmail(false); setNewEmail('')
  }

  const savePassword = async () => {
    setPwdError(''); setPwdOk(false)
    if (!newPwd) return setPwdError('Le nouveau mot de passe est requis.')
    if (newPwd.length < 6) return setPwdError('6 caractères minimum.')
    if (newPwd !== confirmPwd) return setPwdError('Les mots de passe ne correspondent pas.')
    setSavingPwd(true)
    const token = await getToken()
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { error } = await sb.auth.updateUser({ password: newPwd })
    setSavingPwd(false)
    if (error) return setPwdError(error.message)
    setPwdOk(true); setEditPwd(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
  }

  const deleteAccount = async () => {
    if (deleteConfirm !== profile.pseudo) return
    setDeleting(true)
    // Supprimer le profil (les autres données seront cascadées)
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE' })
    await signOut()
    navigate('/')
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMid, fontSize: 13, fontWeight: 600, padding: 0 }}>← Retour</button>
        <h1 style={{ fontWeight: 700, fontSize: 20, color: C.text, margin: 0 }}>⚙️ Paramètres du compte</h1>
      </div>

      {/* Pseudo */}
      <div style={PANEL}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>✏️ Pseudo</div>
        <Row icon="👤" label="Pseudo actuel">
          {editPseudo ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <Input value={newPseudo} onChange={e => { setNewPseudo(e.target.value); setPseudoError('') }} placeholder={profile.pseudo} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && savePseudo()} autoFocus />
                <Btn onClick={savePseudo} variant="yellow" style={{ fontSize: 12 }}>{savingPseudo ? '…' : 'OK'}</Btn>
                <Btn onClick={() => { setEditPseudo(false); setNewPseudo(''); setPseudoError('') }} variant="ghost" style={{ fontSize: 12 }}>✕</Btn>
              </div>
              {pseudoError && <div style={{ fontSize: 11, color: C.red }}>{pseudoError}</div>}
              <div style={{ fontSize: 10, color: C.textDim }}>Lettres, chiffres et _ · 3–20 caractères</div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>@{profile.pseudo}</span>
              <button onClick={() => { setEditPseudo(true); setNewPseudo(profile.pseudo) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600 }}>Modifier</button>
            </div>
          )}
          {pseudoOk && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 4 }}>✓ Pseudo mis à jour !</div>}
        </Row>
      </div>

      {/* Email */}
      <div style={PANEL}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>📧 Adresse email</div>
        <Row icon="✉️" label="Email actuel">
          {editEmail ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <Input value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError('') }} placeholder={user.email} type="email" style={{ flex: 1 }} autoFocus />
                <Btn onClick={saveEmail} variant="yellow" style={{ fontSize: 12 }}>{savingEmail ? '…' : 'OK'}</Btn>
                <Btn onClick={() => { setEditEmail(false); setNewEmail(''); setEmailError('') }} variant="ghost" style={{ fontSize: 12 }}>✕</Btn>
              </div>
              {emailError && <div style={{ fontSize: 11, color: C.red }}>{emailError}</div>}
              <div style={{ fontSize: 10, color: C.textDim }}>Un email de confirmation sera envoyé à la nouvelle adresse.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.text }}>{user.email}</span>
              <button onClick={() => setEditEmail(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600 }}>Modifier</button>
            </div>
          )}
          {emailOk && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 4 }}>✓ Vérifie ta boîte mail pour confirmer.</div>}
        </Row>
      </div>

      {/* Mot de passe */}
      <div style={PANEL}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>🔒 Mot de passe</div>
        <Row icon="🔑" label="Changer le mot de passe">
          {editPwd ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Input value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError('') }} placeholder="Nouveau mot de passe" type="password" style={{ width: '100%' }} autoFocus />
              <Input value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdError('') }} placeholder="Confirmer le mot de passe" type="password" style={{ width: '100%' }} />
              {pwdError && <div style={{ fontSize: 11, color: C.red }}>{pwdError}</div>}
              <div style={{ fontSize: 10, color: C.textDim }}>6 caractères minimum.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={savePassword} variant="yellow" style={{ fontSize: 12 }}>{savingPwd ? '…' : 'Changer le mot de passe'}</Btn>
                <Btn onClick={() => { setEditPwd(false); setNewPwd(''); setConfirmPwd(''); setPwdError('') }} variant="ghost" style={{ fontSize: 12 }}>Annuler</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.textMid }}>••••••••</span>
              <button onClick={() => setEditPwd(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600 }}>Modifier</button>
            </div>
          )}
          {pwdOk && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 4 }}>✓ Mot de passe mis à jour !</div>}
        </Row>
      </div>

      {/* Supprimer le compte */}
      <div style={{ ...PANEL, borderTop: `3px solid ${C.red}` }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.red, marginBottom: 4 }}>⚠️ Zone dangereuse</div>
        <Row icon="🗑" label="Supprimer mon compte">
          {showDelete ? (
            <div>
              <p style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>
                Cette action est <strong>irréversible</strong>. Toutes tes données seront supprimées.<br />
                Tape ton pseudo <strong>@{profile.pseudo}</strong> pour confirmer.
              </p>
              <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={profile.pseudo} style={{ width: '100%', marginBottom: 10, borderColor: C.red }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={deleteAccount} disabled={deleteConfirm !== profile.pseudo || deleting}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: deleteConfirm === profile.pseudo ? C.red : '#ccc', color: '#fff', fontWeight: 700, fontSize: 12, cursor: deleteConfirm === profile.pseudo ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  {deleting ? '…' : 'Supprimer définitivement'}
                </button>
                <Btn onClick={() => { setShowDelete(false); setDeleteConfirm('') }} variant="ghost" style={{ fontSize: 12 }}>Annuler</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: C.textDim }}>Supprimer définitivement ton compte et toutes tes données.</span>
              <button onClick={() => setShowDelete(true)} style={{ background: 'none', border: `1px solid ${C.red}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, color: C.red, fontWeight: 600, padding: '4px 10px', fontFamily: 'inherit' }}>Supprimer</button>
            </div>
          )}
        </Row>
      </div>
    </div>
  )
}