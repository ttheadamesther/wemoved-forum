import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, ROLE_RING } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import EmojiPicker from 'emoji-picker-react'
import { useMention } from '../hooks/useMention.jsx'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY
const MAX_MSG      = 100
const FLOOD_DELAY  = 3000

const ROOMS = [
  { id: 'salon-1', label: 'Salon 1', color: '#3498db', bg: 'rgba(52,152,219,.12)', border: 'rgba(52,152,219,.4)', emoji: '🔵' },
  { id: 'salon-2', label: 'Salon 2', color: '#e91e63', bg: 'rgba(233,30,99,.12)',  border: 'rgba(233,30,99,.4)',  emoji: '🌸' },
  { id: 'salon-3', label: 'Salon 3', color: '#2ecc71', bg: 'rgba(46,204,113,.12)', border: 'rgba(46,204,113,.4)', emoji: '🟢' },
  { id: 'salon-4', label: 'Salon 4', color: '#f0c800', bg: 'rgba(240,200,0,.12)',  border: 'rgba(240,200,0,.4)',  emoji: '🟡' },
  { id: 'salon-5', label: 'Salon 5', color: '#9b59b6', bg: 'rgba(155,89,182,.12)', border: 'rgba(155,89,182,.4)', emoji: '🟣' },
  { id: 'qgdf',    label: 'QGDF',    color: '#e67e22', bg: 'rgba(230,126,34,.12)', border: 'rgba(230,126,34,.4)', emoji: '🏠' },
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
const QUICK_REACTIONS = ['👍','❤️','😂','😮','🔥','🎉']

export default function Chatroom() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [room,         setRoom]         = useState(ROOMS[0])
  const [messages,     setMessages]     = useState([])
  const [members,      setMembers]      = useState({})
  const [text,         setText]         = useState('')
  const [sending,      setSending]      = useState(false)
  const [online,       setOnline]       = useState([])
  const [floodMsg,     setFloodMsg]     = useState('')
  const [typing,       setTyping]       = useState([])
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [reactionPicker, setReactionPicker] = useState(null)
  const [reactions,    setReactions]    = useState({})
  const bottomRef     = useRef()
  const inputRef      = useRef()
  const emojiRef      = useRef()
  const lastSentTime  = useRef(0)
  const typingTimeout = useRef(null)
  const isTyping      = useRef(false)
  const channelRef    = useRef(null)

  const canMod = ['admin', 'manager', 'moderateur'].includes(profile?.role)
  const isBanned = profile?.banned && (!profile.banned_until || new Date(profile.banned_until) > new Date())

  // Close emoji on outside click
  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load members once
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,pseudo,initials,avatar_url,online,role&order=created_at.desc`, {
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

  // Load messages when room changes
  useEffect(() => {
    setMessages([])
    setReactions({})
    setReactionPicker(null)

    fetch(`${SUPABASE_URL}/rest/v1/chat_messages?select=*&room=eq.${room.id}&order=created_at.asc&limit=${MAX_MSG}`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setMessages(d)
        const rxMap = {}
        d.forEach(msg => { if (msg.reactions) rxMap[msg.id] = msg.reactions })
        setReactions(rxMap)
      }
    })
  }, [room.id])

  // Realtime subscription per room
  useEffect(() => {
    if (!supabase) return
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase
      .channel(`chatroom-${room.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${room.id}` }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new].slice(-MAX_MSG)
        })
        if (payload.new.reactions) setReactions(prev => ({ ...prev, [payload.new.id]: payload.new.reactions }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room=eq.${room.id}` }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        setReactions(prev => ({ ...prev, [payload.new.id]: payload.new.reactions || {} }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.new && 'online' in payload.new) {
          setMembers(prev => ({ ...prev, [payload.new.id]: { ...prev[payload.new.id], ...payload.new } }))
          setOnline(prev => {
            const filtered = prev.filter(m => m.id !== payload.new.id)
            if (payload.new.online) return [...filtered, payload.new]
            return filtered
          })
        }
      })
      .subscribe()

    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [room.id])

  // Typing presence
  useEffect(() => {
    if (!user || !supabase) return
    const ch = supabase.channel(`chatroom-presence-${room.id}`)
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const typingUsers = Object.values(state).flat()
        .filter(p => p.typing && p.user_id !== user?.id)
        .map(p => p.pseudo)
      setTyping([...new Set(typingUsers)])
    }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, room.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTyping = (val) => {
    setText(val)
    if (!user || !supabase) return
    const ch = supabase.channel(`chatroom-presence-${room.id}`)
    if (!isTyping.current) { isTyping.current = true; ch.track({ user_id: user.id, pseudo: profile?.pseudo, typing: true }) }
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false
      ch.track({ user_id: user.id, pseudo: profile?.pseudo, typing: false })
    }, 2000)
  }

  const send = async () => {
    if (!text.trim() || !user || sending || isBanned) return
    const now = Date.now()
    if (now - lastSentTime.current < FLOOD_DELAY) {
      const wait = Math.ceil((FLOOD_DELAY - (now - lastSentTime.current)) / 1000)
      setFloodMsg(`Attends encore ${wait}s…`)
      setTimeout(() => setFloodMsg(''), FLOOD_DELAY - (now - lastSentTime.current))
      return
    }
    setFloodMsg('')
    setSending(true)
    lastSentTime.current = now
    isTyping.current = false
    clearTimeout(typingTimeout.current)
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, body: text.trim(), reactions: {}, room: room.id })
    })
    setText('')
    setSending(false)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  const deleteMessage = async (msgId) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=eq.${msgId}`, {
      method: 'DELETE',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
    })
  }

  const toggleReaction = async (msgId, emoji) => {
    if (!user) return
    const current = reactions[msgId] || {}
    const likers = current[emoji] || []
    const alreadyLiked = likers.includes(user.id)
    const newLikers = alreadyLiked ? likers.filter(id => id !== user.id) : [...likers, user.id]
    const newReactions = { ...current, [emoji]: newLikers }
    if (newLikers.length === 0) delete newReactions[emoji]
    setReactions(prev => ({ ...prev, [msgId]: newReactions }))
    setReactionPicker(null)
    const token = await getToken()
    fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=eq.${msgId}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ reactions: newReactions })
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d[0]?.reactions !== undefined) setReactions(prev => ({ ...prev, [msgId]: d[0].reactions }))
    }).catch(() => setReactions(prev => ({ ...prev, [msgId]: current })))
  }

  const insertEmoji = (emojiData) => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart; const end = el.selectionEnd
    const newVal = text.slice(0, start) + emojiData.emoji + text.slice(end)
    setText(newVal)
    setShowEmoji(false)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length) }, 0)
  }

  const { handleMentionInput, handleKeyDown: handleMentionKey, MentionDropdown } = useMention(members, inputRef, text, setText)

  const getMember = (id) => members[id] || null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', gap: 12 }}>

      {/* Tabs salons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {ROOMS.map(r => {
          const active = r.id === room.id
          return (
            <button key={r.id} onClick={() => { setRoom(r); setText('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 99,
                border: `1.5px solid ${active ? r.color : 'var(--border)'}`,
                background: active ? r.bg : 'var(--surfaceB)',
                color: active ? r.color : 'var(--textMid)',
                fontWeight: active ? 700 : 500,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .18s',
                boxShadow: active ? `0 0 12px ${r.bg}` : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.color = r.color } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--textMid)' } }}>
              <span>{r.emoji}</span>
              {r.label}
            </button>
          )
        })}
      </div>

      {/* Header salon actif */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 18, color: room.color, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            {room.emoji} {room.label}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', display: 'inline-block', boxShadow: '0 0 6px #2ecc71' }} />
          </h1>
          <div style={{ fontSize: 12, color: 'var(--textDim)' }}>{online.length} membre{online.length !== 1 ? 's' : ''} en ligne</div>
        </div>
        <div style={{ display: 'flex' }}>
          {online.slice(0, 5).map((m, i) => (
            <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
              style={{ width: 30, height: 30, borderRadius: '50%', background: m.avatar_url ? '#444' : avatarColor(m.pseudo), border: `2px solid ${ROLE_RING[m.role] || room.color}`, marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', cursor: 'pointer', zIndex: 10 - i }}>
              {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.initials}
            </div>
          ))}
          {online.length > 5 && (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surfaceB)', border: `2px solid ${room.color}`, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--textMid)' }}>+{online.length - 5}</div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--white)', border: `1.5px solid ${room.border}`, borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--textDim)', fontSize: 13, fontStyle: 'italic' }}>
            {room.emoji} Soyez le premier à écrire dans ce salon !
          </div>
        )}
        {messages.map((msg, i) => {
          const author = getMember(msg.author_id)
          const isMe = msg.author_id === user?.id
          const prevMsg = messages[i - 1]
          const sameAuthor = prevMsg && prevMsg.author_id === msg.author_id && (new Date(msg.created_at) - new Date(prevMsg.created_at)) < 60000
          const canDelete = isMe || canMod
          const msgReactions = reactions[msg.id] || {}
          const hasReactions = Object.entries(msgReactions).some(([, likers]) => likers.length > 0)

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: sameAuthor ? 2 : 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}
                onMouseEnter={e => { const a = e.currentTarget.querySelector('.msg-actions'); if (a) a.style.opacity = '1' }}
                onMouseLeave={e => { const a = e.currentTarget.querySelector('.msg-actions'); if (a) a.style.opacity = '0' }}>

                {!sameAuthor ? (
                  <div onClick={() => author && navigate(`/members/${author.id}`)}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: author?.avatar_url ? '#444' : avatarColor(author?.pseudo), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: ROLE_RING[author?.role] ? `2px solid ${ROLE_RING[author?.role]}` : `2px solid ${room.color}44` }}>
                    {author?.avatar_url ? <img src={author.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : author?.initials || '?'}
                  </div>
                ) : <div style={{ width: 30, flexShrink: 0 }} />}

                <div style={{ maxWidth: '70%', position: 'relative' }}>
                  {!sameAuthor && !isMe && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: room.color, marginBottom: 3, paddingLeft: 4 }}>
                      @{author?.pseudo || 'Inconnu'}
                      {author?.is_bot && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: '#5865f2', color: '#fff' }}>BOT</span>}
                    </div>
                  )}
                  <div onDoubleClick={() => user && setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                    style={{ background: isMe ? `linear-gradient(135deg, ${room.color}dd, ${room.color}aa)` : 'var(--surfaceB)', color: isMe ? '#fff' : 'var(--text)', padding: '8px 12px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word', boxShadow: isMe ? `0 2px 8px ${room.color}44` : '0 1px 2px rgba(0,0,0,.06)', userSelect: 'text' }}>
                    {msg.body}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 2, paddingLeft: 4, textAlign: isMe ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, opacity: 0, transition: 'opacity .2s' }} className="msg-actions">
                  {user && (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                        style={{ background: 'var(--surfaceB)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, padding: '3px 6px', borderRadius: 8 }}>😊</button>
                      {reactionPicker === msg.id && (
                        <div style={{ position: 'absolute', bottom: '110%', [isMe ? 'right' : 'left']: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '6px 8px', display: 'flex', gap: 4, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.12)', whiteSpace: 'nowrap' }}>
                          {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              style={{ fontSize: 18, background: (msgReactions[emoji] || []).includes(user?.id) ? room.bg : 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {canDelete && (
                    <button onClick={() => deleteMessage(msg.id)}
                      style={{ background: 'transparent', border: '1px solid #e74c3c', borderRadius: 8, color: '#e74c3c', fontSize: 11, cursor: 'pointer', padding: '3px 6px' }}>✕</button>
                  )}
                </div>
              </div>

              {hasReactions && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: isMe ? 0 : 38, paddingRight: isMe ? 38 : 0, flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  {Object.entries(msgReactions).filter(([, likers]) => likers.length > 0).map(([emoji, likers]) => (
                    <button key={emoji} onClick={() => user && toggleReaction(msg.id, emoji)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: likers.includes(user?.id) ? room.bg : 'var(--surfaceB)', border: `1px solid ${likers.includes(user?.id) ? room.color : 'var(--border)'}`, cursor: user ? 'pointer' : 'default', fontSize: 12, fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 14 }}>{emoji}</span>
                      <span style={{ fontWeight: 700, color: likers.includes(user?.id) ? room.color : 'var(--textMid)' }}>{likers.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div style={{ height: 18, paddingLeft: 8, flexShrink: 0 }}>
        {typing.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--textDim)', fontStyle: 'italic' }}>
            {typing.slice(0, 3).join(', ')} {typing.length === 1 ? "est en train d'écrire" : "sont en train d'écrire"} <span style={{ animation: 'pulse 1s infinite' }}>…</span>
          </div>
        )}
      </div>

      {/* Input */}
      {user ? (
        <div style={{ flexShrink: 0 }}>
          {isBanned && (
            <div style={{ textAlign: 'center', padding: 10, background: 'var(--surfaceB)', border: '1px solid #e74c3c', borderRadius: 12, fontSize: 12, color: '#e74c3c', marginBottom: 8 }}>
              ⛔ Tu es banni et ne peux pas envoyer de messages.
            </div>
          )}
          {floodMsg && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginBottom: 4, textAlign: 'center' }}>⏳ {floodMsg}</div>}
          {!isBanned && (
            <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
              <div ref={emojiRef} style={{ position: 'relative' }}>
                  <MentionDropdown />
                <button onClick={() => setShowEmoji(s => !s)}
                  style={{ width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${room.border}`, background: room.bg, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>😊</button>
                {showEmoji && (
                  <div style={{ position: 'fixed', bottom: 80, right: 20, zIndex: 1000 }}>
                    <EmojiPicker onEmojiClick={insertEmoji} width={400} height={550} theme="dark" />
                  </div>
                )}
              </div>
              <input ref={inputRef} value={text} onChange={e => { handleTyping(e.target.value); handleMentionInput(e.target.value, e.target.selectionStart) }}
                onKeyDown={e => { handleMentionKey(e); if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) send() }}
                placeholder={`Écrire dans ${room.label}…`}
                maxLength={500}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: `1.5px solid ${room.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--white)', color: 'var(--text)', transition: 'border .2s, box-shadow .2s' }}
                onFocus={e => { e.target.style.borderColor = room.color; e.target.style.boxShadow = `0 0 0 3px ${room.bg}` }}
                onBlur={e => { e.target.style.borderColor = room.border; e.target.style.boxShadow = 'none' }}
              />
              <button onClick={send} disabled={!text.trim() || sending}
                style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: text.trim() ? room.color : 'var(--surfaceB)', color: text.trim() ? '#fff' : 'var(--textDim)', cursor: text.trim() ? 'pointer' : 'default', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', flexShrink: 0, boxShadow: text.trim() ? `0 2px 12px ${room.bg}` : 'none' }}>
                {sending ? '…' : '➤'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 14, background: 'var(--surfaceB)', border: `1px solid ${room.border}`, borderRadius: 12, fontSize: 13, color: 'var(--textDim)' }}>
          <button onClick={() => navigate('/login')} style={{ color: room.color, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Connecte-toi</button> pour participer
        </div>
      )}
    </div>
  )
}