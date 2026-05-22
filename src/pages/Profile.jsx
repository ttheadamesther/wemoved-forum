import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { useAuth } from '../hooks/useAuth'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Btn, Input, Textarea } from '../components/UI'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  const key = Object.keys(localStorage).find(k => k.includes('auth-token')) || ''
  try { return JSON.parse(localStorage.getItem(key))?.access_token || ANON_KEY } catch { return ANON_KEY }
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, ...opts.headers }
  })
  return res
}

function getCroppedBlob(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = pixelCrop.width
      canvas.height = pixelCrop.height
      canvas.getContext('2d').drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0, 0,
        pixelCrop.width,
        pixelCrop.height
      )
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('toBlob failed'))
      }, 'image/jpeg', 0.9)
    }
    image.onerror = reject
    image.src = imageSrc
  })
}

const resizeImage = (file, maxSize = 1000) => {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width  = img.width  * ratio
      canvas.height = img.height * ratio
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #2d1b4e, #1a0a2e)',
  'linear-gradient(135deg, #1a2a1a, #0d1f0d)',
  'linear-gradient(135deg, #2a1a0a, #1a0a00)',
  'linear-gradient(135deg, #1a0a0a, #2a0a0a)',
  'linear-gradient(135deg, #111, #333)',
  'linear-gradient(135deg, #0a1628, #1a2a4a)',
]

export default function Profile() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [editing, setEditing]               = useState(false)
  const [bio, setBio]                       = useState('')
  const [interest, setInterest]             = useState('')
  const [saving, setSaving]                 = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showBannerPicker, setShowBannerPicker] = useState(false)

  // Crop avatar
  const [cropSrc,      setCropSrc]      = useState(null)
  const [crop,         setCrop]         = useState({ x: 0, y: 0 })
  const [zoom,         setZoom]         = useState(1)
  const [croppedArea,  setCroppedArea]  = useState(null)

  // Crop bannière
  const [bannerCropSrc,     setBannerCropSrc]     = useState(null)
  const [bannerCrop,        setBannerCrop]        = useState({ x: 0, y: 0 })
  const [bannerZoom,        setBannerZoom]        = useState(1)
  const [bannerCroppedArea, setBannerCroppedArea] = useState(null)
  const [uploadingBanner,   setUploadingBanner]   = useState(false)

  const avatarRef = useRef()
  const photoRef  = useRef()
  const bannerRef = useRef()

  const onCropComplete        = useCallback((_, p) => setCroppedArea(p), [])
  const onBannerCropComplete  = useCallback((_, p) => setBannerCroppedArea(p), [])

  if (loading)  return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Chargement…</div>
  if (!user)    return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Non connecté</div>
  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Profil introuvable</div>

  const startEdit = () => { setBio(profile.bio || ''); setEditing(true) }

  const patchProfile = async (body) => {
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    })
    await refreshProfile()
  }

  const save = async () => {
    setSaving(true)
    await patchProfile({ bio })
    setSaving(false)
    setEditing(false)
  }

  const addInterest = async () => {
    if (!interest.trim()) return
    await patchProfile({ interests: [...(profile.interests || []), interest.trim()] })
    setInterest('')
  }

  const removeInterest = async (item) => {
    await patchProfile({ interests: (profile.interests || []).filter(i => i !== item) })
  }

  // ── AVATAR ──
  const uploadAvatar = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 }); setZoom(1)
    e.target.value = ''
  }

  const confirmAvatarCrop = async () => {
    if (!cropSrc || !croppedArea) return
    setUploading(true)
    const blob  = await getCroppedBlob(cropSrc, croppedArea)
    const path  = `${user.id}/avatar.jpg`
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: blob
    })
    await patchProfile({ avatar_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}` })
    URL.revokeObjectURL(cropSrc); setCropSrc(null); setUploading(false)
  }

  const cancelAvatarCrop = () => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null) }

  // ── BANNIÈRE ──
  const selectBanner = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBannerCropSrc(URL.createObjectURL(file))
    setBannerCrop({ x: 0, y: 0 }); setBannerZoom(1)
    e.target.value = ''
    setShowBannerPicker(false)
  }

const confirmBannerCrop = async () => {
  if (!bannerCropSrc || !bannerCroppedArea) return
  setUploadingBanner(true)
  const croppedBlob = await getCroppedBlob(bannerCropSrc, bannerCroppedArea)
  
  // Resize à 1200x400 max
  const croppedFile = new File([croppedBlob], 'banner.jpg', { type: 'image/jpeg' })
  const resized = await resizeImage(croppedFile, 1200)
  
  const path  = `${user.id}/banner.jpg`
  const token = await getToken()
  await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: resized
  })
  await patchProfile({ banner_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`, banner_gradient: null })
  URL.revokeObjectURL(bannerCropSrc); setBannerCropSrc(null); setUploadingBanner(false)
}

  const cancelBannerCrop = () => { if (bannerCropSrc) URL.revokeObjectURL(bannerCropSrc); setBannerCropSrc(null) }

  // ── PHOTOS ──
  const uploadPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    const resized = await resizeImage(file, 1000)
    const path    = `${user.id}/${Date.now()}.jpg`
    const token   = await getToken()
    await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${path}`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
      body: resized
    })
    await patchProfile({ photos: [...(profile.photos || []), `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`] })
    setUploadingPhoto(false)
  }

  const removePhoto = async (url) => {
    await patchProfile({ photos: (profile.photos || []).filter(p => p !== url) })
  }

  const votes      = profile.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const sexeLabel  = profile.sexe ? profile.sexe.charAt(0).toUpperCase() + profile.sexe.slice(1) : null
  const colors     = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(profile.pseudo?.charCodeAt(0) || 0) % colors.length]
  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: profile.banner_gradient || BANNER_GRADIENTS[0] }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 24 }}>

      {/* ── MODAL CROP AVATAR ── */}
      {cropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, borderRadius: 12, overflow: 'hidden', width: 400, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14, color: C.text }}>Recadrer la photo de profil</div>
            <div style={{ position: 'relative', width: 400, height: 400, background: '#222' }}>
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.textMid, marginBottom: 8 }}>Zoom</div>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentDk }} />
            </div>
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={cancelAvatarCrop} variant="ghost">Annuler</Btn>
              <Btn onClick={confirmAvatarCrop} variant="yellow">{uploading ? '…' : 'Confirmer'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CROP BANNIÈRE ── */}
      {bannerCropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, borderRadius: 12, overflow: 'hidden', width: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14, color: C.text }}>Recadrer la bannière</div>
            <div style={{ position: 'relative', width: 600, height: 240, background: '#222' }}>
              <Cropper image={bannerCropSrc} crop={bannerCrop} zoom={bannerZoom} aspect={3} showGrid={false} onCropChange={setBannerCrop} onZoomChange={setBannerZoom} onCropComplete={onBannerCropComplete} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.textMid, marginBottom: 8 }}>Zoom</div>
              <input type="range" min={1} max={3} step={0.01} value={bannerZoom} onChange={e => setBannerZoom(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentDk }} />
            </div>
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={cancelBannerCrop} variant="ghost">Annuler</Btn>
              <Btn onClick={confirmBannerCrop} variant="yellow">{uploadingBanner ? '…' : 'Confirmer'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── BANNIÈRE ── */}
      <div style={{ position: 'relative', height: 180, ...bannerStyle }}>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBannerPicker(p => !p)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            🎨 Bannière
          </button>
        </div>

        {/* Picker bannière */}
        {showBannerPicker && (
          <div style={{ position: 'absolute', top: 44, right: 12, background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,.2)', zIndex: 100, width: 280 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Choisir un dégradé</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
              {BANNER_GRADIENTS.map((g, i) => (
                <div key={i} onClick={async () => { await patchProfile({ banner_gradient: g, banner_url: null }); setShowBannerPicker(false) }}
                  style={{ height: 36, borderRadius: 8, background: g, cursor: 'pointer', border: profile.banner_gradient === g ? '2px solid #c8a200' : '2px solid transparent', transition: 'all .15s' }} />
              ))}
            </div>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Ou une image</div>
            <button onClick={() => bannerRef.current.click()} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px dashed ${C.borderMid}`, background: '#fafafa', color: C.textMid, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              📸 Importer et recadrer
            </button>
            <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={selectBanner} />
          </div>
        )}
      </div>

      {/* ── HEADER PROFIL ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 24px 20px', marginBottom: 16 }}>
        <div style={{ position: 'relative', display: 'inline-block', marginTop: -48 }}>
          <div onClick={() => avatarRef.current.click()} style={{ width: 96, height: 96, borderRadius: '50%', background: profile.avatar_url ? '#444' : avatarColor, border: '4px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32, color: '#fff', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : profile.initials || profile.pseudo?.slice(0, 2).toUpperCase()
            }
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '.2s', borderRadius: '50%' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <span style={{ color: '#fff', fontSize: 20 }}>{uploading ? '…' : '📷'}</span>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 20, color: C.text }}>@{profile.pseudo}</span>
              <RoleBadge role={profile.role} />
            </div>
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>
              Membre depuis {profile.joined}
              {profile.age && ` · ${profile.age} ans`}
              {sexeLabel   && ` · ${sexeLabel}`}
            </div>
            {profile.city && (
              <div style={{ fontSize: 12, color: C.textMid }}>
                📍 {profile.city}{profile.dept ? `, ${profile.dept}` : ''}
              </div>
            )}
          </div>
          <Btn onClick={startEdit} variant="ghost" style={{ marginTop: 4 }}>Modifier</Btn>
        </div>
      </div>

      {/* ── CONTENU ── */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Bio */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Bio</div>
            {editing ? (
              <>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Parle de toi…" rows={4} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Btn onClick={save} variant="yellow">{saving ? '…' : 'Sauvegarder'}</Btn>
                  <Btn onClick={() => setEditing(false)} variant="ghost">Annuler</Btn>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>
                {profile.bio || <span style={{ color: C.textDim, fontStyle: 'italic' }}>Aucune bio</span>}
              </p>
            )}
          </div>

          {/* Stats */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Amis',        value: profile.friends || 0 },
                { label: 'Posts',       value: profile.posts   || 0 },
                { label: 'Votes reçus', value: totalVotes },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8f8f8', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 22, color: C.text }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textMid }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Votes reçus */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Votes reçus</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {VOTES_DEF.map(v => (
                <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, textAlign: 'center' }}>{v.emoji}</span>
                  <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{v.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{votes[v.key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Intérêts */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Intérêts</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(profile.interests || []).length === 0
                ? <span style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Aucun intérêt ajouté</span>
                : (profile.interests || []).map(i => (
                  <span key={i} onClick={() => removeInterest(i)}
                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: '#f5f5f5', color: C.textMid, border: '1px solid #ddd', cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fffae6'; e.currentTarget.style.borderColor = C.accentDk }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#ddd' }}
                    title="Cliquer pour supprimer"
                  >
                    {i} ✕
                  </span>
                ))
              }
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={interest} onChange={e => setInterest(e.target.value)} placeholder="Ajouter…" onKeyDown={e => e.key === 'Enter' && addInterest()} style={{ flex: 1 }} />
              <Btn onClick={addInterest} variant="yellow">+</Btn>
            </div>
          </div>

        </div>

        {/* Photos */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 12, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8 }}>Photos</div>
            <Btn onClick={() => photoRef.current.click()} variant="ghost" style={{ fontSize: 11 }}>
              {uploadingPhoto ? '…' : '+ Ajouter une photo'}
            </Btn>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
          </div>
          {(profile.photos || []).length === 0
            ? <div style={{ textAlign: 'center', padding: '24px', color: C.textDim, fontSize: 12, fontStyle: 'italic' }}>Aucune photo ajoutée</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {(profile.photos || []).map((url, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removePhoto(url)} style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}