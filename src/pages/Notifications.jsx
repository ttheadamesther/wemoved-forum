import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
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

function api(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR')
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(true)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (!user) return
    api(`/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotifs(d); setLoading(false) })
  }, [user])

  // Marquer tout comme lu quand on quitte la page
  const markAllReadSilent = async () => {
    const u = userRef.current
    if (!u) return
    const token = await getToken()
    fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${u.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    }).catch(() => {})
    setNotifs(n => n.map(x => ({ ...x, read: true })))
  }

  useEffect(() => {
    // Au démontage du composant (navigation vers autre page)
    return () => { markAllReadSilent() }
  }, [])

  const markRead = async (id) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }

  const markAllRead = async () => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs(n => n.map(x => ({ ...x, read: true })))
  }

  const deleteNotif = async (id) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
    })
    setNotifs(n => n.filter(x => x.id !== id))
  }

  const handleClick = async (notif) => {
    if (!notif.read) await markRead(notif.id)
    if (notif.link) navigate(notif.link)
  }

  const unreadCount = notifs.filter(n => !n.read).length

  if (!user) return null

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 19, color: C.text, marginBottom: 2 }}>🔔 Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ fontSize: 12, color: C.textDim }}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 12, color: C.accentTxt, background: 'none', border: `1px solid ${C.accentDk}`, borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            ✓ Tout marquer comme lu
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textDim, fontSize: 13 }}>Chargement…</div>
      ) : notifs.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔕</div>
          <div style={{ fontSize: 13, color: C.textDim, fontStyle: 'italic' }}>Aucune notification pour l'instant</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map(n => (
            <div key={n.id} onClick={() => handleClick(n)}
              style={{
                background: n.read ? C.white : '#fffae6',
                border: `1px solid ${n.read ? C.border : C.accentDk}`,
                borderLeft: `4px solid ${n.read ? C.border : C.accentDk}`,
                borderRadius: 12, padding: '14px 16px',
                cursor: n.link ? 'pointer' : 'default',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                transition: 'all .15s',
                boxShadow: n.read ? 'none' : '0 1px 6px rgba(200,162,0,.1)'
              }}
              onMouseEnter={e => { if (n.link) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : C.accentDk, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, fontWeight: n.read ? 400 : 600 }}>{n.content}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{formatDate(n.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!n.read && (
                  <button onClick={e => { e.stopPropagation(); markRead(n.id) }}
                    style={{ fontSize: 10, color: C.accentTxt, background: 'none', border: `1px solid ${C.accentDk}`, borderRadius: 10, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Lu
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                  style={{ fontSize: 10, color: '#e74c3c', background: 'none', border: '1px solid #f5c0c0', borderRadius: 10, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}