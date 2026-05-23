import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { RoleBadge } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

function api(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, ...opts.headers }
  })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR')
}

function Avatar({ member, size = 38, showOnline = false }) {
  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const color = colors[(member?.pseudo?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: member?.avatar_url ? '#444' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .32, fontWeight: 700, color: '#fff', overflow: 'hidden', border: '2px solid rgba(255,255,255,.2)' }}>
        {member?.avatar_url
          ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : member?.initials || '??'
        }
      </div>
      {showOnline && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: member?.online ? C.online : '#ccc', border: '2px solid #fff' }} />
      )}
    </div>
  )
}

export default function MessagesPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members,  setMembers]  = useState([])
  const [convos,   setConvos]   = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setIsMobile(entry.contentRect.width < 768)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { if (user === null) navigate('/login') }, [user])

  useEffect(() => {
    if (!user) return
    api(`/rest/v1/profiles?id=neq.${user.id}&select=*`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
  }, [user])

  useEffect(() => {
    if (!user) return
    api(`/rest/v1/messages?or=(from_id.eq.${user.id},to_id.eq.${user.id})&order=created_at.desc&limit=100`)
      .then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return
        const map = {}
        d.forEach(m => {
          const otherId = m.from_id === user.id ? m.to_id : m.from_id
          if (!map[otherId]) map[otherId] = { otherId, messages: [], unread: 0 }
          map[otherId].messages.push(m)
          if (m.to_id === user.id && !m.read) map[otherId].unread++
        })
        setConvos(Object.values(map))
      })
  }, [user, sending])

  useEffect(() => {
    if (!activeId || !user) return
    api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    api(`/rest/v1/messages?to_id=eq.${user.id}&from_id=eq.${activeId}&read=eq.false`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
  }, [activeId, user, sending])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!text.trim() || !activeId || !user) return
    setSending(true)

    // Envoi du message
    await api(`/rest/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_id: user.id, to_id: activeId, body: text.trim(), read: false })
    })

    // Notification au destinataire
    await api(`/rest/v1/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: activeId,
        type:    'message',
        content: `💬 @${profile?.pseudo || 'Quelqu\'un'} vous a envoyé un message`,
        link:    '/messages',
        read:    false
      })
    })

    setText('')
    api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    setSending(false)
  }

  const getMember = (id) => members.find(m => m.id === id)
  const activeMember = getMember(activeId)
  const convoMembers = convos.map(c => getMember(c.otherId)).filter(Boolean)
  const newMembers   = members
    .filter(m => !convos.find(c => c.otherId === m.id))
    .filter(m => !search || m.pseudo?.toLowerCase().includes(search.toLowerCase()))

  const openConvo = (id) => {
    setActiveId(id)
    if (isMobile) setShowSidebar(false)
  }

  if (!user) return null

  return (
    <div ref={containerRef} style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '0' : '20px 16px' }}>
      {!isMobile && (
        <h2 style={{ fontWeight: 700, fontSize: 20, color: '#ddd', marginBottom: 16 }}>Messages privés</h2>
      )}

      <div style={{ display: 'flex', background: C.white, border: isMobile ? 'none' : `1px solid ${C.border}`, borderRadius: isMobile ? 0 : 16, overflow: 'hidden', height: isMobile ? 'calc(100vh - 64px)' : 600, boxShadow: isMobile ? 'none' : '0 2px 12px rgba(0,0,0,.06)' }}>

        {/* ── SIDEBAR ── */}
        {(!isMobile || showSidebar) && (
          <div style={{ width: isMobile ? '100%' : 280, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, background: '#fafafa' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>💬 Conversations</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 14 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un membre…"
                  style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: `1px solid ${C.borderMid}`, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {convoMembers.length > 0 && (
                <div style={{ padding: '8px 0' }}>
                  {convoMembers.map(m => {
                    const convo  = convos.find(c => c.otherId === m.id)
                    const last   = convo?.messages?.[0]
                    const unread = convo?.unread || 0
                    return (
                      <div key={m.id} onClick={() => openConvo(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', background: activeId === m.id ? '#fffae6' : 'transparent', transition: 'background .15s', borderLeft: activeId === m.id ? `3px solid ${C.accentDk}` : '3px solid transparent' }}
                        onMouseEnter={e => { if (activeId !== m.id) e.currentTarget.style.background = '#f8f8f8' }}
                        onMouseLeave={e => { if (activeId !== m.id) e.currentTarget.style.background = 'transparent' }}
                      >
                        <Avatar member={m} size={40} showOnline />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{m.pseudo}</span>
                            {last && <span style={{ fontSize: 10, color: C.textDim }}>{formatTime(last.created_at)}</span>}
                          </div>
                          {last && (
                            <div style={{ fontSize: 12, color: unread > 0 ? C.text : C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread > 0 ? 600 : 400 }}>
                              {last.from_id === user.id ? 'Vous : ' : ''}{last.body}
                            </div>
                          )}
                        </div>
                        {unread > 0 && (
                          <span style={{ background: C.red, color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>{unread}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {newMembers.length > 0 && (
                <div style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: .8 }}>Nouveau message</div>
                  {newMembers.slice(0, 8).map(m => (
                    <div key={m.id} onClick={() => openConvo(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Avatar member={m} size={32} showOnline />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>@{m.pseudo}</div>
                        {m.city && <div style={{ fontSize: 11, color: C.textDim }}>📍 {m.city}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {convoMembers.length === 0 && newMembers.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Aucun membre trouvé</div>
              )}
            </div>
          </div>
        )}

        {/* ── ZONE CHAT ── */}
        {(!isMobile || !showSidebar) && (
          activeMember ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: '#fafafa', display: 'flex', alignItems: 'center', gap: 12 }}>
                {isMobile && (
                  <button onClick={() => setShowSidebar(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.textMid, padding: 0, marginRight: 4 }}>←</button>
                )}
                <Avatar member={activeMember} size={40} showOnline />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>@{activeMember.pseudo}</div>
                  <div style={{ fontSize: 11, color: activeMember.online ? C.online : C.textDim }}>
                    {activeMember.online ? '● En ligne' : '○ Hors ligne'}
                    {activeMember.city ? ` · ${activeMember.city}` : ''}
                  </div>
                </div>
                <RoleBadge role={activeMember.role} />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f5f5f7' }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13, marginTop: 60 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                    Début de la conversation avec @{activeMember.pseudo}
                  </div>
                )}
                {messages.map((m, i) => {
                  const isMe = m.from_id === user.id
                  const showAvatar = !isMe && (i === 0 || messages[i - 1]?.from_id !== m.from_id)
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                      {!isMe && (
                        <div style={{ width: 28, flexShrink: 0 }}>
                          {showAvatar && <Avatar member={activeMember} size={28} />}
                        </div>
                      )}
                      <div style={{ maxWidth: isMobile ? '80%' : '65%' }}>
                        <div style={{ background: isMe ? 'linear-gradient(135deg,#f0c800,#c8a200)' : '#fff', border: isMe ? 'none' : `1px solid ${C.border}`, borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                          <div style={{ fontSize: 13, color: isMe ? '#3a2e00' : C.text, lineHeight: 1.5 }}>{m.body}</div>
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4 }}>
                          {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: '#fff', display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder={`Message à @${activeMember.pseudo}…`}
                  style={{ flex: 1, border: `1px solid ${C.borderMid}`, borderRadius: 24, padding: '10px 18px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none', background: '#f5f5f7', transition: 'border .2s' }}
                  onFocus={e => e.target.style.borderColor = '#c8a200'}
                  onBlur={e => e.target.style.borderColor = C.borderMid}
                />
                <button onClick={send} disabled={sending || !text.trim()} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: text.trim() ? 'linear-gradient(135deg,#f0c800,#c8a200)' : '#e0e0e0', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all .15s', flexShrink: 0 }}>
                  {sending ? '…' : '➤'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textDim, gap: 12 }}>
              <div style={{ fontSize: 48 }}>💬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textMid }}>Tes messages</div>
              <div style={{ fontSize: 13, color: C.textDim, textAlign: 'center', maxWidth: 200 }}>Sélectionne une conversation ou cherche un membre à gauche</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
