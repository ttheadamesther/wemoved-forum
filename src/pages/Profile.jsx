import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import { useAuth } from '../hooks/useAuth'
import { C, VOTES_DEF, ROLE_RING } from '../lib/constants'
import { BADGES_DEF } from '../lib/xp'
import { RoleBadge, Btn, Input, Textarea } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const keys = Object.keys(localStorage)
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (authKey) { const data = JSON.parse(localStorage.getItem(authKey)); if (data?.access_token) return data.access_token }
    const oldKey = keys.find(k => k.includes('auth-token'))
    if (oldKey) { const data = JSON.parse(localStorage.getItem(oldKey)); if (data?.access_token) return data.access_token }
  } catch {}
  return ANON_KEY
}

async function apiFetch(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, ...opts.headers }
  })
}

function getCroppedBlob(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width; canvas.height = pixelCrop.height
      canvas.getContext('2d').drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.9)
    }
    image.onerror = reject; image.src = imageSrc
  })
}

const resizeImage = (file, maxSize = 1000) => new Promise((resolve) => {
  const img = new Image(); const url = URL.createObjectURL(file)
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
    canvas.width = img.width * ratio; canvas.height = img.height * ratio
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url); canvas.toBlob(resolve, 'image/jpeg', 0.85)
  }
  img.src = url
})

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

const STATUTS = [
  { value: '',            label: 'Non renseigné',   emoji: '—' },
  { value: 'celibataire', label: 'Célibataire',     emoji: '💚' },
  { value: 'couple',      label: 'En couple',       emoji: '❤️' },
  { value: 'complique',   label: "C'est compliqué", emoji: '💛' },
]

const PANEL = { background: C.white, border: '1px solid #e8e0c8', borderTop: '3px solid #c8a200', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }
const Tag = ({ icon, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20, border: '1px solid #e8e8e8' }}>
    {icon} {label}
  </span>
)

export default function Profile() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [friendsList,    setFriendsList]    = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingProfiles, setPendingProfiles] = useState([])

  useEffect(() => {
    if (!user) return
    const loadFriends = async () => {
      setFriendsLoading(true)
      const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${user.id}&status=eq.accepted&select=user_b`, { headers: h })
      const d1 = await r1.json()
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_b=eq.${user.id}&status=eq.accepted&select=user_a`, { headers: h })
      const d2 = await r2.json()
      const friendIds = [
        ...(Array.isArray(d1) ? d1.map(f => f.user_b) : []),
        ...(Array.isArray(d2) ? d2.map(f => f.user_a) : [])
      ]
      if (friendIds.length > 0) {
        const rp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${friendIds.join(',')})&select=id,pseudo,initials,avatar_url,online`, { headers: h })
        const dp = await rp.json()
        setFriendsList(Array.isArray(dp) ? dp : [])
      } else {
        setFriendsList([])
      }
      setFriendsLoading(false)
    }

    const loadPending = async () => {
      const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      const rp = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_b=eq.${user.id}&status=eq.pending&select=*`, { headers: h })
      const dp = await rp.json()
      if (Array.isArray(dp) && dp.length > 0) {
        setPendingRequests(dp)
        const ids = dp.map(f => f.user_a)
        const rpr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,pseudo,initials,avatar_url`, { headers: h })
        const dpr = await rpr.json()
        setPendingProfiles(Array.isArray(dpr) ? dpr : [])
      } else {
        setPendingRequests([])
        setPendingProfiles([])
      }
    }

    loadFriends()
    loadPending()
  }, [user])

  const acceptFriend = async (friendship) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/friendships?id=eq.${friendship.id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' })
    })
    setPendingRequests(p => p.filter(f => f.id !== friendship.id))
    const accepted = pendingProfiles.find(p => p.id === friendship.user_a)
    if (accepted) setFriendsList(prev => [...prev, accepted])
  }

  const rejectFriend = async (friendship) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/friendships?id=eq.${friendship.id}`, {
      method: 'DELETE',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
    })
    setPendingRequests(p => p.filter(f => f.id !== friendship.id))
    setPendingProfiles(p => p.filter(pr => pr.id !== friendship.user_a))
  }

  const [editing,      setEditing]      = useState(false)
  const [bio,          setBio]          = useState('')
  const [interest,     setInterest]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showBannerPicker, setShowBannerPicker] = useState(false)
  const [cropSrc,      setCropSrc]      = useState(null)
  const [crop,         setCrop]         = useState({ x: 0, y: 0 })
  const [zoom,         setZoom]         = useState(1)
  const [croppedArea,  setCroppedArea]  = useState(null)
  const [bannerCropSrc, setBannerCropSrc]     = useState(null)
  const [bannerCrop,    setBannerCrop]         = useState({ x: 0, y: 0 })
  const [bannerZoom,    setBannerZoom]         = useState(1)
  const [bannerCroppedArea, setBannerCroppedArea] = useState(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [editingInfos, setEditingInfos] = useState(false)
  const [infosRegion,  setInfosRegion]  = useState('')
  const [infosDept,    setInfosDept]    = useState('')
  const [infosCity,    setInfosCity]    = useState('')
  const [infosStatut,  setInfosStatut]  = useState('')
  const [savingInfos,  setSavingInfos]  = useState(false)
  const [lightbox,     setLightbox]     = useState(null) // { url, index }
  const [likerProfiles, setLikerProfiles] = useState([])

  const avatarRef = useRef()
  const photoRef  = useRef()
  const bannerRef = useRef()

  const onCropComplete       = useCallback((_, p) => setCroppedArea(p), [])
  const onBannerCropComplete = useCallback((_, p) => setBannerCroppedArea(p), [])

  if (loading)  return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Chargement…</div>
  if (!user)    return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Non connecté</div>
  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Profil introuvable</div>

  const patchProfile = async (body) => {
    await apiFetch(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify(body)
    })
    await refreshProfile()
  }

  const save = async () => { setSaving(true); await patchProfile({ bio }); setSaving(false); setEditing(false) }
  const addInterest = async () => { if (!interest.trim()) return; await patchProfile({ interests: [...(profile.interests || []), interest.trim()] }); setInterest('') }
  const removeInterest = async (item) => { await patchProfile({ interests: (profile.interests || []).filter(i => i !== item) }) }

  const openEditInfos = () => { setInfosRegion(profile.region || ''); setInfosDept(profile.dept || ''); setInfosCity(profile.city || ''); setInfosStatut(profile.statut || ''); setEditingInfos(true) }
  const saveInfos = async () => { setSavingInfos(true); await patchProfile({ region: infosRegion, dept: infosDept, city: infosCity, statut: infosStatut }); setSavingInfos(false); setEditingInfos(false) }

  const uploadAvatar = (e) => {
    const file = e.target.files[0]; if (!file) return
    setCropSrc(URL.createObjectURL(file)); setCrop({ x: 0, y: 0 }); setZoom(1); e.target.value = ''
  }
  const confirmAvatarCrop = async () => {
    if (!cropSrc || !croppedArea) return; setUploading(true)
    const blob = await getCroppedBlob(cropSrc, croppedArea)
    const path = `${user.id}/avatar.jpg`; const token = await getToken()
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, { method: 'POST', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: blob })
    await patchProfile({ avatar_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}` })
    URL.revokeObjectURL(cropSrc); setCropSrc(null); setUploading(false)
  }
  const cancelAvatarCrop = () => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null) }

  const selectBanner = (e) => {
    const file = e.target.files[0]; if (!file) return
    setBannerCropSrc(URL.createObjectURL(file)); setBannerCrop({ x: 0, y: 0 }); setBannerZoom(1); e.target.value = ''; setShowBannerPicker(false)
  }
  const confirmBannerCrop = async () => {
    if (!bannerCropSrc || !bannerCroppedArea) return; setUploadingBanner(true)
    const croppedBlob = await getCroppedBlob(bannerCropSrc, bannerCroppedArea)
    const resized = await resizeImage(new File([croppedBlob], 'banner.jpg', { type: 'image/jpeg' }), 1200)
    const path = `${user.id}/banner.jpg`; const token = await getToken()
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, { method: 'POST', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: resized })
    await patchProfile({ banner_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`, banner_gradient: null })
    URL.revokeObjectURL(bannerCropSrc); setBannerCropSrc(null); setUploadingBanner(false)
  }
  const cancelBannerCrop = () => { if (bannerCropSrc) URL.revokeObjectURL(bannerCropSrc); setBannerCropSrc(null) }

  const uploadPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return; setUploadingPhoto(true)
    const resized = await resizeImage(file, 1000)
    const path = `${user.id}/${Date.now()}.jpg`; const token = await getToken()
    await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${path}`, { method: 'POST', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: resized })
    await patchProfile({ photos: [...(profile.photos || []), `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`] })
    setUploadingPhoto(false)
  }
  const removePhoto = async (url) => { await patchProfile({ photos: (profile.photos || []).filter(p => p !== url) }) }

  const openLightbox = async (url, index) => {
    setLightbox({ url, index }); setLikerProfiles([])
    const photoLikes = profile.photo_likes || {}
    const likerIds = photoLikes[String(index)] || []
    if (likerIds.length === 0) return
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${likerIds.join(',')})&select=id,pseudo,initials,avatar_url`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    })
    const d = await r.json()
    if (Array.isArray(d)) setLikerProfiles(d)
  }

  const votes      = profile.votes || {}
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const sexeLabel  = profile.sexe ? profile.sexe.charAt(0).toUpperCase() + profile.sexe.slice(1) : null
  const statutDef  = STATUTS.find(s => s.value === (profile.statut || '')) || STATUTS[0]
  const colors     = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(profile.pseudo?.charCodeAt(0) || 0) % colors.length]
  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: profile.banner_gradient || BANNER_GRADIENTS[0] }
  const topVote = VOTES_DEF.reduce((best, v) => (votes[v.key] || 0) > (votes[best?.key] || 0) ? v : best, null)

  const photoLikes = profile.photo_likes || {}

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 32 }}>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 40px', gap: 16, cursor: 'zoom-out' }}>
          <img src={lightbox.url} alt="" style={{ maxWidth: '88vw', maxHeight: '58vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,.6)', flexShrink: 0 }} onClick={e => e.stopPropagation()} />
          <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 14, padding: '12px 20px', maxWidth: 500, width: '100%', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginBottom: (photoLikes[String(lightbox.index)] || []).length > 0 ? 10 : 0 }}>
              ❤️ {(photoLikes[String(lightbox.index)] || []).length} j'aime{(photoLikes[String(lightbox.index)] || []).length !== 1 ? 's' : ''}
            </div>
            {likerProfiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {likerProfiles.map(lk => {
                  const lkColor = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'][(lk.pseudo?.charCodeAt(0) || 0) % 8]
                  return (
                    <div key={lk.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '4px 10px' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: lk.avatar_url ? '#444' : lkColor, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                        {lk.avatar_url ? <img src={lk.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : lk.initials || lk.pseudo?.slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>@{lk.pseudo}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      {cropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: C.white, borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14 }}>Recadrer la photo de profil</div>
            <div style={{ position: 'relative', width: '100%', height: 300, background: '#222' }}>
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentDk }} />
            </div>
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={cancelAvatarCrop} variant="ghost">Annuler</Btn>
              <Btn onClick={confirmAvatarCrop} variant="yellow">{uploading ? '…' : 'Confirmer'}</Btn>
            </div>
          </div>
        </div>
      )}

      {bannerCropSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: C.white, borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14 }}>Recadrer la bannière</div>
            <div style={{ position: 'relative', width: '100%', height: 200, background: '#222' }}>
              <Cropper image={bannerCropSrc} crop={bannerCrop} zoom={bannerZoom} aspect={3} showGrid={false} onCropChange={setBannerCrop} onZoomChange={setBannerZoom} onCropComplete={onBannerCropComplete} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              <input type="range" min={1} max={3} step={0.01} value={bannerZoom} onChange={e => setBannerZoom(Number(e.target.value))} style={{ width: '100%', accentColor: C.accentDk }} />
            </div>
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={cancelBannerCrop} variant="ghost">Annuler</Btn>
              <Btn onClick={confirmBannerCrop} variant="yellow">{uploadingBanner ? '…' : 'Confirmer'}</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', height: 180, ...bannerStyle }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button onClick={() => setShowBannerPicker(p => !p)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            🎨 Bannière
          </button>
        </div>
        {showBannerPicker && (
          <div style={{ position: 'absolute', top: 44, right: 12, background: C.white, borderRadius: 12, padding: 14, boxShadow: '0 8px 32px rgba(0,0,0,.2)', zIndex: 100, width: 260 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Dégradé</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
              {BANNER_GRADIENTS.map((g, i) => (
                <div key={i} onClick={async () => { await patchProfile({ banner_gradient: g, banner_url: null }); setShowBannerPicker(false) }}
                  style={{ height: 36, borderRadius: 8, background: g, cursor: 'pointer', border: profile.banner_gradient === g ? '2px solid #c8a200' : '2px solid transparent' }} />
              ))}
            </div>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Image</div>
            <button onClick={() => bannerRef.current.click()} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px dashed ${C.borderMid}`, background: C.surfaceB, color: C.textMid, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              📸 Importer et recadrer
            </button>
            <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={selectBanner} />
          </div>
        )}
      </div>

      <div style={{ background: C.white, borderBottom: '1px solid #e8e0c8', padding: '0 20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -44 }}>
          <div style={{ position: 'relative' }}>
            <div onClick={() => avatarRef.current.click()} style={{ width: 88, height: 88, borderRadius: '50%', background: profile.avatar_url ? '#444' : avatarColor, border: ROLE_RING[profile.role] ? `4px solid ${ROLE_RING[profile.role]}` : '4px solid #fff', boxShadow: ROLE_RING[profile.role] ? `0 0 16px ${ROLE_RING[profile.role]}99, 0 4px 16px rgba(0,0,0,.2)` : '0 4px 16px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 28, color: '#fff', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.initials || profile.pseudo?.slice(0, 2).toUpperCase()}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: '.2s', borderRadius: '50%' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <span style={{ color: '#fff', fontSize: 20 }}>{uploading ? '…' : '📷'}</span>
              </div>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: C.text }}>@{profile.pseudo}</span>
            <RoleBadge role={profile.role} />
            <span style={{ fontSize: 12, color: '#c8a200', fontWeight: 700, background: 'rgba(200,162,0,.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid #c8a20044' }}>Niv. {profile.level || 1}</span>
            {topVote && totalVotes > 0 && (
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20066', fontWeight: 700 }}>
                {topVote.emoji} {topVote.label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profile.joined && <Tag icon="📅" label={profile.joined} />}
            {profile.age    && <Tag icon="🎂" label={`${profile.age} ans`} />}
            {sexeLabel      && <Tag icon="👤" label={sexeLabel} />}
            {profile.city   && <Tag icon="📍" label={profile.city} />}
            {profile.dept   && <Tag icon="🗺️" label={profile.dept} />}
            {profile.region && <Tag icon="🏳️" label={profile.region} />}
            {profile.statut && statutDef.value && <Tag icon={statutDef.emoji} label={statutDef.label} />}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={PANEL}>
          {/* Stats + Votes sur la même ligne */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { icon: '👥', label: 'Amis',       value: friendsLoading ? '…' : friendsList.length, color: '#3498db' },
                { icon: '⭐', label: 'Votes reçus', value: totalVotes,                                color: '#c8a200' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {VOTES_DEF.map(v => {
                const val = votes[v.key] || 0
                return (
                  <div key={v.key} title={v.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: val > 0 ? C.accentBg : C.surfaceB, border: `1px solid ${val > 0 ? C.accentDk : C.border}` }}>
                    <span style={{ fontSize: 15 }}>{v.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: val > 0 ? C.accentTxt : C.textDim }}>{val}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Bio */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>✍️ Bio</div>
            {!editing && <button onClick={() => { setBio(profile.bio || ''); setEditing(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.accentTxt, fontWeight: 600 }}>Modifier</button>}
          </div>
          {editing ? (
            <>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Parle de toi…" rows={4} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Btn onClick={save} variant="yellow">{saving ? '…' : 'Sauvegarder'}</Btn>
                <Btn onClick={() => setEditing(false)} variant="ghost">Annuler</Btn>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: profile.bio ? C.text : C.textDim, lineHeight: 1.7, margin: 0, fontStyle: profile.bio ? 'normal' : 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {profile.bio || 'Aucune bio — clique sur Modifier pour en ajouter une.'}
            </div>
          )}
        </div>

        <div style={PANEL}>
          <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>🎯 Intérêts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12, minHeight: 28 }}>
            {(profile.interests || []).length === 0
              ? <span style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Ajoutes-en ci-dessous</span>
              : (profile.interests || []).map(i => (
                <span key={i} onClick={() => removeInterest(i)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20066', cursor: 'pointer', fontWeight: 600, transition: 'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  title="Cliquer pour supprimer">{i} ✕</span>
              ))
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={interest} onChange={e => setInterest(e.target.value)} placeholder="Ajouter un intérêt…" onKeyDown={e => e.key === 'Enter' && addInterest()} style={{ flex: 1 }} />
            <Btn onClick={addInterest} variant="yellow">+</Btn>
          </div>
        </div>

        {(profile.badges || []).length > 0 && (
          <div style={{ ...PANEL, borderTop: '3px solid #c8a200' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>🎖️ Badges obtenus</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {BADGES_DEF.filter(b => (profile.badges || []).includes(b.key)).map(b => (
                <div key={b.key} title={b.desc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'help' }}>
                  <div style={{ width: 58, height: 58, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${b.color || '#c8a200'}bb, ${b.color || '#c8a200'})`, border: `3px solid ${b.color || '#c8a200'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 4px 16px ${b.color || '#c8a200'}55, inset 0 1px 2px rgba(255,255,255,.35)` }}>
                    {b.emoji}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.color || '#7a6200', textAlign: 'center', maxWidth: 64, lineHeight: 1.2 }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div style={{ ...PANEL, borderTop: '3px solid #e67e22' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>
              🔔 Demandes d'amis ({pendingRequests.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingRequests.map(friendship => {
                const sender = pendingProfiles.find(p => p.id === friendship.user_a)
                if (!sender) return null
                const fColor = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'][(sender.pseudo?.charCodeAt(0) || 0) % 8]
                return (
                  <div key={friendship.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fffae6', border: `1px solid ${C.accentDk}`, borderRadius: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: sender.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                      {sender.avatar_url ? <img src={sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : sender.initials || sender.pseudo?.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{sender.pseudo}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>veut être ton ami</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => acceptFriend(friendship)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: '#2ecc71', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✅ Accepter
                      </button>
                      <button onClick={() => rejectFriend(friendship)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ ...PANEL, borderTop: '3px solid #3498db' }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>👥 Amis ({friendsList.length})</div>
          {friendsLoading
            ? <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 12 }}>Chargement…</div>
            : friendsList.length === 0
              ? <div style={{ fontSize: 13, color: C.textDim, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>Aucun ami pour l'instant.</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                  {friendsList.map(f => {
                    const fColor = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'][(f.pseudo?.charCodeAt(0) || 0) % 8]
                    return (
                      <div key={f.id} onClick={() => navigate(`/members/${f.id}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: C.surfaceB, borderRadius: 12, border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#3498db'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: f.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.1)' }}>
                          {f.avatar_url ? <img src={f.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : f.initials || f.pseudo?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>@{f.pseudo}</div>
                        {f.online && <span style={{ fontSize: 9, color: '#2ecc71', fontWeight: 700 }}>● En ligne</span>}
                      </div>
                    )
                  })}
                </div>
          }
        </div>



        <div style={PANEL}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>🖼️ Photos ({(profile.photos || []).length})</div>
            <Btn onClick={() => photoRef.current.click()} variant="ghost" style={{ fontSize: 11 }}>{uploadingPhoto ? '…' : '+ Ajouter'}</Btn>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
          </div>
          {(profile.photos || []).length === 0
            ? <div style={{ textAlign: 'center', padding: '28px', color: C.textDim, fontSize: 13, background: C.surfaceB, borderRadius: 12, border: '1px dashed #ddd' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>Aucune photo ajoutée
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {(profile.photos || []).map((url, i) => {
                  const likers = photoLikes[String(i)] || []
                  return (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e0c8', cursor: 'zoom-in' }}>
                      <img src={url} alt="" onClick={() => openLightbox(url, i)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {likers.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 11, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>❤️ {likers.length}</div>
                      )}
                      <button onClick={() => removePhoto(url)} style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.65)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  )
                })}
              </div>
          }
        </div>

      </div>
    </div>
  )
}