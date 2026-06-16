import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C, VOTES_DEF, ROLE_RING } from '../lib/constants'
import { BADGES_DEF } from '../lib/xp'
import { RoleBadge, Btn, Input, Textarea } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const { supabase } = await import('../lib/supabase')
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) return session.access_token
    }
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
      canvas.width = Math.round(pixelCrop.width)
      canvas.height = Math.round(pixelCrop.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        Math.round(pixelCrop.x), Math.round(pixelCrop.y),
        Math.round(pixelCrop.width), Math.round(pixelCrop.height),
        0, 0,
        Math.round(pixelCrop.width), Math.round(pixelCrop.height)
      )
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.95)
    }
    image.onerror = reject
    image.src = imageSrc
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

const PANEL = { background: 'var(--white)', border: '1px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 16, padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,.07), 0 1px 4px rgba(0,0,0,.05)' }
const Tag = ({ icon, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--textMid)', background: 'var(--surfaceB)', padding: '4px 11px', borderRadius: 99, border: '1px solid var(--border)', fontWeight: 500 }}>
    {icon} {label}
  </span>
)


function BannerPositionModal({ url, initialPosition, initialZoom = 1, onConfirm, onCancel }) {
  const containerRef = useRef()
  const [pos, setPos] = useState(() => {
    const parts = (initialPosition || '50% 50%').split(' ')
    return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 }
  })
  const [zoom, setZoom] = useState(initialZoom)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(1, z - e.deltaY * 0.001))) }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragStart.current.mx) / rect.width * 100 / zoom
    const dy = (e.clientY - dragStart.current.my) / rect.height * 100 / zoom
    setPos({
      x: Math.min(100, Math.max(0, dragStart.current.px - dx)),
      y: Math.min(100, Math.max(0, dragStart.current.py - dy))
    })
  }
  const onMouseUp = () => setDragging(false)

  const onTouchStart = (e) => {
    const t = e.touches[0]
    setDragging(true)
    dragStart.current = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y }
  }
  const onTouchMove = (e) => {
    if (!dragging || !dragStart.current || !containerRef.current) return
    const t = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (t.clientX - dragStart.current.mx) / rect.width * 100 / zoom
    const dy = (t.clientY - dragStart.current.my) / rect.height * 100 / zoom
    setPos({
      x: Math.min(100, Math.max(0, dragStart.current.px - dx)),
      y: Math.min(100, Math.max(0, dragStart.current.py - dy))
    })
  }

  const posStr = `${pos.x.toFixed(1)}% ${pos.y.toFixed(1)}%`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: '#1a1a2e', borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 800, boxShadow: '0 8px 40px rgba(0,0,0,.6)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.1)', fontWeight: 700, fontSize: 14, color: '#fff' }}>
          🖼️ Repositionner la bannière
          <span style={{ marginLeft: 10, fontSize: 10, opacity: .5, fontWeight: 400 }}>Taille recommandée : 1640 × 856 px</span>
        </div>
        <div style={{ padding: '8px 16px 4px', fontSize: 11, color: 'rgba(255,255,255,.5)', textAlign: 'center' }}>
          Glisse l'image · Molette pour zoomer
        </div>
        <div
          ref={containerRef}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
          onWheel={e => { setZoom(z => Math.min(3, Math.max(1, z - e.deltaY * 0.001))) }}
          style={{ height: 220, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', position: 'relative', userSelect: 'none' }}
        >
          <img
            src={url} alt=""
            style={{
              position: 'absolute',
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              objectFit: 'cover',
              left: `${(1 - zoom) * pos.x}%`,
              top: `${(1 - zoom) * pos.y}%`,
              pointerEvents: 'none',
              draggable: false,
            }}
          />
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>🔍 Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#c8a200' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', minWidth: 32 }}>{zoom.toFixed(1)}x</span>
          </div>
        </div>
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={() => onConfirm(posStr, zoom)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Confirmer</button>
        </div>
      </div>
    </div>
  )
}

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
      const token = await getToken()
      const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${user.id}&status=eq.accepted&select=user_b`, { headers: h })
      const d1 = await r1.json()
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_b=eq.${user.id}&status=eq.accepted&select=user_a`, { headers: h })
      const d2 = await r2.json()
      const friendIds = [
        ...(Array.isArray(d1) ? d1.map(f => f.user_b) : []),
        ...(Array.isArray(d2) ? d2.map(f => f.user_a) : [])
      ]
      if (friendIds.length > 0) {
        const rp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${friendIds.join(',')})&select=id,pseudo,initials,avatar_url,online,role`, { headers: h })
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
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerPosition, setBannerPosition] = useState('center')
  const [showPositionSlider, setShowPositionSlider] = useState(false)
  const [editingInfos, setEditingInfos] = useState(false)
  const [infosRegion,  setInfosRegion]  = useState('')
  const [infosDept,    setInfosDept]    = useState('')
  const [infosCity,    setInfosCity]    = useState('')
  const [infosStatut,  setInfosStatut]  = useState('')
  const [savingInfos,  setSavingInfos]  = useState(false)
  const [lightbox,     setLightbox]     = useState(null)
  const [likerProfiles, setLikerProfiles] = useState([])

  const avatarRef = useRef()
  const photoRef  = useRef()
  const bannerRef = useRef()

  const onCropComplete       = useCallback((_, p) => setCroppedArea(p), [])

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

  const selectBanner = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingBanner(true); setShowBannerPicker(false)
    const token = await getToken()
    const ts = Date.now()
    const path = `${user.id}/banner_${ts}.jpg`
    await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, { method: 'POST', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file })
    const pos = profile.banner_position || 'center'
    await patchProfile({ banner_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`, banner_gradient: null, banner_position: pos })
    setUploadingBanner(false); setShowPositionSlider(true)
    e.target.value = ''
  }
  const saveBannerPosition = async (pos, zoom = 1) => {
    const size = zoom > 1 ? `${Math.round(zoom * 100)}%` : 'cover'
    await patchProfile({ banner_position: pos, banner_size: size })
  }

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
  const bannerPos = profile.banner_position || '50% 50%'
  const bannerSize = profile.banner_size || 'cover'
  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: bannerSize, backgroundPosition: bannerPos }
    : { background: profile.banner_gradient || BANNER_GRADIENTS[0] }
  const topVote = VOTES_DEF.reduce((best, v) => (votes[v.key] || 0) > (votes[best?.key] || 0) ? v : best, null)

  const photoLikes = profile.photo_likes || {}

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 80 }}>

      {lightbox && (() => {
        const photos = profile.photos || []
        const total = photos.length
        const goTo = (idx) => {
          const newIdx = (idx + total) % total
          openLightbox(photos[newIdx], newIdx)
        }
        const likers = photoLikes[String(lightbox.index)] || []
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.96)', zIndex: 3000, display: 'flex', flexDirection: 'column' }}
            onKeyDown={e => { if (e.key === 'ArrowLeft') goTo(lightbox.index - 1); if (e.key === 'ArrowRight') goTo(lightbox.index + 1); if (e.key === 'Escape') setLightbox(null) }}
            tabIndex={0} ref={el => el?.focus()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', flexShrink: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>
                {lightbox.index + 1} / {total}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>❤️ {likers.length}</span>
                <button onClick={() => setLightbox(null)} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            {/* Image centrale avec nav */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
              onClick={() => setLightbox(null)}>

              {total > 1 && (
                <button onClick={e => { e.stopPropagation(); goTo(lightbox.index - 1) }}
                  style={{ position: 'absolute', left: 16, zIndex: 10, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}>
                  ‹
                </button>
              )}

              <img src={lightbox.url} alt="" onClick={e => e.stopPropagation()}
                style={{ maxWidth: 'calc(100vw - 140px)', maxHeight: 'calc(100vh - 180px)', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 60px rgba(0,0,0,.8)', userSelect: 'none' }} />

              {total > 1 && (
                <button onClick={e => { e.stopPropagation(); goTo(lightbox.index + 1) }}
                  style={{ position: 'absolute', right: 16, zIndex: 10, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}>
                  ›
                </button>
              )}
            </div>

            {/* Bas : likes + thumbnails */}
            <div style={{ flexShrink: 0, padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Likers */}
              {likerProfiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {likerProfiles.map(lk => {
                    const lkColor = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'][(lk.pseudo?.charCodeAt(0) || 0) % 8]
                    return (
                      <div key={lk.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '3px 10px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: lk.avatar_url ? '#444' : lkColor, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                          {lk.avatar_url ? <img loading="lazy" decoding="async" src={lk.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : lk.initials || lk.pseudo?.slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>@{lk.pseudo}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Thumbnails strip */}
              {total > 1 && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', overflowX: 'auto', paddingBottom: 2 }}>
                  {photos.map((url, i) => (
                    <div key={i} onClick={e => { e.stopPropagation(); openLightbox(url, i) }}
                      style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: i === lightbox.index ? '2px solid #f0c800' : '2px solid rgba(255,255,255,.2)', transition: 'border-color .15s', opacity: i === lightbox.index ? 1 : 0.55 }}>
                      <img loading="lazy" decoding="async" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

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

      {showPositionSlider && profile.banner_url && (
        <BannerPositionModal
          url={profile.banner_url}
          initialPosition={profile.banner_position || '50% 50%'}
          initialZoom={profile.banner_size && profile.banner_size !== 'cover' ? parseFloat(profile.banner_size) / 100 : 1}
          onConfirm={async (pos, zoom) => { await saveBannerPosition(pos, zoom); setShowPositionSlider(false) }}
          onCancel={() => setShowPositionSlider(false)}
        />
      )}

      <div style={{ position: 'relative', height: 'min(220px, 35vw)', ...bannerStyle }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {profile.banner_url && (
              <button onClick={() => { setBannerPosition(profile.banner_position || 'center'); setShowPositionSlider(true) }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                ↕️ Position
              </button>
            )}
            <button onClick={() => setShowBannerPicker(p => !p)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              🎨 Bannière
            </button>
          </div>
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
              📸 Importer une image
            </button>
            <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={selectBanner} />
          </div>
        )}
      </div>

      <div style={{ background: C.white, borderBottom: '1px solid #e8e0c8', padding: '0 20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -44 }}>
          <div style={{ position: 'relative' }}>
            <div onClick={() => avatarRef.current.click()} style={{ width: 88, height: 88, borderRadius: '50%', background: profile.avatar_url ? '#444' : avatarColor, border: ROLE_RING[profile.role] ? `4px solid ${ROLE_RING[profile.role]}` : '4px solid #fff', boxShadow: ROLE_RING[profile.role] ? `0 0 16px ${ROLE_RING[profile.role]}99, 0 4px 16px rgba(0,0,0,.2)` : '0 4px 16px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 28, color: '#fff', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {profile.avatar_url ? <img loading="lazy" decoding="async" src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.initials || profile.pseudo?.slice(0, 2).toUpperCase()}
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
            {profile.is_bot && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#5865f2', color: '#fff', letterSpacing: .5, flexShrink: 0 }}>BOT</span>}
            <RoleBadge role={profile.role} />
            <span style={{ fontSize: 12, color: '#c8a200', fontWeight: 700, background: 'rgba(200,162,0,.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid #c8a20044' }}>Niv. {profile.level || 1}</span>
            {topVote && totalVotes > 0 && (
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: C.accentBg, color: C.accentTxt, border: `1px solid ${C.accentDk}`, fontWeight: 700 }}>
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

        {/* ── LAYOUT 2 COLONNES sur desktop ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 340px' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}>

        {/* ── COLONNE GAUCHE : Bio + Photos + Badges + Demandes d'amis ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={PANEL}>
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                {[
                  { icon: '👥', label: 'Amis',  value: friendsLoading ? '…' : friendsList.length, color: '#3498db' },
                  { icon: '⭐', label: 'Votes', value: totalVotes,                                 color: '#c8a200' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase', letterSpacing: .4 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {VOTES_DEF.map(v => {
                  const val = votes[v.key] || 0
                  return (
                    <div key={v.key} title={v.label} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderRadius: 20, background: val > 0 ? C.accentBg : C.surfaceB, border: `1px solid ${val > 0 ? C.accentDk : C.border}` }}>
                      <span style={{ fontSize: 13 }}>{v.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 11, color: val > 0 ? C.accentTxt : C.textDim }}>{val}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>🖼️ Photos ({(profile.photos || []).length})</div>
            <Btn onClick={() => photoRef.current.click()} variant="ghost" style={{ fontSize: 11 }}>{uploadingPhoto ? '…' : '+ Ajouter'}</Btn>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
          </div>
          {(profile.photos || []).length === 0
            ? <div style={{ textAlign: 'center', padding: '36px', color: C.textDim, fontSize: 13, background: C.surfaceB, borderRadius: 12, border: '1px dashed rgba(200,162,0,.3)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune photo</div>
                <div style={{ fontSize: 12 }}>Ajoute tes premières photos</div>
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {(profile.photos || []).map((url, i) => {
                  const likers = photoLikes[String(i)] || []
                  return (
                    <div key={i} onClick={() => openLightbox(url, i)}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', background: '#111' }}
                      onMouseEnter={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1.05)'; e.currentTarget.querySelector('.overlay').style.opacity = '1' }}
                      onMouseLeave={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1)'; e.currentTarget.querySelector('.overlay').style.opacity = '0' }}>
                      <img loading="lazy" decoding="async" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s ease' }} />
                      {likers.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>❤️ {likers.length}</div>
                      )}
                      <div className="overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', opacity: 0, transition: 'opacity .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 28, color: '#fff', opacity: .9 }}>🔍</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removePhoto(url) }}
                        style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>✕</button>
                    </div>
                  )
                })}
              </div>
          }
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
                  <div key={friendship.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.accentBg, border: `1px solid ${C.accentDk}`, borderRadius: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: sender.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                      {sender.avatar_url ? <img loading="lazy" decoding="async" src={sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : sender.initials || sender.pseudo?.slice(0,2).toUpperCase()}
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

        </div>{/* ── fin colonne gauche ── */}

        {/* ── COLONNE DROITE : Amis + Intérêts ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: f.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', border: ROLE_RING[f.role] ? `2.5px solid ${ROLE_RING[f.role]}` : '2px solid rgba(255,255,255,.15)', boxShadow: ROLE_RING[f.role] ? `0 0 10px ${ROLE_RING[f.role]}66` : '0 2px 6px rgba(0,0,0,.1)' }}>
                            {f.avatar_url ? <img loading="lazy" decoding="async" src={f.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : f.initials || f.pseudo?.slice(0,2).toUpperCase()}
                          </div>
                          {f.online && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#2ecc71', border: '2px solid var(--white)', boxShadow: '0 0 6px #2ecc71' }} />}
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
          <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>🎯 Intérêts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12, minHeight: 28 }}>
            {(profile.interests || []).length === 0
              ? <span style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Ajoutes-en ci-dessous</span>
              : (profile.interests || []).map(i => (
                <span key={i} onClick={() => removeInterest(i)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, background: C.accentBg, color: C.accentTxt, border: `1px solid ${C.accentDk}`, cursor: 'pointer', fontWeight: 600, transition: 'all .15s' }}
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

        </div>{/* ── fin colonne droite ── */}
        </div>{/* ── fin grid 2 colonnes ── */}

      </div>
    </div>
  )
}