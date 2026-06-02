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
  { value: 'membre',     label: 'Membre',      color: '#555' },
  { value: 'animateur',  label: 'Animateur',   color: '#1a3c6b' },
  { value: 'moderateur', label: 'Modérateur',  color: '#1a5c30' },
  { value: 'manager',    label: 'Manager',     color: '#5a0080' },
]

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

async function api(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

const sendNotif = async (userId, type, content, link) => {
  try {
    await api('/rest/v1/notifications', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, type, content, link, read: false })
    })
  } catch {}
}

const statutLabel = (statut) => {
  if (statut === 'celibataire') return '💚 Célibataire'
  if (statut === 'couple')      return '❤️ En couple'
  if (statut === 'complique')   return "💛 C'est compliqué"
  return null
}

function FriendBtn({ user, id, friendship, friendLoading, onAdd, onAccept, onRemove }) {
  if (!user || user.id === id) return null
  if (friendLoading) return (
    <button disabled style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'wait', fontFamily: 'inherit' }}>…</button>
  )
  if (!friendship) return (
    <button onClick={onAdd} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #3498db', background: 'transparent', color: '#3498db', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
      👥 Ajouter ami
    </button>
  )
  if (friendship.status === 'pending' && friendship.user_a === user.id) return (
    <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
      ⏳ Demande envoyée
    </button>
  )
  if (friendship.status === 'pending' && friendship.user_b === user.id) return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onAccept} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #2ecc71', background: '#2ecc71', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>✅ Accepter</button>
      <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>✕ Refuser</button>
    </div>
  )
  if (friendship.status === 'accepted') return (
    <button onClick={onRemove} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #3498db', background: '#3498db', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
      👥 Amis ✓
    </button>
  )
  return null
}

export default function MemberProfile() {
  const { id }            = useParams()
  const { user, profile } = useAuth()
  const navigate          = useNavigate()
  const [member, setMember]               = useState(null)
  const [myVotes, setMyVotes]             = useState({})
  const [voting, setVoting]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [showRolePanel, setShowRolePanel] = useState(false)
  const [updatingRole, setUpdatingRole]   = useState(false)
  const [isBlocked, setIsBlocked]         = useState(false)
  const [blocking, setBlocking]           = useState(false)
  const [blockedByThem, setBlockedByThem] = useState(false)
  const [friendship, setFriendship]       = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)
  const [friendsList, setFriendsList]     = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [likingPhoto, setLikingPhoto]     = useState(null)
  const [lightbox, setLightbox]           = useState(null)
  const notifSentRef = useRef(false)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const canManageRoles = isAdmin || isManager
  const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}` }

  useEffect(() => {
    notifSentRef.current = false
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&limit=1`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(data => {
      if (data && data[0]) setMember(data[0])
      setLoading(false)
    })

    if (user) {
      fetch(`${SUPABASE_URL}/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&month_key=eq.${monthKey()}`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const v = {}
          data.forEach(d => { v[d.vote_type] = true })
          setMyVotes(v)
        }
      })
      fetch(`${SUPABASE_URL}/rest/v1/blocks?blocker_id=eq.${user.id}&blocked_id=eq.${id}&limit=1`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(data => { setIsBlocked(Array.isArray(data) && data.length > 0) })
      fetch(`${SUPABASE_URL}/rest/v1/blocks?blocker_id=eq.${id}&blocked_id=eq.${user.id}&limit=1`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(data => { setBlockedByThem(Array.isArray(data) && data.length > 0) })
      loadFriendship()
    }
    loadFriendsList()
  }, [id])

  useEffect(() => {
    if (!user || !id || user.id === id) return
    if (notifSentRef.current) return
    const key = `pv_${user.id}_${id}`
    const last = localStorage.getItem(key)
    const now = Date.now()
    if (last && now - parseInt(last) < 10 * 60 * 1000) return
    notifSentRef.current = true
    localStorage.setItem(key, now.toString())
    const pseudo = profile?.pseudo || 'Quelqu\'un'
    sendNotif(id, 'profile_view', `👀 @${pseudo} a consulté votre profil`, `/members/${user.id}`)
  }, [id, user?.id, profile?.pseudo])

  const loadFriendsList = async () => {
    setFriendsLoading(true)
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${id}&status=eq.accepted&select=user_b`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
    const d1 = await r1.json()
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_b=eq.${id}&status=eq.accepted&select=user_a`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
    const d2 = await r2.json()
    const friendIds = [
      ...(Array.isArray(d1) ? d1.map(f => f.user_b) : []),
      ...(Array.isArray(d2) ? d2.map(f => f.user_a) : [])
    ]
    if (friendIds.length === 0) { setFriendsList([]); setFriendsLoading(false); return }
    const rp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${friendIds.join(',')})&select=id,pseudo,initials,avatar_url,online`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } })
    const dp = await rp.json()
    setFriendsList(Array.isArray(dp) ? dp : [])
    setFriendsLoading(false)
  }

  const loadFriendship = async () => {
    const token = await getToken()
    const headers = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${user.id}&user_b=eq.${id}&limit=1`, { headers })
    const d1 = await r1.json()
    if (Array.isArray(d1) && d1.length > 0) { setFriendship(d1[0]); return }
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/friendships?user_a=eq.${id}&user_b=eq.${user.id}&limit=1`, { headers })
    const d2 = await r2.json()
    setFriendship(Array.isArray(d2) && d2.length > 0 ? d2[0] : null)
  }

  const sendFriendRequest = async () => {
    if (friendLoading) return
    setFriendLoading(true)
    await api('/rest/v1/friendships', { method: 'POST', body: JSON.stringify({ user_a: user.id, user_b: id, status: 'pending' }) })
    await sendNotif(id, 'friend_request', `👥 @${profile?.pseudo || 'Quelqu\'un'} vous a envoyé une demande d'ami`, `/members/${user.id}`)
    await loadFriendship()
    setFriendLoading(false)
  }

  const acceptFriendRequest = async () => {
    if (friendLoading) return
    setFriendLoading(true)
    await api(`/rest/v1/friendships?id=eq.${friendship.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) })
    await awardXP(user.id, 15)
    await awardXP(id, 15)
    await sendNotif(id, 'friend_accepted', `✅ @${profile?.pseudo || 'Quelqu\'un'} a accepté votre demande d'ami`, `/members/${user.id}`)
    await loadFriendship()
    setFriendLoading(false)
  }

  const removeFriend = async () => {
    if (friendLoading) return
    setFriendLoading(true)
    await api(`/rest/v1/friendships?id=eq.${friendship.id}`, { method: 'DELETE' })
    setFriendship(null)
    setFriendLoading(false)
  }

  const toggleBlock = async () => {
    if (!user || blocking) return
    setBlocking(true)
    if (isBlocked) {
      await api(`/rest/v1/blocks?blocker_id=eq.${user.id}&blocked_id=eq.${id}`, { method: 'DELETE' })
      setIsBlocked(false)
    } else {
      await api('/rest/v1/blocks', { method: 'POST', body: JSON.stringify({ blocker_id: user.id, blocked_id: id }) })
      setIsBlocked(true)
    }
    setBlocking(false)
  }

  const vote = async (voteType) => {
    if (!user || voting) return
    setVoting(voteType)
    if (myVotes[voteType]) {
      await api(`/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&vote_type=eq.${voteType}&month_key=eq.${monthKey()}`, { method: 'DELETE' })
      const newVotes = { ...member.votes, [voteType]: Math.max(0, (member.votes?.[voteType] || 0) - 1) }
      await api(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ votes: newVotes }) })
      setMember(m => ({ ...m, votes: newVotes }))
      setMyVotes(v => ({ ...v, [voteType]: false }))
    } else {
      await api(`/rest/v1/votes`, { method: 'POST', body: JSON.stringify({ from_id: user.id, to_id: id, vote_type: voteType, month_key: monthKey() }) })
      const newVotes = { ...member.votes, [voteType]: (member.votes?.[voteType] || 0) + 1 }
      await api(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ votes: newVotes }) })
      setMember(m => ({ ...m, votes: newVotes }))
      setMyVotes(v => ({ ...v, [voteType]: true }))
      await awardXP(id, 2)
      await checkAndAwardBadges(id)
      const vDef = VOTES_DEF.find(v => v.key === voteType)
      await sendNotif(id, 'vote', `${vDef?.emoji || '🏆'} @${profile?.pseudo || 'Quelqu\'un'} vous a voté "${vDef?.label || voteType}"`, `/members/${user.id}`)
    }
    setVoting(null)
  }

  const togglePhotoLike = async (photoUrl, photoIndex) => {
    if (!user || likingPhoto !== null) return
    setLikingPhoto(photoIndex)
    const currentLikes = member.photo_likes || {}
    const key = String(photoIndex)
    const likers = currentLikes[key] || []
    const alreadyLiked = likers.includes(user.id)
    const newLikers = alreadyLiked ? likers.filter(uid => uid !== user.id) : [...likers, user.id]
    const newPhotoLikes = { ...currentLikes, [key]: newLikers }
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ photo_likes: newPhotoLikes })
    })
    setMember(m => ({ ...m, photo_likes: newPhotoLikes }))
    if (!alreadyLiked && user.id !== id) {
      await sendNotif(id, 'photo_like', `❤️ @${profile?.pseudo || 'Quelqu\'un'} a aimé une de vos photos`, `/members/${id}`)
    }
    setLikingPhoto(null)
  }

  const assignRole = async (newRole) => {
    setUpdatingRole(true)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ role: newRole })
    })
    setMember(m => ({ ...m, role: newRole }))
    setUpdatingRole(false)
    setShowRolePanel(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Chargement…</div>

  if (blockedByThem) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
      <Btn onClick={() => navigate('/members')} variant="ghost" style={{ marginBottom: 16, fontSize: 12 }}>← Retour</Btn>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,.6)' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      <Btn onClick={() => navigate('/members')} variant="ghost" style={{ marginBottom: 16, fontSize: 12 }}>← Retour</Btn>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ height: 160, background: member.banner_url ? `url(${member.banner_url}) center/cover no-repeat` : 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }} />
        <div style={{ padding: '0 24px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: member.avatar_url ? '#444' : avatarColor, border: ROLE_RING[member.role] ? `4px solid ${ROLE_RING[member.role]}` : '4px solid #fff', boxShadow: ROLE_RING[member.role] ? `0 0 16px ${ROLE_RING[member.role]}99` : 'none', marginTop: -45, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,.15)' }}>
              {member.avatar_url ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              {user && user.id !== id && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {canManageRoles && <Btn onClick={() => setShowRolePanel(v => !v)} variant="ghost" style={{ fontSize: 12 }}>🛡️ Gérer le rôle</Btn>}
                  <FriendBtn user={user} id={id} friendship={friendship} friendLoading={friendLoading} onAdd={sendFriendRequest} onAccept={acceptFriendRequest} onRemove={removeFriend} />
                  {!isBlocked && <Btn onClick={() => navigate('/messages')} variant="yellow" style={{ fontSize: 12 }}>✉️ Message</Btn>}
                  <button onClick={toggleBlock} disabled={blocking} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${isBlocked ? C.border : C.red}`, background: isBlocked ? C.surfaceB : 'transparent', color: isBlocked ? C.textMid : C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                    {blocking ? '…' : isBlocked ? '🔓 Débloquer' : '🚫 Bloquer'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {canManageRoles && showRolePanel && (
            <div style={{ background: C.surfaceB, border: `1px solid ${C.accentDk}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>🛡️ Attribuer un rôle à @{member.pseudo}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ROLES_ASSIGNABLES.filter(r => isAdmin || ['membre', 'animateur', 'moderateur'].includes(r.value)).map(r => (
                  <button key={r.value} onClick={() => assignRole(r.value)} disabled={updatingRole || member.role === r.value}
                    style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${member.role === r.value ? r.color : C.border}`, background: member.role === r.value ? r.color : C.white, color: member.role === r.value ? '#fff' : C.textMid, fontWeight: member.role === r.value ? 700 : 400, fontSize: 12, cursor: member.role === r.value ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'all .15s', opacity: updatingRole ? 0.6 : 1 }}>
                    {updatingRole && member.role !== r.value ? '…' : r.label}{member.role === r.value && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isBlocked && (
            <div style={{ background: '#fff3f3', border: `1px solid ${C.red}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
              🚫 Vous avez bloqué ce membre — il ne peut plus vous envoyer de messages ni voir votre profil.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontWeight: 700, fontSize: 20, color: C.text, margin: 0 }}>@{member.pseudo}</h1>
            <RoleBadge role={member.role} />
            <span style={{ fontSize: 12, color: '#c8a200', fontWeight: 700, background: 'rgba(200,162,0,.1)', padding: '2px 10px', borderRadius: 20, border: '1px solid #c8a20044' }}>Niv. {member.level || 1}</span>
            {member.online && <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 600 }}>● En ligne</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {member.joined && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>📅 {member.joined}</span>}
            {member.age    && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🎂 {member.age} ans</span>}
            {sexeLabel     && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>👤 {sexeLabel}</span>}
            {member.city   && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>📍 {member.city}</span>}
            {member.dept   && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🗺 {member.dept}</span>}
            {member.region && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🌍 {member.region}</span>}
            {statut        && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>{statut}</span>}
          </div>

          {/* Stats + Votes sur la même ligne */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
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
                const voted = myVotes[v.key]
                const count = votes[v.key] || 0
                return (
                  <button key={v.key} onClick={() => user && user.id !== id && !isBlocked && vote(v.key)}
                    disabled={!!voting || !user || user.id === id || isBlocked}
                    title={v.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: `1px solid ${voted ? C.accentDk : C.border}`, background: voted ? '#fffae6' : C.surfaceB, color: voted ? C.accentTxt : C.textMid, fontWeight: voted ? 700 : 500, fontSize: 12, cursor: (!user || user.id === id || isBlocked || !!voting) ? 'default' : 'pointer', transition: 'all .15s', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 15 }}>{v.emoji}</span>
                    <span>{count}</span>
                    {user && user.id !== id && !isBlocked && (
                      <span style={{ fontSize: 10, opacity: .6 }}>{voting === v.key ? '…' : voted ? ' ✓' : ' +'}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>✍️ Bio</div>
            <div style={{ fontSize: 13, color: member.bio ? C.textMid : C.textDim, lineHeight: 1.7, margin: 0, fontStyle: member.bio ? 'normal' : 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {member.bio || 'Aucune bio renseignée.'}
            </div>
          </div>
        </div>
      </div>



      {/* Intérêts */}
      {(member.interests || []).length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>🎯 Intérêts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(member.interests || []).map(i => (
              <span key={i} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, background: C.surfaceB, color: C.text, border: `1px solid ${C.border}`, fontWeight: 600 }}>{i}</span>
            ))}
          </div>
        </div>
      )}

      {(member.badges || []).length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid #c8a200`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 16 }}>🎖️ Badges obtenus</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {BADGES_DEF.filter(b => (member.badges || []).includes(b.key)).map(b => (
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

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid #3498db`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>👥 Amis ({friendsList.length})</div>
        {friendsLoading
          ? <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 12 }}>Chargement…</div>
          : friendsList.length === 0
            ? <div style={{ fontSize: 13, color: C.textDim, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>Aucun ami pour l'instant.</div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {friendsList.map(f => {
                  const fColor = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'][(f.pseudo?.charCodeAt(0) || 0) % 8]
                  return (
                    <div key={f.id} onClick={() => navigate(`/members/${f.id}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: C.surfaceB, borderRadius: 12, border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#3498db'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: f.avatar_url ? '#444' : fColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,.1)' }}>
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





      {(member.photos || []).length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>📸 Photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {(member.photos || []).map((url, i) => {
              const likers = photoLikes[String(i)] || []
              const liked  = user ? likers.includes(user.id) : false
              const count  = likers.length
              return (
                <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#000' }}>
                  <div style={{ aspectRatio: '1', cursor: 'zoom-in' }} onClick={() => setLightbox(url)}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity .2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    />
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%)', padding: '20px 10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    {count > 0 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{count}</span>}
                    <button
                      onClick={() => user && user.id !== id && togglePhotoLike(url, i)}
                      disabled={likingPhoto !== null || !user || user.id === id}
                      style={{ background: liked ? 'rgba(231,76,60,.85)' : 'rgba(255,255,255,.2)', border: `1px solid ${liked ? '#e74c3c' : 'rgba(255,255,255,.4)'}`, borderRadius: 20, padding: '4px 10px', cursor: (!user || user.id === id || likingPhoto !== null) ? 'default' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, transition: 'all .2s', backdropFilter: 'blur(4px)', opacity: likingPhoto === i ? 0.6 : 1 }}>
                      {likingPhoto === i ? '…' : liked ? '❤️' : '🤍'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {!user && <p style={{ fontSize: 12, color: C.textDim, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>Connecte-toi pour liker les photos</p>}
        </div>
      )}

    </div>
  )
}