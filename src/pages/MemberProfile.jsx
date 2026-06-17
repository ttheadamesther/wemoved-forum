import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { C, VOTES_DEF, ROLE_RING } from '../lib/constants'
import { BADGES_DEF } from '../lib/xp'
import { RoleBadge, Btn } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { awardXP, checkAndAwardBadges } from '../lib/xp'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

const ROLES_ASSIGNABLES = [
  { value: 'membre',     label: 'Membre',     color: '#555' },
  { value: 'animateur',  label: 'Animateur',  color: '#1a3c6b' },
  { value: 'moderateur', label: 'Modérateur', color: '#1a5c30' },
  { value: 'manager',    label: 'Manager',    color: '#5a0080' },
]

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

async function api(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

const sendNotif = async (userId, type, content, link) => {
  try { await api('/rest/v1/notifications', { method: 'POST', body: JSON.stringify({ user_id: userId, type, content, link, read: false }) }) } catch {}
}

const statutLabel = (s) => {
  if (s === 'celibataire') return '💚 Célibataire'
  if (s === 'couple')      return '❤️ En couple'
  if (s === 'complique')   return "💛 C'est compliqué"
  return null
}

const PANEL = { background: 'var(--white)', border: '1px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 16, padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,.07)' }

function FriendBtn({ user, id, friendship, friendLoading, onAdd, onAccept, onRemove }) {
  if (!user || user.id === id) return null
  if (friendLoading) return <button disabled style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'wait', fontFamily: 'inherit' }}>…</button>
  if (!friendship) return <button onClick={onAdd} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #3498db', background: 'transparent', color: '#3498db', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>👥 Ajouter ami</button>
  if (friendship.status === 'pending' && friendship.user_a === user.id) return <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>⏳ Demande envoyée</button>
  if (friendship.status === 'pending' && friendship.user_b === user.id) return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onAccept} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #2ecc71', background: '#2ecc71', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✅ Accepter</button>
      <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Refuser</button>
    </div>
  )
  if (friendship.status === 'accepted') return <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #3498db', background: '#3498db', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>👥 Amis ✓</button>
  return null
}

export default function MemberProfile() {
  const { id }            = useParams()
  const { user, profile } = useAuth()
  const navigate          = useNavigate()
  const [member,          setMember]          = useState(null)
  const [myVotes,         setMyVotes]         = useState({})
  const [voting,          setVoting]          = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [showRolePanel,   setShowRolePanel]   = useState(false)
  const [updatingRole,    setUpdatingRole]    = useState(false)
  const [isBlocked,       setIsBlocked]       = useState(false)
  const [blocking,        setBlocking]        = useState(false)
  const [blockedByThem,   setBlockedByThem]   = useState(false)
  const [friendship,      setFriendship]      = useState(null)
  const [friendLoading,   setFriendLoading]   = useState(false)
  const [friendsList,     setFriendsList]     = useState([])
  const [friendsLoading,  setFriendsLoading]  = useState(false)
  const [likingPhoto,     setLikingPhoto]     = useState(null)
  const [lightbox,        setLightbox]        = useState(null)
  const [likerProfiles,   setLikerProfiles]   = useState([])
  const [isDesktop,       setIsDesktop]       = useState(typeof window !== 'undefined' && window.innerWidth >= 1024)
  const notifSentRef = useRef(false)

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const isAdmin        = profile?.role === 'admin'
  const isManager      = profile?.role === 'manager'
  const canManageRoles = isAdmin || isManager
  const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}` }

  const openLightbox = async (url, index) => {
    setLightbox({ url, index }); setLikerProfiles([])
    const likerIds = (member?.photo_likes || {})[String(index)] || []
    if (!likerIds.length) return
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${likerIds.join(',')})&select=id,pseudo,initials,avatar_url`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
    const d = await r.json()
    if (Array.isArray(d)) setLikerProfiles(d)
  }

  useEffect(() => {
    notifSentRef.current = false; setLoading(true); setFriendship(null)
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&limit=1`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
      .then(r => r.json()).then(data => { if (data?.[0]) setMember(data[0]); setLoading(false) })
    loadFriendsList()
  }, [id])

  useEffect(() => {
    if (!user || !id) return
    const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    fetch(`${SUPABASE_URL}/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&month_key=eq.${monthKey()}`, { headers: h })
      .then(r => r.json()).then(data => { if (Array.isArray(data)) { const v = {}; data.forEach(d => { v[d.vote_type] = true }); setMyVotes(v) } })
    fetch(`${SUPABASE_URL}/rest/v1/blocks?blocker_id=eq.${user.id}&blocked_id=eq.${id}&limit=1`, { headers: h })
      .then(r => r.json()).then(data => setIsBlocked(Array.isArray(data) && data.length > 0))
    fetch(`${SUPABASE_URL}/rest/v1/blocks?blocker_id=eq.${id}&blocked_id=eq.${user.id}&limit=1`, { headers: h })
      .then(r => r.json()).then(data => setBlockedByThem(Array.isArray(data) && data.length > 0))
    loadFriendship()
  }, [id, user?.id])

  useEffect(() => {
    if (!user || !id || user.id === id || notifSentRef.current) return
    const key = `pv_${user.id}_${id}`; const last = localStorage.getItem(key); const now = Date.now()
    if (last && now - parseInt(last) < 10 * 60 * 1000) return
    notifSentRef.current = true; localStorage.setItem(key, now.toString())
    sendNotif(id, 'profile_view', `👀 @${profile?.pseudo || 'Quelqu\'un'} a consulté votre profil`, `/members/${user.id}`)
  }, [id, user?.id, profile?.pseudo])

  const loadFriendsList = async () => {
    setFriendsLoading(true)
    const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    const [r1, r2] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${id}&status=eq.accepted&select=user_b`, { headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/friendships?user_b=eq.${id}&status=eq.accepted&select=user_a`, { headers: h })
    ])
    const [d1, d2] = await Promise.all([r1.json(), r2.json()])
    const ids = [...(Array.isArray(d1) ? d1.map(f => f.user_b) : []), ...(Array.isArray(d2) ? d2.map(f => f.user_a) : [])]
    if (!ids.length) { setFriendsList([]); setFriendsLoading(false); return }
    const rp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,pseudo,initials,avatar_url,online,role`, { headers: h })
    const dp = await rp.json()
    setFriendsList(Array.isArray(dp) ? dp : [])
    setFriendsLoading(false)
  }

  const loadFriendship = async () => {
    if (!user?.id || !id) return
    const token = await getToken()
    const h = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${user.id}&user_b=eq.${id}&limit=1`, { headers: h })
    const d1 = await r1.json()
    if (Array.isArray(d1) && d1.length > 0) { setFriendship(d1[0]); return }
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${id}&user_b=eq.${user.id}&limit=1`, { headers: h })
    const d2 = await r2.json()
    setFriendship(Array.isArray(d2) && d2.length > 0 ? d2[0] : null)
  }

  const sendFriendRequest = async () => {
    if (friendLoading) return; setFriendLoading(true)
    const res = await api('/rest/v1/friendships', { method: 'POST', body: JSON.stringify({ user_a: user.id, user_b: id, status: 'pending' }) })
    if (res.ok || res.status === 409) await sendNotif(id, 'friend_request', `👥 @${profile?.pseudo || 'Quelqu\'un'} vous a envoyé une demande d'ami`, `/members/${user.id}`)
    await loadFriendship(); setFriendLoading(false)
  }

  const acceptFriendRequest = async () => {
    if (friendLoading) return; setFriendLoading(true)
    await api(`/rest/v1/friendships?id=eq.${friendship.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) })
    await awardXP(user.id, 15); await awardXP(id, 15)
    await sendNotif(id, 'friend_accepted', `✅ @${profile?.pseudo || 'Quelqu\'un'} a accepté votre demande d'ami`, `/members/${user.id}`)
    await loadFriendship(); setFriendLoading(false)
  }

  const removeFriend = async () => {
    if (friendLoading) return; setFriendLoading(true)
    await api(`/rest/v1/friendships?id=eq.${friendship.id}`, { method: 'DELETE' })
    setFriendship(null); setFriendLoading(false)
  }

  const toggleBlock = async () => {
    if (!user || blocking) return; setBlocking(true)
    if (isBlocked) { await api(`/rest/v1/blocks?blocker_id=eq.${user.id}&blocked_id=eq.${id}`, { method: 'DELETE' }); setIsBlocked(false) }
    else { await api('/rest/v1/blocks', { method: 'POST', body: JSON.stringify({ blocker_id: user.id, blocked_id: id }) }); setIsBlocked(true) }
    setBlocking(false)
  }

  const vote = async (voteType) => {
    if (!user || voting) return; setVoting(voteType)
    if (myVotes[voteType]) {
      await api(`/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&vote_type=eq.${voteType}&month_key=eq.${monthKey()}`, { method: 'DELETE' })
      const newVotes = { ...member.votes, [voteType]: Math.max(0, (member.votes?.[voteType] || 0) - 1) }
      await api(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ votes: newVotes }) })
      setMember(m => ({ ...m, votes: newVotes })); setMyVotes(v => ({ ...v, [voteType]: false }))
    } else {
      await api('/rest/v1/votes', { method: 'POST', body: JSON.stringify({ from_id: user.id, to_id: id, vote_type: voteType, month_key: monthKey() }) })
      const newVotes = { ...member.votes, [voteType]: (member.votes?.[voteType] || 0) + 1 }
      await api(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ votes: newVotes }) })
      setMember(m => ({ ...m, votes: newVotes })); setMyVotes(v => ({ ...v, [voteType]: true }))
      await awardXP(id, 2); await checkAndAwardBadges(id)
      const vDef = VOTES_DEF.find(v => v.key === voteType)
      await sendNotif(id, 'vote', `${vDef?.emoji || '🏆'} @${profile?.pseudo || 'Quelqu\'un'} vous a voté "${vDef?.label || voteType}"`, `/members/${user.id}`)
    }
    setVoting(null)
  }

  const togglePhotoLike = async (photoUrl, photoIndex) => {
    if (!user || likingPhoto !== null) return; setLikingPhoto(photoIndex)
    const currentLikes = member.photo_likes || {}
    const key = String(photoIndex); const likers = currentLikes[key] || []
    const alreadyLiked = likers.includes(user.id)
    const newLikers = alreadyLiked ? likers.filter(uid => uid !== user.id) : [...likers, user.id]
    const newPhotoLikes = { ...currentLikes, [key]: newLikers }
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ photo_likes: newPhotoLikes }) })
    setMember(m => ({ ...m, photo_likes: newPhotoLikes }))
    if (!alreadyLiked && user.id !== id) await sendNotif(id, 'photo_like', `❤️ @${profile?.pseudo || 'Quelqu\'un'} a aimé une de vos photos`, `/members/${id}`)
    setLikingPhoto(null)
  }

  const assignRole = async (newRole) => {
    setUpdatingRole(true)
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ role: newRole }) })
    setMember(m => ({ ...m, role: newRole })); setUpdatingRole(false); setShowRolePanel(false)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--textMid)' }}>Chargement…</div>

  if (blockedByThem) return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 80px' }}>
      <Btn onClick={() => navigate('/members')} variant="ghost" style={{ marginBottom: 16, fontSize: 12 }}>← Retour</Btn>
      <div style={{ background: 'var(--white)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>Profil indisponible</div>
        <div style={{ fontSize: 13, color: C.textDim }}>Ce profil n'est pas accessible.</div>
      </div>
    </div>
  )

  if (!member) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Profil introuvable</div>

  const votes      = member.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const sexeLabel  = member.sexe ? member.sexe.charAt(0).toUpperCase() + member.sexe.slice(1) : null
  const statut     = statutLabel(member.statut)
  const colors     = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(member.pseudo?.charCodeAt(0) || 0) % colors.length]
  const initials   = member.initials || member.pseudo?.slice(0, 2).toUpperCase() || '??'
  const photoLikes = member.photo_likes || {}
  const photos     = member.photos || []

  return (
    <div style={{ paddingBottom: 80, overflowX: 'hidden' }}>

      {/* Lightbox */}
      {lightbox && (() => {
        const total = photos.length
        const goTo = idx => openLightbox(photos[(idx + total) % total], (idx + total) % total)
        const likers = photoLikes[String(lightbox.index)] || []
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.96)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}
            onKeyDown={e => { if (e.key === 'ArrowLeft') goTo(lightbox.index - 1); if (e.key === 'ArrowRight') goTo(lightbox.index + 1); if (e.key === 'Escape') setLightbox(null) }}
            tabIndex={0} ref={el => el?.focus()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{lightbox.index + 1} / {total}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>❤️ {likers.length}</span>
                <button onClick={() => setLightbox(null)} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }} onClick={() => setLightbox(null)}>
              {total > 1 && <button onClick={e => { e.stopPropagation(); goTo(lightbox.index - 1) }} style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
              <img src={lightbox.url} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: 'calc(100vw - 140px)', maxHeight: 'calc(100vh - 180px)', objectFit: 'contain', borderRadius: 8 }} />
              {total > 1 && <button onClick={e => { e.stopPropagation(); goTo(lightbox.index + 1) }} style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
            </div>
            {likerProfiles.length > 0 && (
              <div style={{ padding: '8px 20px', display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {likerProfiles.map(lk => {
                  const lkColor = colors[(lk.pseudo?.charCodeAt(0) || 0) % colors.length]
                  return (
                    <div key={lk.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '3px 10px' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: lk.avatar_url ? '#444' : lkColor, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                        {lk.avatar_url ? <img src={lk.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : lk.initials || lk.pseudo?.slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>@{lk.pseudo}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {total > 1 && (
              <div style={{ padding: '8px 20px 20px', display: 'flex', gap: 6, justifyContent: 'center' }}>
                {photos.map((url, i) => (
                  <div key={i} onClick={e => { e.stopPropagation(); openLightbox(url, i) }}
                    style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: i === lightbox.index ? '2px solid #f0c800' : '2px solid rgba(255,255,255,.2)', opacity: i === lightbox.index ? 1 : 0.55 }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Bannière + header dans un bloc avec bordure */}
      <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 16px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'visible', boxShadow: '0 2px 16px rgba(0,0,0,.1)' }}>

          {/* Bannière */}
          <div style={{ height: 200, maxHeight: 200, width: '100%', borderRadius: '16px 16px 0 0', overflow: 'hidden', background: member.banner_url ? 'transparent' : 'linear-gradient(135deg,#0e0e1e 0%,#1a1240 50%,#0a0a18 100%)', position: 'relative', flexShrink: 0 }}>
            {member.banner_url && (
              <img src={member.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: member.banner_position || 'center', display: 'block' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,.3))' }} />
            <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10 }}>
              <Btn onClick={() => navigate('/members')} variant="ghost" style={{ fontSize: 12, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }}>← Retour</Btn>
            </div>
          </div>

          {/* Header sous bannière */}
          <div style={{ background: 'var(--white)', borderRadius: '0 0 16px 16px', padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: member.avatar_url ? '#444' : avatarColor, border: ROLE_RING[member.role] ? `3px solid ${ROLE_RING[member.role]}` : '3px solid var(--white)', boxShadow: ROLE_RING[member.role] ? `0 0 20px ${ROLE_RING[member.role]}88` : '0 4px 16px rgba(0,0,0,.2)', marginTop: -44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 2 }}>
                {member.avatar_url ? <img loading="lazy" src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
              </div>
              {member.avatar_url ? <img loading="lazy" src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
            </div>
            {user && user.id !== id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {canManageRoles && <Btn onClick={() => setShowRolePanel(v => !v)} variant="ghost" style={{ fontSize: 12 }}>🛡️ Gérer le rôle</Btn>}
                <FriendBtn user={user} id={id} friendship={friendship} friendLoading={friendLoading} onAdd={sendFriendRequest} onAccept={acceptFriendRequest} onRemove={removeFriend} />
                {!isBlocked && <Btn onClick={() => navigate(`/messages?to=${id}`)} variant="yellow" style={{ fontSize: 12 }}>✉️ Message</Btn>}
                <button onClick={toggleBlock} disabled={blocking} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${isBlocked ? C.border : C.red}`, background: isBlocked ? C.surfaceB : 'transparent', color: isBlocked ? C.textMid : C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {blocking ? '…' : isBlocked ? '🔓 Débloquer' : '🚫 Bloquer'}
                </button>
              </div>
            )}
          </div>

          {canManageRoles && showRolePanel && (
            <div style={{ background: C.surfaceB, border: `1px solid ${C.accentDk}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>🛡️ Attribuer un rôle à @{member.pseudo}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ROLES_ASSIGNABLES.filter(r => isAdmin || ['membre', 'animateur', 'moderateur'].includes(r.value)).map(r => (
                  <button key={r.value} onClick={() => assignRole(r.value)} disabled={updatingRole || member.role === r.value}
                    style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${member.role === r.value ? r.color : C.border}`, background: member.role === r.value ? r.color : C.white, color: member.role === r.value ? '#fff' : C.textMid, fontWeight: member.role === r.value ? 700 : 400, fontSize: 12, cursor: member.role === r.value ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {r.label}{member.role === r.value && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isBlocked && (
            <div style={{ background: '#fff3f3', border: `1px solid ${C.red}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: C.red }}>
              🚫 Vous avez bloqué ce membre.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>@{member.pseudo}</h1>
            {member.is_bot && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#5865f2', color: '#fff' }}>BOT</span>}
            <RoleBadge role={member.role} />
            <span style={{ fontSize: 12, color: '#c8a200', fontWeight: 700, background: 'rgba(200,162,0,.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid #c8a20044' }}>Niv. {member.level || 1}</span>
            {member.online && <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 600 }}>● En ligne</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              member.joined && { icon: '📅', label: member.joined },
              member.age    && { icon: '🎂', label: `${member.age} ans` },
              sexeLabel     && { icon: '👤', label: sexeLabel },
              member.city   && { icon: '📍', label: member.city },
              member.dept   && { icon: '🗺', label: member.dept },
              member.region && { icon: '🌍', label: member.region },
              statut        && { icon: '', label: statut },
            ].filter(Boolean).map((t, i) => (
              <span key={i} style={{ fontSize: 12, color: 'var(--textMid)', background: 'var(--surfaceB)', padding: '4px 12px', borderRadius: 99, border: '1px solid var(--border)', fontWeight: 500 }}>{t.icon} {t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Grille 2 colonnes */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 340px' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}>

          {/* Colonne principale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Stats + votes + bio */}
            <div style={PANEL}>
              <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    {[
                      { icon: '👥', label: 'Amis',  value: friendsLoading ? '…' : friendsList.length, color: '#3498db' },
                      { icon: '⭐', label: 'Votes', value: totalVotes, color: '#c8a200' },
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
                      const voted = myVotes[v.key]; const count = votes[v.key] || 0
                      return (
                        <button key={v.key} onClick={() => user && user.id !== id && !isBlocked && vote(v.key)}
                          disabled={!!voting || !user || user.id === id || isBlocked} title={v.label}
                          style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderRadius: 20, border: `1px solid ${voted ? C.accentDk : C.border}`, background: voted ? C.accentBg : C.surfaceB, color: voted ? C.accentTxt : C.textMid, fontWeight: voted ? 700 : 500, fontSize: 12, cursor: (!user || user.id === id || isBlocked || !!voting) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                          <span style={{ fontSize: 13 }}>{v.emoji}</span>
                          <span style={{ fontWeight: 700, fontSize: 11 }}>{count}</span>
                          {user && user.id !== id && !isBlocked && <span style={{ fontSize: 10, opacity: .6 }}>{voting === v.key ? '…' : voted ? '✓' : '+'}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>✍️ Bio</div>
              <div style={{ fontSize: 13, color: member.bio ? C.textMid : C.textDim, lineHeight: 1.7, fontStyle: member.bio ? 'normal' : 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {member.bio || 'Aucune bio renseignée.'}
              </div>
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <div style={{ ...PANEL, borderTop: '2px solid var(--accentDk)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>📸 Photos ({photos.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {photos.map((url, i) => {
                    const likers = photoLikes[String(i)] || []
                    const liked = user ? likers.includes(user.id) : false
                    return (
                      <div key={i} onClick={() => openLightbox(url, i)}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', background: '#111' }}
                        onMouseEnter={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1.05)'; e.currentTarget.querySelector('.ovl').style.opacity = '1' }}
                        onMouseLeave={e => { e.currentTarget.querySelector('img').style.transform = 'scale(1)'; e.currentTarget.querySelector('.ovl').style.opacity = '0' }}>
                        <img loading="lazy" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s' }} />
                        <div className="ovl" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', opacity: 0, transition: 'opacity .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 24, color: '#fff' }}>🔍</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent)', padding: '16px 8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          {likers.length > 0 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>❤️ {likers.length}</span>}
                          <button onClick={e => { e.stopPropagation(); user && user.id !== id && !isBlocked && togglePhotoLike(url, i) }}
                            disabled={likingPhoto !== null || !user || user.id === id || isBlocked}
                            style={{ background: liked ? 'rgba(231,76,60,.85)' : 'rgba(255,255,255,.18)', border: `1px solid ${liked ? '#e74c3c' : 'rgba(255,255,255,.35)'}`, borderRadius: 20, padding: '3px 8px', cursor: 'pointer', fontSize: 13, backdropFilter: 'blur(4px)' }}>
                            {likingPhoto === i ? '…' : liked ? '❤️' : '🤍'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Badges */}
            {(member.badges || []).length > 0 && (
              <div style={{ ...PANEL, borderTop: '2px solid #c8a200' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 16 }}>🎖️ Badges obtenus</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {BADGES_DEF.filter(b => member.badges.includes(b.key)).map(b => (
                    <div key={b.key} title={b.desc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'help' }}>
                      <div style={{ width: 58, height: 58, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${b.color || '#c8a200'}bb, ${b.color || '#c8a200'})`, border: `3px solid ${b.color || '#c8a200'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 4px 16px ${b.color || '#c8a200'}55` }}>
                        {b.emoji}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: b.color || '#7a6200', textAlign: 'center', maxWidth: 64, lineHeight: 1.2 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Amis */}
            <div style={{ ...PANEL, borderTop: '2px solid #3498db' }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>👥 Amis ({friendsLoading ? '…' : friendsList.length})</div>
              {friendsLoading
                ? <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 12 }}>Chargement…</div>
                : friendsList.length === 0
                  ? <div style={{ fontSize: 13, color: C.textDim, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>Aucun ami pour l'instant.</div>
                  : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                      {friendsList.map(f => {
                        const fColor = colors[(f.pseudo?.charCodeAt(0) || 0) % colors.length]
                        const ring = ROLE_RING[f.role] || null
                        return (
                          <div key={f.id} onClick={() => navigate(`/members/${f.id}`)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: 'var(--surfaceB)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all .15s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#3498db'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                            <div style={{ position: 'relative' }}>
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: f.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', border: ring ? `2.5px solid ${ring}` : '2px solid rgba(255,255,255,.15)', boxShadow: ring ? `0 0 10px ${ring}66` : 'none' }}>
                                {f.avatar_url ? <img loading="lazy" src={f.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : f.initials || f.pseudo?.slice(0,2).toUpperCase()}
                              </div>
                              {f.online && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#2ecc71', border: '2px solid var(--white)' }} />}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>@{f.pseudo}</div>
                            {f.online && <span style={{ fontSize: 9, color: '#2ecc71', fontWeight: 700 }}>● En ligne</span>}
                          </div>
                        )
                      })}
                    </div>
              }
            </div>

            {/* Intérêts */}
            {(member.interests || []).length > 0 && (
              <div style={PANEL}>
                <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>🎯 Intérêts</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {member.interests.map(i => (
                    <span key={i} style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, background: 'var(--accentBg)', color: 'var(--accentTxt)', border: '1px solid rgba(200,162,0,.2)', fontWeight: 600 }}>{i}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}