import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { GeoSelects } from '../components/GeoSelects'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

const MAX_DATE = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0] })()
const MIN_DATE = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 100); return d.toISOString().split('T')[0] })()
function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date(); const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

async function getToken() {
  try {
    const keys = Object.keys(localStorage)
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (authKey) { const data = JSON.parse(localStorage.getItem(authKey)); if (data?.access_token) return data.access_token }
  } catch {}
  return ANON_KEY
}

const STATUTS = [
  { value: '',            label: 'Non renseigné',   emoji: '—' },
  { value: 'celibataire', label: 'Célibataire',     emoji: '💚' },
  { value: 'couple',      label: 'En couple',       emoji: '❤️' },
  { value: 'complique',   label: "C'est compliqué", emoji: '💛' },
]

const PANEL = { background: C.white, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.accentDk}`, borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }

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

  const [newPseudo,    setNewPseudo]    = useState('')
  const [pseudoError,  setPseudoError]  = useState('')
  const [pseudoOk,     setPseudoOk]     = useState(false)
  const [savingPseudo, setSavingPseudo] = useState(false)
  const [editPseudo,   setEditPseudo]   = useState(false)

  const [newEmail,    setNewEmail]    = useState('')
  const [emailError,  setEmailError]  = useState('')
  const [emailOk,     setEmailOk]     = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [editEmail,   setEditEmail]   = useState(false)

  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError,   setPwdError]   = useState('')
  const [pwdOk,      setPwdOk]      = useState(false)
  const [savingPwd,  setSavingPwd]  = useState(false)
  const [editPwd,    setEditPwd]    = useState(false)

  const [editAge,    setEditAge]    = useState(false)
  const [birthDate,  setBirthDate]  = useState('')
  const [ageOk,      setAgeOk]      = useState(false)
  const [savingAge,  setSavingAge]  = useState(false)

  // Infos perso
  const [editInfos,   setEditInfos]   = useState(false)
  const [infosRegion, setInfosRegion] = useState('')
  const [infosDept,   setInfosDept]   = useState('')
  const [infosCity,   setInfosCity]   = useState('')
  const [infosStatut, setInfosStatut] = useState('')
  const [savingInfos, setSavingInfos] = useState(false)
  const [infosOk,     setInfosOk]     = useState(false)

  const [showDelete,    setShowDelete]    = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,      setDeleting]      = useState(false)

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
    setPwdOk(true); setEditPwd(false); setNewPwd(''); setConfirmPwd('')
  }

  const saveAge = async () => {
    if (!birthDate) return
    const age = calcAge(birthDate)
    if (!age || age < 18) return
    setSavingAge(true)
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', body: JSON.stringify({ age, birth_date: birthDate }) })
    await refreshProfile()
    setSavingAge(false); setAgeOk(true); setEditAge(false); setBirthDate('')
  }

  const openEditInfos = () => {
    setInfosRegion(profile.region || '')
    setInfosDept(profile.dept || '')
    setInfosCity(profile.city || '')
    setInfosStatut(profile.statut || '')
    setEditInfos(true)
  }

  const saveInfos = async () => {
    setSavingInfos(true)
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ region: infosRegion, dept: infosDept, city: infosCity, statut: infosStatut })
    })
    await refreshProfile()
    setSavingInfos(false); setInfosOk(true); setEditInfos(false)
    setTimeout(() => setInfosOk(false), 3000)
  }

  const deleteAccount = async () => {
    if (deleteConfirm !== profile.pseudo) return
    setDeleting(true)
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE' })
    await signOut()
    navigate('/')
  }

  const statutDef = STATUTS.find(s => s.value === (profile.statut || '')) || STATUTS[0]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 28px' }}>
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

      {/* Âge */}
      <div style={PANEL}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>🎂 Âge</div>
        <Row icon="🎂" label="Année de naissance">
          {editAge ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} min={MIN_DATE} max={MAX_DATE}
                  style={{ flex: 1, padding: '7px 10px', border: `1px solid ${C.borderMid}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.white, fontFamily: 'inherit' }} />
                <Btn onClick={saveAge} variant="yellow" style={{ fontSize: 12 }} disabled={!birthDate}>{savingAge ? '…' : 'OK'}</Btn>
                <Btn onClick={() => { setEditAge(false); setBirthDate('') }} variant="ghost" style={{ fontSize: 12 }}>✕</Btn>
              </div>
              {birthDate && calcAge(birthDate) !== null && (
                <div style={{ fontSize: 11, color: calcAge(birthDate) >= 18 ? C.textDim : C.red }}>
                  {calcAge(birthDate) >= 18 ? `Âge calculé : ${calcAge(birthDate)} ans` : `${calcAge(birthDate)} ans — minimum 18 ans requis`}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.text }}>{profile.age ? `${profile.age} ans` : 'Non renseigné'}</span>
              <button onClick={() => setEditAge(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600 }}>Modifier</button>
            </div>
          )}
          {ageOk && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 4 }}>✓ Âge mis à jour !</div>}
        </Row>
      </div>

      {/* Infos personnelles */}
      <div style={PANEL}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>📍 Infos personnelles</div>
        {editInfos ? (
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Localisation</div>
            <GeoSelects region={infosRegion} dept={infosDept} city={infosCity}
              onRegion={v => { setInfosRegion(v); setInfosDept(''); setInfosCity('') }}
              onDept={v => { setInfosDept(v); setInfosCity('') }}
              onCity={setInfosCity} />
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, margin: '16px 0 8px' }}>Statut relationnel</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {STATUTS.map(s => (
                <button key={s.value} onClick={() => setInfosStatut(s.value)}
                  style={{ padding: '7px 14px', borderRadius: 20, cursor: 'pointer', background: infosStatut === s.value ? '#fffae6' : C.surfaceB, border: `1px solid ${infosStatut === s.value ? C.accentDk : C.border}`, color: infosStatut === s.value ? C.accentTxt : C.textMid, fontSize: 12, fontFamily: 'inherit', fontWeight: infosStatut === s.value ? 700 : 400, transition: 'all .15s' }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={saveInfos} variant="yellow">{savingInfos ? '…' : 'Sauvegarder'}</Btn>
              <Btn onClick={() => setEditInfos(false)} variant="ghost">Annuler</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {[
                { icon: '🌍', label: 'Région',      value: profile.region },
                { icon: '🗺️', label: 'Département',  value: profile.dept },
                { icon: '📍', label: 'Ville',        value: profile.city },
                { icon: statutDef.emoji, label: 'Statut', value: statutDef.value ? statutDef.label : null },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.surfaceB, borderRadius: 10 }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: item.value ? C.text : C.textDim, fontStyle: item.value ? 'normal' : 'italic', fontWeight: item.value ? 600 : 400 }}>
                    {item.value || 'Non renseigné'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={openEditInfos} style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600, padding: 0 }}>✏️ Modifier</button>
            {infosOk && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 6 }}>✓ Infos mises à jour !</div>}
          </div>
        )}
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
                <Btn onClick={savePassword} variant="yellow" style={{ fontSize: 12 }}>{savingPwd ? '…' : 'Changer'}</Btn>
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

      {/* Zone dangereuse */}
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