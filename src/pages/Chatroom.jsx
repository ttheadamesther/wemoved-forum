import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, ROLE_RING } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import EmojiPicker from 'emoji-picker-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY
const MAX_MSG      = 100
const FLOOD_DELAY  = 3000

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

const QUICK_REACTIONS = ['👍','❤️','😂','😮','🔥','🎉']

export default function Chatroom() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [messages,   setMessages]   = useState([])
  const [members,    setMembers]    = useState({})
  const [text,       setText]       = useState('')
  const [sending,    setSending]    = useState(false)
  const [online,     setOnline]     = useState([])
  const [floodMsg,   setFloodMsg]   = useState('')
  const [typing,     setTyping]     = useState([]) // pseudos en train d'écrire
  const [showEmoji,  setShowEmoji]  = useState(false)
  const [reactionPicker, setReactionPicker] = useState(null) // msgId
  const [reactions,  setReactions]  = useState({}) // { msgId: { emoji: [userId] } }
  const bottomRef    = useRef()
  const inputRef     = useRef()
  const emojiRef     = useRef()
  const lastSentTime = useRef(0)
  const typingTimeout = useRef(null)
  const isTyping     = useRef(false)

  const canMod = ['admin', 'manager', 'moderateur'].includes(profile?.role)
  const isBanned = profile?.banned && (!profile.banned_until || new Date(profile.banned_until) > new Date())

  // Fermer emoji picker au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Charger messages + membres
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/chat_messages?select=*&order=created_at.asc&limit=${MAX_MSG}`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setMessages(d)
        // Charger réactions depuis les messages
        const rxMap = {}
        d.forEach(msg => { if (msg.reactions) rxMap[msg.id] = msg.reactions })
        setReactions(rxMap)
      }
    })

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

  // Realtime : messages + online + typing
  useEffect(() => {
    if (!supabase) return

    // Un seul channel pour les messages
    const msgChannel = supabase
      .channel('chatroom-main')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new].slice(-MAX_MSG)
        })
        if (payload.new.reactions) {
          setReactions(prev => ({ ...prev, [payload.new.id]: payload.new.reactions }))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        if (payload.new.reactions) {
          setReactions(prev => ({ ...prev, [payload.new.id]: payload.new.reactions }))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.new && 'online' in payload.new) {
          setMembers(prev => ({ ...prev, [payload.new.id]: { ...prev[payload.new.id], ...payload.new } }))
          setOnline(prev => {
            const filtered = prev.filter(m => m.id !== payload.new.id)
            if (payload.new.online) {
              const existing = Object.values(members).find(m => m.id === payload.new.id)
              return [...filtered, { ...existing, ...payload.new }]
            }
            return filtered
          })
        }
      })
      .subscribe((status) => {
        console.log('Chatroom realtime status:', status)
      })

    // Typing via Presence — channel séparé
    let typingChannel = null
    if (user) {
      typingChannel = supabase.channel('chatroom-presence')
      typingChannel
        .on('presence', { event: 'sync' }, () => {
          const state = typingChannel.presenceState()
          const typingUsers = Object.values(state)
            .flat()
            .filter(p => p.typing && p.user_id !== user?.id)
            .map(p => p.pseudo)
          setTyping([...new Set(typingUsers)])
        })
        .subscribe()
    }

    return () => {
      supabase.removeChannel(msgChannel)
      if (typingChannel) supabase.removeChannel(typingChannel)
    }
  }, [user])

  // Scroll automatique
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Signaler "en train d'écrire"
  const handleTyping = (val) => {
    setText(val)
    if (!user || !supabase) return
    const ch = supabase.channel('chatroom-presence')
    if (!isTyping.current) {
      isTyping.current = true
      ch.track({ user_id: user.id, pseudo: profile?.pseudo, typing: true })
    }
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
    // Arrêter l'indicateur de frappe
    isTyping.current = false
    clearTimeout(typingTimeout.current)
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, body: text.trim(), reactions: {} })
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
    await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=eq.${msgId}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ reactions: newReactions })
    })
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
        <div style={{ display: 'flex' }}>
          {online.slice(0, 6).map((m, i) => {
            const ring = ROLE_RING[m.role] || null
            return (
              <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: m.avatar_url ? '#444' : avatarColor(m.pseudo), border: ring ? `2px solid ${ring}` : '2px solid #fff', marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', cursor: 'pointer', zIndex: 10 - i, boxShadow: ring ? `0 0 6px ${ring}88` : 'none' }}>
                {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.initials}
              </div>
            )
          })}
          {online.length > 6 && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.surfaceB, border: '2px solid #fff', marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.textMid }}>
              +{online.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textDim, fontSize: 13, fontStyle: 'italic' }}>
            Soyez le premier à écrire un message ! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const author   = getMember(msg.author_id)
          const isMe     = msg.author_id === user?.id
          const prevMsg  = messages[i - 1]
          const sameAuthor = prevMsg && prevMsg.author_id === msg.author_id && (new Date(msg.created_at) - new Date(prevMsg.created_at)) < 60000
          const canDelete = isMe || canMod
          const msgReactions = reactions[msg.id] || {}
          return (
            <div key={msg.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: sameAuthor ? 2 : 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.querySelector('.msg-actions').style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.querySelector('.msg-actions').style.opacity = '0' }}>
                {/* Avatar */}
                {!sameAuthor ? (
                  <div onClick={() => author && navigate(`/members/${author.id}`)}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: author?.avatar_url ? '#444' : avatarColor(author?.pseudo), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: ROLE_RING[author?.role] ? `2px solid ${ROLE_RING[author?.role]}` : 'none' }}>
                    {author?.avatar_url ? <img src={author.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : author?.initials || '?'}
                  </div>
                ) : <div style={{ width: 30, flexShrink: 0 }} />}

                <div style={{ maxWidth: '70%', position: 'relative' }}>
                  {!sameAuthor && !isMe && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.accentTxt, marginBottom: 3, paddingLeft: 4 }}>@{author?.pseudo || 'Inconnu'}</div>
                  )}
                  <div onDoubleClick={() => user && setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                    style={{ background: isMe ? 'linear-gradient(135deg,#f0c800,#c8a200)' : C.surfaceB, color: isMe ? '#3a2e00' : C.text, padding: '8px 12px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,.06)', cursor: user ? 'default' : 'default', userSelect: 'text' }}>
                    {msg.body}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, paddingLeft: 4, textAlign: isMe ? 'right' : 'left' }}>
                    {formatTime(msg.created_at)}
                  </div>
                  </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, opacity: 0, transition: 'opacity .2s' }} className="msg-actions">
                {/* Bouton réaction */}
                {user && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                      style={{ background: C.surfaceB, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 13, padding: '3px 6px', borderRadius: 8, transition: 'all .2s' }}>
                      😊
                    </button>
                    {reactionPicker === msg.id && (
                      <div style={{ position: 'absolute', bottom: '110%', [isMe ? 'right' : 'left']: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 8px', display: 'flex', gap: 4, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.12)', whiteSpace: 'nowrap' }}>
                        {QUICK_REACTIONS.map(emoji => (
                          <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                            style={{ fontSize: 18, background: (msgReactions[emoji] || []).includes(user?.id) ? C.accentBg : 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, transition: 'all .15s' }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Bouton supprimer */}
                {canDelete && (
                  <button onClick={() => deleteMessage(msg.id)}
                    style={{ background: 'transparent', border: `1px solid #e74c3c`, borderRadius: 8, color: '#e74c3c', fontSize: 11, cursor: 'pointer', padding: '3px 6px', transition: 'all .2s' }}>
                    ✕
                  </button>
                )}
              </div>
              </div>

              {/* Réactions affichées */}
              {Object.keys(msgReactions).length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: isMe ? 0 : 38, paddingRight: isMe ? 38 : 0, flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  {Object.entries(msgReactions).filter(([, likers]) => likers.length > 0).map(([emoji, likers]) => (
                    <button key={emoji} onClick={() => user && toggleReaction(msg.id, emoji)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: likers.includes(user?.id) ? C.accentBg : C.surfaceB, border: `1px solid ${likers.includes(user?.id) ? C.accentDk : C.border}`, cursor: user ? 'pointer' : 'default', fontSize: 12, fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 14 }}>{emoji}</span>
                      <span style={{ fontWeight: 700, color: likers.includes(user?.id) ? C.accentTxt : C.textMid }}>{likers.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Indicateur de frappe */}
      <div style={{ height: 18, marginBottom: 4, paddingLeft: 8 }}>
        {typing.length > 0 && (
          <div style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>
            {typing.slice(0, 3).join(', ')} {typing.length === 1 ? 'est en train d\'écrire' : 'sont en train d\'écrire'} <span style={{ animation: 'pulse 1s infinite' }}>…</span>
          </div>
        )}
      </div>

      {/* Input */}
      {user ? (
        <div style={{ flexShrink: 0 }}>
          {isBanned && (
            <div style={{ textAlign: 'center', padding: '10px', background: C.surfaceB, border: `1px solid #e74c3c`, borderRadius: 12, fontSize: 12, color: '#e74c3c', marginBottom: 8 }}>
              ⛔ Tu es banni et ne peux pas envoyer de messages.
            </div>
          )}
          {floodMsg && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 4, textAlign: 'center' }}>⏳ {floodMsg}</div>}
          {!isBanned && (
            <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
              {/* Emoji picker */}
              <div ref={emojiRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowEmoji(s => !s)}
                  style={{ width: 46, height: 46, borderRadius: '50%', border: `1px solid ${C.borderMid}`, background: C.surfaceB, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  😊
                </button>
                {showEmoji && (
                  <div style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 1000 }}>
                    <EmojiPicker onEmojiClick={insertEmoji} width={300} height={350} />
                  </div>
                )}
              </div>
              <input ref={inputRef} value={text} onChange={e => handleTyping(e.target.value)}
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
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, color: C.textDim }}>
          <button onClick={() => navigate('/login')} style={{ color: C.accentTxt, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Connecte-toi</button> pour participer au chat
        </div>
      )}
    </div>
  )
}