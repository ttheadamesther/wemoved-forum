import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { Btn } from '../components/UI'
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

export default function MessagesPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [members,    setMembers]    = useState([])
  const [convos,     setConvos]     = useState([])
  const [activeId,   setActiveId]   = useState(null)
  const [messages,   setMessages]   = useState([])
  const [text,       setText]       = useState('')
  const [sending,    setSending]    = useState(false)
  const [search,     setSearch]     = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { if (user === null) navigate('/login') }, [user])

  // Charger tous les membres
  useEffect(() => {
    if (!user) return
    api(`/rest/v1/profiles?id=neq.${user.id}&select=*`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
  }, [user])

  // Charger les conversations (derniers messages par interlocuteur)
  useEffect(() => {
    if (!user) return
    api(`/rest/v1/messages?or=(from_id.eq.${user.id},to_id.eq.${user.id})&order=created_at.desc&limit=100`)
      .then(r => r.json()).then(d => {
        if (!Array.isArray(d)) return
        // Grouper par interlocuteur
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

  // Charger les messages de la conversation active
  useEffect(() => {
    if (!activeId || !user) return
    api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    // Marquer comme lus
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
    await api(`/rest/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_id: user.id, to_id: activeId, body: text.trim(), read: false })
    })
    setText('')
    // Recharger messages
    api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    setSending(false)
  }

  const getMember = (id) => members.find(m => m.id === id)
  const activeMember = getMember(activeId)

  const convoMembers = convos.map(c => getMember(c.otherId)).filter(Boolean)
  const newMembers   = members.filter(m => !convos.find(c => c.otherId === m.id))
    .filter(m => !search || m.pseudo?.toLowerCase().includes(search.toLowerCase()))

  if (!user) return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 18, color: '#555', marginBottom: 14 }}>Messages privés</h2>
      <div style={{ display: 'flex', background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', height: 560 }}>

        {/* Sidebar */}
        <div style={{ width: 240, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', background: '#f9f9f9', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: .5 }}>
            Conversations
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Conversations existantes */}
            {convoMembers.map(m => {
              const convo  = convos.find(c => c.otherId === m.id)
              const last   = convo?.messages?.[0]
              const unread = convo?.unread || 0
              return (
                <div key={m.id} onClick={() => setActiveId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: activeId === m.id ? '#fffae6' : 'transparent', transition: 'all .15s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: C.text }}>@{m.pseudo}</div>
                    {last && <div style={{ fontSize: 11, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {last.from_id === user.id ? 'Vous : ' : ''}{last.body}
                    </div>}
                  </div>
                  {unread > 0 && <span style={{ background: C.red, color: '#fff', borderRadius: 8, fontSize: 10, fontWeight: 700, padding: '1px 5px', flexShrink: 0 }}>{unread}</span>}
                </div>
              )
            })}

            {/* Nouveau message */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Nouveau message</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un membre…" style={{ width: '100%', padding: '5px 8px', borderRadius: 3, border: `1px solid ${C.borderMid}`, fontSize: 12, marginBottom: 8, fontFamily: "'Open Sans',sans-serif" }} />
              {newMembers.slice(0, 5).map(m => (
                <div key={m.id} onClick={() => { setActiveId(m.id); setSearch('') }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderRadius: 3 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.initials}
                  </div>
                  <span style={{ fontSize: 12, color: C.textMid }}>@{m.pseudo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zone de chat */}
        {activeMember ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: '#f9f9f9', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {activeMember.avatar_url ? <img src={activeMember.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : activeMember.initials}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{activeMember.pseudo}</div>
                <div style={{ fontSize: 11, color: C.textMid }}>{activeMember.city || ''}</div>
              </div>
              <RoleBadge role={activeMember.role} />
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13, marginTop: 40 }}>
                  Début de la conversation avec @{activeMember.pseudo}
                </div>
              )}
              {messages.map((m, i) => {
                const isMe = m.from_id === user.id
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '72%', background: isMe ? '#fffae6' : C.white, border: `1px solid ${isMe ? C.accentDk : C.border}`, borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px' }}>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{m.body}</div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: C.white, display: 'flex', gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={`Message à @${activeMember.pseudo}…`}
                style={{ flex: 1, border: `1px solid ${C.borderMid}`, borderRadius: 20, padding: '7px 14px', fontSize: 13, color: C.text, fontFamily: "'Open Sans',sans-serif", outline: 'none' }}
              />
              <Btn onClick={send} variant="yellow">{sending ? '…' : 'Envoyer'}</Btn>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 13 }}>
            Sélectionne une conversation ou un membre
          </div>
        )}
      </div>
    </div>
  )
}