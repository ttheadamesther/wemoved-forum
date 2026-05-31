import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY
const MAX_MSG      = 100 // nb messages à charger

async function getToken() {
  try {
    const keys = Object.keys(localStorage)
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (authKey) { const data = JSON.parse(localStorage.getItem(authKey)); if (data?.access_token) return data.access_token }
  } catch {}
  return ANON_KEY
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const COLORS = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
const avatarColor = (pseudo) => COLORS[(pseudo?.charCodeAt(0) || 0) % COLORS.length]

export default function Chatroom() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [messages,  setMessages]  = useState([])
  const [members,   setMembers]   = useState({})
  const [text,      setText]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [online,    setOnline]    = useState([])
  const bottomRef = useRef()
  const inputRef  = useRef()

  // Charger les messages existants
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/chat_messages?select=*&order=created_at.asc&limit=${MAX_MSG}`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMessages(d)
    })
    // Charger les profils
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,pseudo,initials,avatar_url,online&order=created_at.desc`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        const map = {}
        d.forEach(m => { map[m.id] = m })
        setMembers(map)
        setOnline(d.filter(m => m.online))
      }
    })
  }, [])

  // Realtime messages
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`chatroom-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new].slice(-MAX_MSG))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Scroll en bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || !user || sending) return
    setSending(true)
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, body: text.trim() })
    })
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  const getMember = (id) => members[id] || null

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 2 }}>💬 Salon général</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textDim }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            {online.length} membre{online.length !== 1 ? 's' : ''} en ligne
          </div>
        </div>
        {/* Avatars en ligne */}
        <div style={{ display: 'flex' }}>
          {online.slice(0, 6).map((m, i) => (
            <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: m.avatar_url ? '#444' : avatarColor(m.pseudo), border: '2px solid #fff', marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', cursor: 'pointer', zIndex: 10 - i }}>
              {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.initials}
            </div>
          ))}
          {online.length > 6 && <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.surfaceB, border: '2px solid #fff', marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.textMid }}>+{online.length - 6}</div>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13, fontStyle: 'italic' }}>
            Soyez le premier à écrire un message ! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const author = getMember(msg.author_id)
          const isMe = msg.author_id === user?.id
          const prevMsg = messages[i - 1]
          const sameAuthor = prevMsg && prevMsg.author_id === msg.author_id && (new Date(msg.created_at) - new Date(prevMsg.created_at)) < 60000
          return (
            <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row', marginTop: sameAuthor ? 2 : 10 }}>
              {/* Avatar — affiché seulement si nouveau groupe */}
              {!sameAuthor ? (
                <div onClick={() => author && navigate(`/members/${author.id}`)}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: author?.avatar_url ? '#444' : avatarColor(author?.pseudo), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                  {author?.avatar_url ? <img src={author.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : author?.initials || '?'}
                </div>
              ) : (
                <div style={{ width: 30, flexShrink: 0 }} />
              )}
              <div style={{ maxWidth: '70%' }}>
                {!sameAuthor && !isMe && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accentTxt, marginBottom: 3, paddingLeft: 4 }}>@{author?.pseudo || 'Inconnu'}</div>
                )}
                <div style={{ background: isMe ? 'linear-gradient(135deg,#f0c800,#c8a200)' : C.surfaceB, color: isMe ? '#3a2e00' : C.text, padding: '8px 12px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
                  {msg.body}
                </div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, paddingLeft: 4, textAlign: isMe ? 'right' : 'left' }}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {user ? (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Écris un message… (Entrée pour envoyer)"
            maxLength={500}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.white, color: C.text, transition: 'border .2s' }}
            onFocus={e => e.target.style.borderColor = '#c8a200'}
            onBlur={e => e.target.style.borderColor = C.borderMid}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: text.trim() ? 'linear-gradient(135deg,#f0c800,#c8a200)' : C.surfaceB, color: text.trim() ? '#3a2e00' : C.textDim, cursor: text.trim() ? 'pointer' : 'default', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', flexShrink: 0 }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, color: C.textDim }}>
          <button onClick={() => navigate('/login')} style={{ color: C.accentTxt, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Connecte-toi</button> pour participer au chat
        </div>
      )}
    </div>
  )
}