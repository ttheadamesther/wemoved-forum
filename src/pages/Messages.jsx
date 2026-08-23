import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { C } from '../lib/constants'
import { RoleBadge } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import EmojiPicker from 'emoji-picker-react'
import { useMention } from '../hooks/useMention.jsx'
import { supabase } from '../lib/supabase'
import VoiceRecorder from '../components/VoiceRecorder'
import VoiceMessagePlayer from '../components/VoiceMessagePlayer'
import { uploadVoiceMessage } from '../lib/uploadVoiceMessage'

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

async function api(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)    return "À l'instant"
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
          ? <img loading="lazy" decoding="async" src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : member?.initials || '??'
        }
      </div>
      {showOnline && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: member?.online ? C.online : '#ccc', border: '2px solid #fff' }} />
      )}
    </div>
  )
}

function MessageBody({ body, isMe }) {
  const isImage = body?.startsWith('__IMG__')
  if (isImage) {
    const url = body.replace('__IMG__', '')
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        onContextMenu={e => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}>
        <img loading="lazy" decoding="async" src={url} alt="photo" draggable={false}
          onContextMenu={e => e.preventDefault()}
          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block', cursor: 'pointer', objectFit: 'cover', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} />
      </a>
    )
  }
  return (
    <div style={{
      fontSize: 13, color: isMe ? '#3a2e00' : C.text, lineHeight: 1.5,
      wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
    }}>
      {body}
    </div>
  )
}

// Petite bulle "… est en train d'écrire" avec 3 points animés
function TypingBubble({ isMobile }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: isMobile ? '9px 12px' : '8px 14px',
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: '18px 18px 18px 4px',
      width: 'fit-content', maxWidth: 'fit-content',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: isMobile ? 5 : 6, height: isMobile ? 5 : 6, borderRadius: '50%',
          background: C.textDim, flexShrink: 0,
          animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`
        }} />
      ))}
    </div>
  )
}

export default function MessagesPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef()
  const fileInputRef = useRef()
  const inputRef = useRef()
  const emojiRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members,  setMembers]  = useState([])
  const [convos,   setConvos]   = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [search,   setSearch]   = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [blockedIds, setBlockedIds]   = useState([])
  const [blockedByIds, setBlockedByIds] = useState([])
  const [hoveredMsg, setHoveredMsg]   = useState(null)
  const [deletingMsg, setDeletingMsg] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [reactionPicker, setReactionPicker] = useState(null) // message id
  const [otherTyping, setOtherTyping] = useState(false)
  const bottomRef = useRef(null)
  const longPressTimer = useRef(null)
  const channelRef = useRef(null)
  const typingStopTimer = useRef(null)

  // Keyframes pour les animations (réactions + "en train d'écrire" + envoi de message)
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'reaction-animations'
    style.textContent = `
      @keyframes reactionPickerIn {
        from { opacity: 0; transform: scaleX(0.3) scaleY(0.7); }
        to   { opacity: 1; transform: scaleX(1)   scaleY(1);   }
      }
      @keyframes reactionEmojiIn {
        from { opacity: 0; transform: scale(0) translateY(6px); }
        to   { opacity: 1; transform: scale(1) translateY(0);   }
      }
      @keyframes typingDot {
        0%, 60%, 100% { transform: translateY(0);   opacity: .4; }
        30%           { transform: translateY(-4px); opacity: 1;  }
      }
      @keyframes msgInMe {
        from { opacity: 0; transform: translateY(10px) scale(.9); }
        to   { opacity: 1; transform: translateY(0)    scale(1);  }
      }
      @keyframes msgInOther {
        from { opacity: 0; transform: translateY(10px) scale(.9); }
        to   { opacity: 1; transform: translateY(0)    scale(1);  }
      }
    `
    if (!document.getElementById('reaction-animations')) {
      document.head.appendChild(style)
    }
    return () => document.getElementById('reaction-animations')?.remove()
  }, [])

  const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

  const toggleReaction = async (msgId, emoji) => {
    if (!user) return
    setReactionPicker(null)
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = msg.reactions || {}
    const likers = reactions[emoji] || []
    const alreadyLiked = likers.includes(user.id)
    const newLikers = alreadyLiked ? likers.filter(id => id !== user.id) : [...likers, user.id]
    const newReactions = { ...reactions, [emoji]: newLikers }
    if (newLikers.length === 0) delete newReactions[emoji]
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m))
    await api(`/rest/v1/messages?id=eq.${msgId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reactions: newReactions }),
      headers: { 'Prefer': 'return=minimal' }
    })
  }

  const handleLongPressStart = (msgId) => {
    longPressTimer.current = setTimeout(() => setReactionPicker(msgId), 500)
  }
  const handleLongPressEnd = () => {
    clearTimeout(longPressTimer.current)
  }

  // Fermer emoji picker au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── DÉTECTION MOBILE (avec debounce + hystérésis anti-tremblement) ──
  useEffect(() => {
    let timeout = null
    const observer = new ResizeObserver(entries => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        for (const entry of entries) {
          const w = entry.contentRect.width
          setIsMobile(prev => {
            if (prev && w >= 780) return false
            if (!prev && w < 760) return true
            return prev
          })
        }
      }, 150)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  useEffect(() => { if (user === null) navigate('/login') }, [user])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const toId = params.get('to')
    if (toId && user && toId !== user.id) {
      setActiveId(toId)
      if (isMobile) setShowSidebar(false)
    }
  }, [location.search, user])

  useEffect(() => {
    if (!user) return
    api(`/rest/v1/profiles?id=neq.${user.id}&select=id,pseudo,initials,avatar_url,online,role`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
    api(`/rest/v1/blocks?blocker_id=eq.${user.id}&select=blocked_id`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBlockedIds(d.map(b => b.blocked_id)) })
    api(`/rest/v1/blocks?blocked_id=eq.${user.id}&select=blocker_id`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBlockedByIds(d.map(b => b.blocker_id)) })
  }, [user])

  const loadConvos = () => {
    if (!user) return
    api(`/rest/v1/messages?or=(from_id.eq.${user.id},to_id.eq.${user.id})&order=created_at.desc&limit=200`)
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
  }

  useEffect(() => { loadConvos() }, [user, sending])

  useEffect(() => {
    if (!activeId || !user) return
    api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMessages(d) })
    getToken().then(token => {
      fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&from_id=eq.${activeId}&read=eq.false`, {
        method: 'PATCH',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ read: true })
      }).then(() => {
        window.dispatchEvent(new CustomEvent('messages-read'))
      })
    })
  }, [activeId, user])

  // ── REALTIME : messages instants + "en train d'écrire" ──
  useEffect(() => {
    if (!activeId || !user || !supabase) return

    setOtherTyping(false)
    const roomName = `dm:${[user.id, activeId].sort().join('_')}`
    const channel = supabase.channel(roomName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `to_id=eq.${user.id}`
      }, (payload) => {
        const m = payload.new
        if (m.from_id !== activeId) return
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        setOtherTyping(false)
        api(`/rest/v1/messages?id=eq.${m.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
          headers: { 'Prefer': 'return=minimal' }
        })
        window.dispatchEvent(new CustomEvent('messages-read'))
        loadConvos()
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId !== activeId) return
        setOtherTyping(payload.isTyping)
        if (payload.isTyping) {
          clearTimeout(typingStopTimer.current)
          typingStopTimer.current = setTimeout(() => setOtherTyping(false), 3000)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      clearTimeout(typingStopTimer.current)
    }
  }, [activeId, user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, otherTyping])

  const broadcastTyping = (isTyping) => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, isTyping } })
  }

  const onTextChange = (val, selectionStart) => {
    setText(val)
    handleMentionInput(val, selectionStart)
    if (!activeId) return
    broadcastTyping(true)
    clearTimeout(typingStopTimer.current)
    typingStopTimer.current = setTimeout(() => broadcastTyping(false), 2000)
  }

  const insertEmoji = (emojiData) => {
    const el = inputRef.current
    if (!el) { setText(t => t + emojiData.emoji); setShowEmoji(false); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = text.slice(0, start) + emojiData.emoji + text.slice(end)
    setText(newVal)
    setShowEmoji(false)
    broadcastTyping(true)
    clearTimeout(typingStopTimer.current)
    typingStopTimer.current = setTimeout(() => broadcastTyping(false), 2000)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length)
    }, 0)
  }

  const { handleMentionInput, handleKeyDown: handleMentionKey, MentionDropdown } = useMention(members, inputRef, text, setText)

  const sendMessage = async (body, extra = {}) => {
    if (!body || !activeId || !user) return
    if (blockedIds.includes(activeId) || blockedByIds.includes(activeId)) return
    setSending(true)
    clearTimeout(typingStopTimer.current)
    broadcastTyping(false)
    const res = await api(`/rest/v1/messages`, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ from_id: user.id, to_id: activeId, body, read: false, ...extra })
    })
    const inserted = await res.json().catch(() => null)
    const newMsg = Array.isArray(inserted) ? inserted[0] : null
    if (newMsg) {
      setMessages(prev => prev.some(x => x.id === newMsg.id) ? prev : [...prev, newMsg])
    } else {
      // fallback si return=representation indisponible
      const msgs = await api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${activeId}),and(from_id.eq.${activeId},to_id.eq.${user.id}))&order=created_at.asc`)
        .then(r => r.json())
      if (Array.isArray(msgs)) setMessages(msgs)
    }
    await api(`/rest/v1/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: activeId, type: 'message',
        content: `💬 @${profile?.pseudo || "Quelqu'un"} vous a envoyé un message`,
        link: '/messages', read: false
      })
    })
    setSending(false)
    loadConvos()
  }

  const send = async () => {
    if (!text.trim()) return
    await sendMessage(text.trim())
    setText('')
  }

  const uploadPhoto = async (file) => {
    if (!file || !user) return
    const MAX = 5 * 1024 * 1024
    if (file.size > MAX) { alert('Image trop lourde (max 5 Mo)'); return }
    if (!file.type.startsWith('image/')) { alert('Fichier non supporté'); return }
    setUploading(true)
    const token = await getToken()
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/message-photos/${path}`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    })
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(`Erreur : ${err.message || res.status}`); setUploading(false); return }
    await sendMessage(`__IMG__${SUPABASE_URL}/storage/v1/object/public/message-photos/${path}`)
    setUploading(false)
  }

  const handleVoiceSend = async (blob, duration, waveform) => {
    if (!blob || !user || !activeId) return
    setUploading(true)
    try {
      const url = await uploadVoiceMessage(blob, activeId, user.id)
      await sendMessage(url, { type: 'voice', voice_duration: duration, voice_waveform: waveform })
    } catch (err) {
      alert("Erreur lors de l'envoi du message vocal")
    }
    setUploading(false)
  }

  const deleteMessage = async (msgId) => {
    setDeletingMsg(msgId)
    await api(`/rest/v1/messages?id=eq.${msgId}`, { method: 'DELETE' })
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setDeletingMsg(null)
  }

  const deleteConvo = async (otherId) => {
    await api(`/rest/v1/messages?or=(and(from_id.eq.${user.id},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${user.id}))`, { method: 'DELETE' })
    setConvos(prev => prev.filter(c => c.otherId !== otherId))
    if (activeId === otherId) { setActiveId(null); setMessages([]) }
    setConfirmDelete(null)
  }

  const getMember = (id) => members.find(m => m.id === id)
  const activeMember = getMember(activeId)
  const isActiveBlocked = activeId && (blockedIds.includes(activeId) || blockedByIds.includes(activeId))

  const convoMembersWithData = convos
    .map(c => ({ convo: c, member: getMember(c.otherId) }))
    .filter(x => x.member)

  const openConvo = (id) => { setActiveId(id); if (isMobile) setShowSidebar(false) }

  if (!user) return null

  return (
    <div ref={containerRef} style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '0' : '20px 28px' }}>
      {!isMobile && <h2 style={{ fontWeight: 700, fontSize: 20, color: C.text, marginBottom: 16 }}>Messages privés</h2>}

      {/* ── MODALE SIGNALEMENT ── */}
      {reporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🚩</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 6 }}>Signaler ce message ?</div>
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 20 }}>
              Ce message sera transmis aux modérateurs pour examen.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setReporting(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={async () => {
                await api('/rest/v1/reports', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'message', target_id: reporting.id, reporter_id: user.id, reason: 'Message privé signalé', status: 'pending' })
                })
                setReporting(null)
              }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#e67e22', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Signaler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE CONFIRMATION SUPPRESSION ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 6 }}>
              {confirmDelete.type === 'convo' ? 'Supprimer la conversation ?' : 'Supprimer ce message ?'}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 20 }}>
              {confirmDelete.type === 'convo'
                ? 'Tous les messages seront supprimés définitivement.'
                : 'Ce message sera supprimé définitivement.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={() => {
                if (confirmDelete.type === 'convo') deleteConvo(confirmDelete.id)
                else { deleteMessage(confirmDelete.id); setConfirmDelete(null) }
              }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.red, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        background: C.white,
        border: isMobile ? 'none' : `1px solid ${C.border}`,
        borderRadius: isMobile ? 0 : 16,
        overflow: 'hidden',
        height: isMobile ? 'calc(100dvh - 64px)' : 600,
        boxShadow: isMobile ? 'none' : '0 2px 12px rgba(0,0,0,.06)',
        overscrollBehavior: 'contain',
      }}>

        {/* ── SIDEBAR ── */}
        {(!isMobile || showSidebar) && (
          <div style={{ width: isMobile ? '100%' : 360, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>💬 Conversations</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textDim, fontSize: 14 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un membre…"
                  style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid var(--borderMid)', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'var(--surfaceB)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {(() => {
                const displayList = search
                  ? members.filter(m => m.pseudo?.toLowerCase().includes(search.toLowerCase()))
                      .map(m => ({ member: m, convo: convos.find(c => c.otherId === m.id) }))
                  : convoMembersWithData

                return displayList.length > 0 ? (
                  <div style={{ padding: '8px 0' }}>
                    {displayList.map(({ member: m, convo }) => {
                      const last = convo?.messages?.[0]
                      const unread = convo?.unread || 0
                      const blocked = blockedIds.includes(m.id)
                      const lastPreview = last?.body?.startsWith('__IMG__') ? '📷 Photo' : last?.type === 'voice' ? '🎤 Message vocal' : last?.body
                      const isActive = activeId === m.id
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'stretch', borderLeft: isActive ? `3px solid ${C.accentDk}` : '3px solid transparent', borderBottom: `1px solid ${C.border}`, opacity: blocked ? 0.5 : 1, background: isActive ? 'rgba(200,162,0,0.15)' : 'transparent', transition: 'background .15s' }}>
                          <div onClick={() => openConvo(m.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', cursor: 'pointer' }}>
                            <Avatar member={m} size={38} showOnline />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 1 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{m.pseudo}</span>
                                {unread > 0 && !blocked && <span style={{ background: C.red, color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>{unread}</span>}
                              </div>
                              {blocked
                                ? <div style={{ fontSize: 11, color: C.red, fontStyle: 'italic' }}>🚫 Bloqué</div>
                                : last && <div style={{ fontSize: 12, color: unread > 0 ? C.text : C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread > 0 ? 600 : 400 }}>{last.from_id === user.id ? 'Vous : ' : ''}{lastPreview}</div>
                              }
                              {last && <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{formatTime(last.created_at)}</div>}
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setReporting({ id: m.id, pseudo: m.pseudo }) }}
                            title="Signaler"
                            style={{ width: 36, flexShrink: 0, background: 'none', border: 'none', borderLeft: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 15, color: '#e67e22', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(230,126,34,.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >🚩</button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'convo', id: m.id }) }}
                            title="Supprimer"
                            style={{ width: 36, flexShrink: 0, background: 'none', border: 'none', borderLeft: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 15, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(231,76,60,.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >🗑</button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 12 }}>{search ? 'Aucun membre trouvé' : 'Aucune conversation'}</div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── ZONE CHAT ── */}
        {(!isMobile || !showSidebar) && (
          activeMember ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {isMobile && <button onClick={() => setShowSidebar(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.textMid, padding: 0, marginRight: 4 }}>←</button>}
                <Avatar member={activeMember} size={40} showOnline />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>@{activeMember.pseudo}</div>
                  <div style={{ fontSize: 11, color: otherTyping ? '#c8a200' : activeMember.online ? C.online : C.textDim, fontStyle: otherTyping ? 'italic' : 'normal' }}>
                    {otherTyping ? 'est en train d\u2019écrire…' : activeMember.online ? '● En ligne' : '○ Hors ligne'}
                  </div>
                </div>
                <RoleBadge role={activeMember.role} />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: C.surfaceB, minHeight: 0 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13, marginTop: 60 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                    Début de la conversation avec @{activeMember.pseudo}
                  </div>
                )}
                {messages.map((m, i) => {
                  const isMe = m.from_id === user.id
                  const isImg = m.body?.startsWith('__IMG__')
                  const isVoice = m.type === 'voice'
                  const showAvatar = !isMe && (i === 0 || messages[i - 1]?.from_id !== m.from_id)
                  const isDeleting = deletingMsg === m.id
                  const reactions = m.reactions || {}
                  const hasReactions = Object.keys(reactions).length > 0
                  const pickerOpen = reactionPicker === m.id
                  const hovered = hoveredMsg === m.id
                  return (
                    <div key={m.id ?? i}
                      onMouseEnter={() => setHoveredMsg(m.id)}
                      onMouseLeave={() => setHoveredMsg(null)}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2,
                        maxWidth: '100%',
                        animation: `${isMe ? 'msgInMe' : 'msgInOther'} .28s cubic-bezier(.34,1.56,.64,1) both`,
                      }}>

                      {/* Picker réactions — au-dessus de la bulle */}
                      {pickerOpen && (
                        <div style={{ display: 'flex', gap: 4, background: C.white, border: `1px solid ${C.border}`, borderRadius: 24, padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,.15)', alignSelf: isMe ? 'flex-end' : 'flex-start', marginBottom: 2, transformOrigin: isMe ? 'right center' : 'left center', animation: 'reactionPickerIn .22s cubic-bezier(.34,1.56,.64,1) both', overflow: 'hidden' }}>
                          {QUICK_EMOJIS.map((emoji, ei) => (
                            <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                              style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', lineHeight: 1, animation: `reactionEmojiIn .2s cubic-bezier(.34,1.56,.64,1) ${ei * 30}ms both` }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.35)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                              {emoji}
                            </button>
                          ))}
                          {/* Sur mobile il n'y a pas de "survol" : on rattache supprimer/signaler
                              au même long-press que le picker de réactions. */}
                          {isMobile && isMe && (
                            <button onClick={() => { setReactionPicker(null); setConfirmDelete({ type: 'msg', id: m.id }) }}
                              style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: '0 3px', lineHeight: 1, animation: `reactionEmojiIn .2s cubic-bezier(.34,1.56,.64,1) ${QUICK_EMOJIS.length * 30}ms both` }}>
                              🗑️
                            </button>
                          )}
                          {isMobile && !isMe && (
                            <button onClick={async () => {
                              setReactionPicker(null)
                              await api('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ type: 'message', target_id: m.id, reporter_id: user.id, reason: 'Message privé signalé', status: 'pending' }) })
                              alert('Message signalé aux modérateurs.')
                            }}
                              style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: '0 3px', lineHeight: 1, animation: `reactionEmojiIn .2s cubic-bezier(.34,1.56,.64,1) ${QUICK_EMOJIS.length * 30}ms both` }}>
                              🚩
                            </button>
                          )}
                          <button onClick={() => setReactionPicker(null)}
                            style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: '0 3px', lineHeight: 1, animation: `reactionEmojiIn .2s ease ${(QUICK_EMOJIS.length + 1) * 30}ms both` }}>✕</button>
                        </div>
                      )}

                      {/* Ligne avatar + bulle */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '100%', minWidth: 0 }}>
                        {!isMe && <div style={{ width: 28, flexShrink: 0 }}>{showAvatar && <Avatar member={activeMember} size={28} />}</div>}

                        {/* Bulle message — maxWidth en % de la ligne (qui elle-même est bornée par le conteneur),
                            pas en vw : ça évite tout débordement de l'écran quand on ajoute le padding + l'avatar. */}
                        <div
                          onDoubleClick={() => !isMobile && setReactionPicker(pickerOpen ? null : m.id)}
                          onTouchStart={() => isMobile && handleLongPressStart(m.id)}
                          onTouchEnd={handleLongPressEnd}
                          onTouchMove={handleLongPressEnd}
                          onContextMenu={e => e.preventDefault()}
                          style={{
                            maxWidth: isMobile ? '78%' : '60%',
                            minWidth: 0,
                            background: isImg ? 'transparent' : isMe ? 'linear-gradient(135deg,#f0c800,#c8a200)' : C.white,
                            border: isImg ? 'none' : isMe ? 'none' : `1px solid ${C.border}`,
                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            padding: isImg ? 0 : '10px 14px',
                            boxShadow: isImg ? 'none' : '0 1px 3px rgba(0,0,0,.08)',
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: isMobile ? 'none' : 'auto',
                            userSelect: isMobile ? 'none' : 'auto',
                          }}>
                          {isVoice ? (
                            <VoiceMessagePlayer url={m.body} duration={m.voice_duration} waveform={m.voice_waveform} isMe={isMe} />
                          ) : (
                            <MessageBody body={m.body} isMe={isMe} />
                          )}
                        </div>

                        {/* Actions au hover — ne prennent pas de place si cachées */}
                        {hovered && !isMobile && (
                          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                            <button onClick={() => setReactionPicker(pickerOpen ? null : m.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: 0.5, padding: '2px', lineHeight: 1, transition: 'opacity .15s' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                              😊
                            </button>
                            {isMe && (
                              <button onClick={() => setConfirmDelete({ type: 'msg', id: m.id })} disabled={isDeleting}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.red, opacity: 0.5, padding: '2px', lineHeight: 1, transition: 'opacity .15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                                {isDeleting ? '…' : '🗑'}
                              </button>
                            )}
                            {!isMe && (
                              <button onClick={async () => {
                                await api('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ type: 'message', target_id: m.id, reporter_id: user.id, reason: 'Message privé signalé', status: 'pending' }) })
                                alert('Message signalé aux modérateurs.')
                              }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textDim, opacity: 0.5, padding: '2px', lineHeight: 1, transition: 'opacity .15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                                🚩
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Réactions existantes */}
                      {hasReactions && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                          {Object.entries(reactions).map(([emoji, likers]) => {
                            const iLiked = likers.includes(user.id)
                            return (
                              <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, border: `1px solid ${iLiked ? 'rgba(200,162,0,.6)' : C.border}`, background: iLiked ? 'rgba(200,162,0,.12)' : C.white, cursor: 'pointer', fontSize: 13, fontWeight: iLiked ? 700 : 400, transition: 'all .15s', fontFamily: 'inherit' }}>
                                <span>{emoji}</span>
                                <span style={{ fontSize: 11, color: iLiked ? C.accentTxt : C.textMid }}>{likers.length}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Heure */}
                      <div style={{ fontSize: 10, color: C.textDim, alignSelf: isMe ? 'flex-end' : 'flex-start', paddingLeft: isMe ? 0 : 36 }}>
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}

                {/* Indicateur "en train d'écrire" en bas de la conversation */}
                {otherTyping && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '100%' }}>
                    <Avatar member={activeMember} size={28} />
                    <TypingBubble isMobile={isMobile} />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {isActiveBlocked ? (
                <div style={{ padding: '16px', borderTop: `1px solid ${C.border}`, background: C.white, textAlign: 'center', fontSize: 12, color: C.red, flexShrink: 0 }}>
                  🚫 {blockedIds.includes(activeId) ? 'Vous avez bloqué ce membre.' : 'Ce membre vous a bloqué.'} Impossible d'envoyer un message.
                </div>
              ) : (
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.white, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />

                  {/* Bouton photo */}
                  {!voiceRecording && (
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Envoyer une photo"
                      style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${C.borderMid}`, background: C.surfaceB, cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#c8a200'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMid}>
                      {uploading ? '⏳' : '📎'}
                    </button>
                  )}

                  {/* Bouton emoji */}
                  {!voiceRecording && (
                    <div ref={emojiRef} style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setShowEmoji(s => !s)} title="Emojis"
                        style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${showEmoji ? '#c8a200' : C.borderMid}`, background: showEmoji ? '#fffae6' : C.surfaceB, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#c8a200'}
                        onMouseLeave={e => { if (!showEmoji) e.currentTarget.style.borderColor = C.borderMid }}>
                        😊
                      </button>
                      {showEmoji && (
                        <div style={{ position: 'fixed', bottom: 80, right: 20, zIndex: 1000 }}>
                          <EmojiPicker onEmojiClick={insertEmoji} width={400} height={550} theme="dark" />
                        </div>
                      )}
                    </div>
                  )}

                  {!voiceRecording && (
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      <MentionDropdown />
                      <input ref={inputRef} value={text} onChange={e => onTextChange(e.target.value, e.target.selectionStart)} onKeyDown={e => { handleMentionKey(e); if (e.key === 'Enter' && !e.defaultPrevented) send() }}
                        placeholder={`Message à @${activeMember.pseudo}…`}
                        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.borderMid}`, borderRadius: 24, padding: '10px 18px', fontSize: 13, color: C.text, fontFamily: 'inherit', outline: 'none', background: C.surfaceB }}
                        onFocus={e => e.target.style.borderColor = '#c8a200'}
                        onBlur={e => e.target.style.borderColor = C.borderMid} />
                    </div>
                  )}

                  {/* Bouton / barre message vocal */}
                  <VoiceRecorder onSend={handleVoiceSend} onRecordingChange={setVoiceRecording} />

                  {!voiceRecording && (
                    <button onClick={send} disabled={sending || !text.trim()}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: text.trim() ? 'linear-gradient(135deg,#f0c800,#c8a200)' : '#e0e0e0', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, transition: 'transform .12s ease' }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(.9)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                      {sending ? '…' : '➤'}
                    </button>
                  )}
                </div>
              )}
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