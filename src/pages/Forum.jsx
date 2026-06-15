import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { C, CATS, ROLE_RING } from '../lib/constants'
import { RoleBadge, Btn, Input } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import EmojiPicker from 'emoji-picker-react'
import { awardXP } from '../lib/xp'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY
const PAGE_SIZE    = 15

function api(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

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

async function apiAuth(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

async function sendNotif(userId, type, content, link) {
  try {
    await apiAuth('/rest/v1/notifications', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, type, content, link, read: false })
    })
  } catch {}
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR')
}

const isNew = (ts) => ts && (Date.now() - new Date(ts)) < 86400000

const CAT_COLORS = {
  'Musique': '#9b59b6', 'Culture': '#3498db', 'Voyages': '#2ecc71',
  'Lifestyle': '#e67e22', 'Rencontres': '#e91e63', 'Divers': '#95a5a6',
  '+18': '#e74c3c', 'Tous': C?.accentDk || '#c8a200'
}

function RichText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return (
    <span>
      {lines.map((line, i) => {
        if (line.startsWith('> ')) return (
          <span key={i}>
            <span style={{ display: 'block', borderLeft: `3px solid ${C.accentDk}`, paddingLeft: 10, margin: '4px 0', color: C.textDim, fontSize: 12, fontStyle: 'italic', background: 'rgba(200,162,0,.07)', borderRadius: '0 6px 6px 0', padding: '4px 10px' }}>
              {line.slice(2)}
            </span>
          </span>
        )
        const parts = line.split(urlRegex)
        return (
          <span key={i}>
            {parts.map((part, j) =>
              urlRegex.test(part)
                ? <a key={j} href={part} target="_blank" rel="noopener noreferrer" style={{ color: C.accentTxt, textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
                : <span key={j}>{part}</span>
            )}
            {i < lines.length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

function RichInput({ value, onChange, placeholder, rows = 3 }) {
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef()
  const emojiRef    = useRef()
  useEffect(() => {
    const handler = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const insertEmoji = (emojiData) => {
    const el = textareaRef.current
    const start = el.selectionStart; const end = el.selectionEnd
    const newVal = value.slice(0, start) + emojiData.emoji + value.slice(end)
    onChange({ target: { value: newVal } })
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length) }, 0)
  }
  return (
    <div style={{ position: 'relative' }}>
      <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        style={{ width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 10, padding: '10px 44px 10px 14px', fontSize: 13, color: C.text, background: C.surfaceB, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', transition: 'border .2s', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = '#c8a200'}
        onBlur={e => e.target.style.borderColor = C.borderMid}
      />
      <button type="button" onClick={() => setShowEmoji(s => !s)} style={{ position: 'absolute', bottom: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: .6 }}>😊</button>
      {showEmoji && (
        <div ref={emojiRef} style={{ position: 'absolute', bottom: '110%', right: 0, zIndex: 1000 }}>
          <EmojiPicker onEmojiClick={insertEmoji} width={300} height={350} theme="dark" />
        </div>
      )}
    </div>
  )
}

function Avatar({ member, size = 36, onClick }) {
  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const color = colors[(member?.pseudo?.charCodeAt(0) || 0) % colors.length]
  const ring = ROLE_RING[member?.role] || null
  return (
    <div onClick={onClick} style={{ position: 'relative', flexShrink: 0, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: member?.avatar_url ? '#444' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .32, fontWeight: 700, color: '#fff', overflow: 'hidden', border: ring ? `3px solid ${ring}` : '2px solid rgba(255,255,255,.3)', boxShadow: ring ? `0 0 8px ${ring}88` : 'none' }}>
        {member?.avatar_url ? <img loading="lazy" decoding="async" src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : member?.initials || '??'}
      </div>
    </div>
  )
}

function extractMentions(text) {
  const matches = text.match(/@(\w+)/g)
  if (!matches) return []
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
}

const REACTIONS = ['👍','❤️','😂','😮','😢','🔥']

function ReportModal({ type, targetId, reporterId, onClose }) {
  const [reason, setReason] = useState('')
  const [sent,   setSent]   = useState(false)
  const REASONS = ['Contenu inapproprié', 'Spam ou pub', 'Harcèlement', 'Contenu haineux', 'Fausses informations', 'Autre']
  const submit = async () => {
    if (!reason) return
    await apiAuth('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ type, target_id: targetId, reporter_id: reporterId, reason, status: 'pending' }) })
    setSent(true); setTimeout(onClose, 1500)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Signalement envoyé</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Merci, nos modérateurs vont examiner ça.</div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>🚩 Signaler ce contenu</div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Sélectionne la raison du signalement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${reason === r ? C.accentDk : C.border}`, background: reason === r ? '#fffae6' : C.surfaceB, color: reason === r ? C.accentTxt : C.text, fontSize: 13, fontWeight: reason === r ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Annuler</Btn>
              <Btn onClick={submit} variant="yellow" style={{ flex: 1 }} disabled={!reason}>Envoyer</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ForumPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { threadId } = useParams()
  const containerRef = useRef()
  const repliesEndRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members,       setMembers]      = useState([])
  const [threads,       setThreads]      = useState([])
  const [replies,       setReplies]      = useState([])
  const [replyCounts,   setReplyCounts]  = useState({})
  const [cat,           setCat]          = useState('Tous')
  const [sortBy,        setSortBy]       = useState('recent')
  const [searchQuery,   setSearchQuery]  = useState('')
  const [openId,        setOpenId]       = useState(null)
  const [composing,     setComposing]    = useState(false)
  const [nTitle,        setNTitle]       = useState('')
  const [nBody,         setNBody]        = useState('')
  const [nCat,          setNCat]         = useState('Divers')
  const [replyText,     setReplyText]    = useState('')
  const [posting,       setPosting]      = useState(false)
  const [likes,         setLikes]        = useState({})
  const [editingThread, setEditingThread] = useState(null)
  const [editingReply,  setEditingReply]  = useState(null)
  const [quoting,       setQuoting]       = useState(null)
  const [reactions,     setReactions]     = useState({})
  const [myReactions,   setMyReactions]   = useState({})
  const [showReactionPicker, setShowReactionPicker] = useState(null)
  const [page,          setPage]          = useState(1)
  const [reporting,     setReporting]     = useState(null)
  const [confirmDel,    setConfirmDel]    = useState(null)
  const [spamError,     setSpamError]     = useState('')
  const lastPostTime = useRef(0)

  const myRole = profile?.role || 'membre'
  const isAdmin = myRole === 'admin'
  const ROLES_RANK = { admin: 4, manager: 3, moderateur: 2, animateur: 1, membre: 0 }
  const myRank = ROLES_RANK[myRole] || 0
  const canMod = myRank >= 2

  // Vérifie si on peut agir sur un contenu selon le rôle de son auteur
  // Seul un admin peut toucher au contenu d'un autre admin
  const canActOn = (authorId) => {
    const author = members.find(m => m.id === authorId)
    const authorRole = author?.role || 'membre'
    if (authorRole === 'admin' && !isAdmin) return false
    return true
  }

  const isBanned = profile?.banned && (!profile.banned_until || new Date(profile.banned_until) > new Date())
  const bannedMsg = isBanned
    ? profile.banned_until
      ? `Tu es banni jusqu'au ${new Date(profile.banned_until).toLocaleDateString('fr-FR')} à ${new Date(profile.banned_until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`
      : 'Tu es banni définitivement.'
    : null
  const userAge = profile?.age ? parseInt(profile.age) : null
  const isAdult = userAge !== null && userAge >= 18
  const getMember = (id) => members.find(m => m.id === id)
  const visibleCats = CATS.filter(c => c !== '+18' || isAdult || canMod)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setIsMobile(entry.contentRect.width < 600)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    api('/rest/v1/profiles?select=*').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
    loadThreads()
  }, [])

  useEffect(() => {
    if (!threadId || threads.length === 0) return
    const t = threads.find(th => String(th.id) === String(threadId))
    if (t && openId !== t.id) openThread(t)
  }, [threadId, threads])

  useEffect(() => { setPage(1) }, [cat, sortBy, searchQuery])

  const loadThreads = async () => {
    const r = await api('/rest/v1/threads?select=*&order=pinned.desc,created_at.desc')
    const d = await r.json()
    if (!Array.isArray(d)) return
    setThreads(d)
    const counts = {}
    await Promise.all(d.map(async t => {
      const cr = await api(`/rest/v1/replies?thread_id=eq.${t.id}&select=id`)
      const cd = await cr.json()
      counts[t.id] = Array.isArray(cd) ? cd.length : 0
    }))
    setReplyCounts(counts)
  }

  const loadReplies = (threadId) => {
    api(`/rest/v1/replies?thread_id=eq.${threadId}&order=created_at.asc`).then(r => r.json()).then(d => { if (Array.isArray(d)) setReplies(d) })
  }

  const openThread = (t) => {
    if (t.cat === '+18' && !isAdult && !canMod) return
    setOpenId(t.id); loadReplies(t.id)
    apiAuth(`/rest/v1/threads?id=eq.${t.id}`, { method: 'PATCH', body: JSON.stringify({ views: (t.views || 0) + 1 }) })
    setThreads(prev => prev.map(th => th.id === t.id ? { ...th, views: (th.views || 0) + 1 } : th))
  }

  const closeThread = () => {
    setOpenId(null); setReplies([]); setEditingThread(null); setEditingReply(null)
    navigate('/forum', { replace: true })
  }

  const postThread = async () => {
    if (!nTitle.trim() || !nBody.trim() || !user) return
    if (isBanned) { setSpamError(bannedMsg); return }
    if (nCat === '+18' && !isAdult && !canMod) return
    const now = Date.now()
    if (now - lastPostTime.current < 30000) { setSpamError(`Attends encore ${Math.ceil((30000 - (now - lastPostTime.current)) / 1000)}s avant de poster.`); return }
    setSpamError(''); setPosting(true); lastPostTime.current = now
    await apiAuth('/rest/v1/threads', { method: 'POST', body: JSON.stringify({ author_id: user.id, cat: nCat, title: nTitle.trim(), body: nBody.trim(), likes: 0, views: 0, pinned: false, locked: false, hidden: false }) })
    await awardXP(user.id, 10)
    setNTitle(''); setNBody(''); setComposing(false); loadThreads(); setPosting(false)
  }

  const postReply = async () => {
    if (!replyText.trim() || !openId || !user) return
    if (isBanned) { setSpamError(bannedMsg); return }
    const now = Date.now()
    if (now - lastPostTime.current < 30000) { setSpamError(`Attends encore ${Math.ceil((30000 - (now - lastPostTime.current)) / 1000)}s avant de poster.`); return }
    setSpamError(''); setPosting(true); lastPostTime.current = now
    const body = quoting
      ? `> @${quoting.pseudo} : ${quoting.body.slice(0, 100)}${quoting.body.length > 100 ? '…' : ''}\n\n${replyText.trim()}`
      : replyText.trim()
    await apiAuth('/rest/v1/replies', { method: 'POST', body: JSON.stringify({ thread_id: openId, author_id: user.id, body, hidden: false }) })
    await awardXP(user.id, 5)
    const currentThread = threads.find(t => t.id === openId)
    if (currentThread && currentThread.author_id !== user.id) {
      await sendNotif(currentThread.author_id, 'reply', `💬 @${profile?.pseudo || 'Quelqu\'un'} a répondu à votre topic "${currentThread.title.slice(0, 50)}"`, `/forum/${openId}`)
    }
    const mentions = extractMentions(replyText)
    for (const m of members.filter(m => mentions.includes(m.pseudo?.toLowerCase()) && m.id !== user.id)) {
      await sendNotif(m.id, 'mention', `🔔 @${profile?.pseudo || 'Quelqu\'un'} vous a mentionné`, `/forum/${openId}`)
    }
    setReplyText(''); setQuoting(null); loadReplies(openId)
    setReplyCounts(prev => ({ ...prev, [openId]: (prev[openId] || 0) + 1 }))
    setPosting(false)
    setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }

  const patchThread = async (id, body) => {
    await apiAuth(`/rest/v1/threads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    loadThreads()
  }

  const toggleLike = async (thread) => {
    if (!user || isBanned) return
    const liked = likes[thread.id]
    const newCount = thread.likes + (liked ? -1 : 1)
    setLikes(l => ({ ...l, [thread.id]: !liked }))
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, likes: newCount } : t))
    await apiAuth(`/rest/v1/threads?id=eq.${thread.id}`, { method: 'PATCH', body: JSON.stringify({ likes: newCount }) })
    if (!liked && thread.author_id !== user?.id) {
      await sendNotif(thread.author_id, 'like', `♥ @${profile?.pseudo || 'Quelqu\'un'} a aimé votre topic "${thread.title.slice(0, 50)}"`, `/forum/${thread.id}`)
    }
  }

  const toggleReaction = (replyId, emoji) => {
    const current = myReactions[replyId]
    const newMyReactions = { ...myReactions }
    const newReactions = { ...reactions, [replyId]: { ...(reactions[replyId] || {}) } }
    if (current === emoji) { delete newMyReactions[replyId]; newReactions[replyId][emoji] = Math.max(0, (newReactions[replyId][emoji] || 1) - 1) }
    else { if (current) newReactions[replyId][current] = Math.max(0, (newReactions[replyId][current] || 1) - 1); newMyReactions[replyId] = emoji; newReactions[replyId][emoji] = (newReactions[replyId][emoji] || 0) + 1 }
    setMyReactions(newMyReactions); setReactions(newReactions); setShowReactionPicker(null)
  }

  const updateThread = async (id, title, body) => {
    await apiAuth(`/rest/v1/threads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ title, body, edited_at: new Date().toISOString() }) })
    loadThreads()
  }

  const updateReply = async (id, body) => {
    await apiAuth(`/rest/v1/replies?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ body, edited_at: new Date().toISOString() }) })
    loadReplies(openId)
  }

  const doDeleteThread = async (id) => {
    await apiAuth(`/rest/v1/replies?thread_id=eq.${id}`, { method: 'DELETE' })
    await apiAuth(`/rest/v1/threads?id=eq.${id}`, { method: 'DELETE' })
    closeThread(); loadThreads(); setConfirmDel(null)
  }

  const doDeleteReply = async (id) => {
    await apiAuth(`/rest/v1/replies?id=eq.${id}`, { method: 'DELETE' })
    loadReplies(openId); setConfirmDel(null)
  }

  const currentThread = threads.find(t => t.id === openId)
  const visReplies = replies.filter(r => !r.hidden || canMod)

  let filtered = (cat === 'Tous' ? threads : threads.filter(t => t.cat === cat))
    .filter(t => !t.hidden || canMod)
    .filter(t => t.cat !== '+18' || isAdult || canMod)
  if (searchQuery.trim()) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.body.toLowerCase().includes(searchQuery.toLowerCase()))
  if (sortBy === 'popular') filtered = [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0))
  else if (sortBy === 'unanswered') filtered = filtered.filter(t => !replyCounts[t.id])
  else filtered = [...filtered].sort((a, b) => b.pinned - a.pinned || new Date(b.created_at) - new Date(a.created_at))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const topAuthors = [...members]
    .filter(m => threads.some(t => t.author_id === m.id))
    .sort((a, b) => threads.filter(t => t.author_id === b.id).length - threads.filter(t => t.author_id === a.id).length)
    .slice(0, 5)

  // ModBar : actions de modération sur un thread
  // pinned/locked/hidden : canMod suffit SI l'auteur n'est pas admin (ou si on est admin)
  // suppression : idem
  const ModBar = ({ thread }) => {
    const threadAuthorIsAdmin = getMember(thread.author_id)?.role === 'admin'
    const canActOnThread = !threadAuthorIsAdmin || isAdmin
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px', background: C.accentBg, border: `1px solid ${C.accentDk}`, borderRadius: 10, marginTop: 10 }}>
        <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700, alignSelf: 'center' }}>🛡 Modération :</span>
        <Btn onClick={() => patchThread(thread.id, { pinned: !thread.pinned })} variant={thread.pinned ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.pinned ? '📌 Désépingler' : '📌 Épingler'}</Btn>
        <Btn onClick={() => patchThread(thread.id, { locked: !thread.locked })} variant={thread.locked ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</Btn>
        {canActOnThread && (
          <>
            <Btn onClick={() => patchThread(thread.id, { hidden: !thread.hidden })} variant={thread.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>{thread.hidden ? '👁 Restaurer' : '🙈 Masquer'}</Btn>
            <Btn onClick={() => setConfirmDel({ type: 'thread', id: thread.id })} variant="red" style={{ fontSize: 10 }}>🗑 Supprimer</Btn>
          </>
        )}
      </div>
    )
  }

  const ConfirmModal = confirmDel ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 6 }}>
          {confirmDel.type === 'thread' ? 'Supprimer ce topic ?' : 'Supprimer cette réponse ?'}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', marginBottom: 20 }}>Cette action est définitive.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surfaceB, color: C.textMid, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={() => confirmDel.type === 'thread' ? doDeleteThread(confirmDel.id) : doDeleteReply(confirmDel.id)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.red, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
        </div>
      </div>
    </div>
  ) : null

  if (currentThread) {
    const author = getMember(currentThread.author_id)
    const catColor = CAT_COLORS[currentThread.cat] || C.accentDk
    return (
      <div ref={containerRef} style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '12px' : '20px 28px' }}>
        {reporting && <ReportModal type={reporting.type} targetId={reporting.targetId} reporterId={user?.id} onClose={() => setReporting(null)} />}
        {ConfirmModal}

        <button onClick={closeThread}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Retour au forum
        </button>

        {currentThread.hidden && <div style={{ background: '#ffe0e0', border: '1px solid #c0392b', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: C.red, fontWeight: 600 }}>🗑 Discussion masquée</div>}

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${catColor}`, borderRadius: 16, padding: isMobile ? '14px' : '20px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <Avatar member={author} size={isMobile ? 36 : 48} onClick={() => author?.id && navigate(`/members/${author.id}`)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <strong onClick={() => author?.id && navigate(`/members/${author.id}`)} style={{ fontSize: 14, color: C.text, cursor: 'pointer' }}>@{author?.pseudo || 'Inconnu'}</strong>
                <RoleBadge role={author?.role || 'membre'} />
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: catColor + '22', color: catColor, border: `1px solid ${catColor}44` }}>{currentThread.cat === '+18' ? '🔞 +18' : currentThread.cat}</span>
                {currentThread.pinned && <span style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>📌</span>}
                {currentThread.locked && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>🔒</span>}
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(currentThread.created_at)}</span>
                {currentThread.edited_at && <span style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>✏️ modifié</span>}
              </div>
              {editingThread ? (
                <div>
                  <Input value={editingThread.title} onChange={e => setEditingThread(v => ({ ...v, title: e.target.value }))} placeholder="Titre…" style={{ width: '100%', marginBottom: 10, borderRadius: 10, padding: '10px 14px' }} />
                  <RichInput value={editingThread.body} onChange={e => setEditingThread(v => ({ ...v, body: e.target.value }))} rows={4} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <Btn onClick={() => setEditingThread(null)} variant="ghost">Annuler</Btn>
                    <Btn onClick={async () => { await updateThread(currentThread.id, editingThread.title, editingThread.body); setEditingThread(null) }} variant="yellow">Sauvegarder</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <h2 style={{ fontSize: isMobile ? 16 : 19, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 12 }}>{currentThread.title}</h2>
                  <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}><RichText text={currentThread.body} /></p>
                </>
              )}
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => toggleLike(currentThread)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: likes[currentThread.id] ? C.accentBg : C.surfaceB, border: `1px solid ${likes[currentThread.id] ? C.accentDk : C.border}`, color: likes[currentThread.id] ? C.accentTxt : C.textMid, borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}>
                  ♥ {currentThread.likes} J'aime
                </button>
                <span style={{ fontSize: 11, color: C.textDim }}>👁 {currentThread.views || 0} vues</span>
                <span style={{ fontSize: 11, color: C.textDim }}>↩ {replyCounts[currentThread.id] || visReplies.length} réponses</span>
                {user && user.id !== currentThread.author_id && !currentThread.locked && (
                  <Btn onClick={() => { setQuoting({ pseudo: author?.pseudo || 'Inconnu', body: currentThread.body, authorId: currentThread.author_id }); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100) }} variant="ghost" style={{ fontSize: 11 }}>💬 Citer</Btn>
                )}
                {user && user.id !== currentThread.author_id && (
                  <Btn onClick={() => setReporting({ type: 'thread', targetId: currentThread.id })} variant="ghost" style={{ fontSize: 11, color: C.red }}>🚩 Signaler</Btn>
                )}
                {user?.id === currentThread.author_id && !editingThread && (
                  <Btn onClick={() => setEditingThread({ title: currentThread.title, body: currentThread.body })} variant="ghost" style={{ fontSize: 11 }}>✏️ Modifier</Btn>
                )}
              </div>
              {canMod && <ModBar thread={currentThread} />}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {visReplies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, fontSize: 12, color: C.textDim }}>Aucune réponse — soyez le premier !</div>
          )}
          {visReplies.map((r, idx) => {
            const ru = getMember(r.author_id)
            const isEditingThis = editingReply?.id === r.id
            const rReactions = reactions[r.id] || {}
            const myEmoji = myReactions[r.id]
            const isLast = idx === visReplies.length - 1
            // Un mod/manager ne peut pas agir sur les replies d'un admin
            const canActOnReply = canActOn(r.author_id)
            return (
              <div key={r.id} ref={isLast ? repliesEndRef : null} style={{ background: r.hidden ? '#fff8f8' : C.white, border: `1px solid ${r.hidden ? '#f5c0c0' : C.border}`, borderRadius: 14, padding: isMobile ? '12px' : '14px 16px', display: 'flex', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
                <Avatar member={ru} size={34} onClick={() => ru?.id && navigate(`/members/${ru.id}`)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <strong onClick={() => ru?.id && navigate(`/members/${ru.id}`)} style={{ fontSize: 12, color: C.text, cursor: 'pointer' }}>@{ru?.pseudo || 'Inconnu'}</strong>
                    {ru?.is_bot && <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: '#5865f2', color: '#fff' }}>BOT</span>}
                    <RoleBadge role={ru?.role || 'membre'} />
                    <span style={{ fontSize: 11, color: C.textDim }}>{formatDate(r.created_at)}</span>
                    {r.hidden && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑 Masqué</span>}
                    {r.edited_at && <span style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>✏️ modifié</span>}
                  </div>
                  {isEditingThis ? (
                    <div>
                      <RichInput value={editingReply.body} onChange={e => setEditingReply(v => ({ ...v, body: e.target.value }))} rows={3} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <Btn onClick={() => setEditingReply(null)} variant="ghost" style={{ fontSize: 11 }}>Annuler</Btn>
                        <Btn onClick={async () => { await updateReply(r.id, editingReply.body); setEditingReply(null) }} variant="yellow" style={{ fontSize: 11 }}>Sauvegarder</Btn>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}><RichText text={r.body} /></p>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {Object.entries(rReactions).filter(([, count]) => count > 0).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => user && toggleReaction(r.id, emoji)}
                        style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, border: `1px solid ${myEmoji === emoji ? C.accentDk : C.border}`, background: myEmoji === emoji ? '#fffae6' : C.surfaceB, cursor: user ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                        {emoji} {count}
                      </button>
                    ))}
                    {user && !isEditingThis && (
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowReactionPicker(showReactionPicker === r.id ? null : r.id)}
                          style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, border: `1px solid ${C.border}`, background: C.surfaceB, cursor: 'pointer', color: C.textDim, fontFamily: 'inherit' }}>
                          + 😊
                        </button>
                        {showReactionPicker === r.id && (
                          <div style={{ position: 'absolute', bottom: '110%', left: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 8px', display: 'flex', gap: 4, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
                            {REACTIONS.map(emoji => (
                              <button key={emoji} onClick={() => toggleReaction(r.id, emoji)}
                                style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {user && user.id !== r.author_id && !currentThread.locked && !isEditingThis && (
                        <Btn onClick={() => { setQuoting({ pseudo: ru?.pseudo || 'Inconnu', body: r.body, authorId: r.author_id }); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100) }} variant="ghost" style={{ fontSize: 10 }}>💬 Citer</Btn>
                      )}
                      {user && user.id !== r.author_id && !isEditingThis && (
                        <Btn onClick={() => setReporting({ type: 'reply', targetId: r.id })} variant="ghost" style={{ fontSize: 10, color: C.red }}>🚩</Btn>
                      )}
                      {user?.id === r.author_id && !isEditingThis && (
                        <>
                          <Btn onClick={() => setEditingReply({ id: r.id, body: r.body })} variant="ghost" style={{ fontSize: 10 }}>✏️</Btn>
                          <Btn onClick={() => setConfirmDel({ type: 'reply', id: r.id })} variant="red" style={{ fontSize: 10 }}>🗑</Btn>
                        </>
                      )}
                      {canMod && canActOnReply && (
                        <>
                          <Btn onClick={async () => { await apiAuth(`/rest/v1/replies?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ hidden: !r.hidden }) }); loadReplies(openId) }} variant={r.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>{r.hidden ? '👁' : '🙈'}</Btn>
                          <Btn onClick={() => setConfirmDel({ type: 'reply', id: r.id })} variant="red" style={{ fontSize: 10 }}>🗑</Btn>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {user && !currentThread.locked ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '14px' : '16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Votre réponse</div>
            {quoting && (
              <div style={{ background: C.surfaceB, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accentDk}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accentTxt, marginBottom: 3 }}>@{quoting.pseudo}</div>
                  <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quoting.body.slice(0, 120)}</div>
                </div>
                <button onClick={() => setQuoting(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 14 }}>✕</button>
              </div>
            )}
            <RichInput value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Écris ta réponse…" rows={3} />
            {spamError && <div style={{ fontSize: 11, color: C.red, marginTop: 8, fontWeight: 600 }}>⏳ {spamError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Btn onClick={postReply} variant="yellow">{posting ? '…' : 'Publier ma réponse'}</Btn>
            </div>
          </div>
        ) : currentThread.locked ? (
          <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.borderMid}`, borderRadius: 12, fontSize: 12, color: C.red, marginTop: 10 }}>🔒 Discussion verrouillée.</div>
        ) : isBanned ? (
          <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.red}`, borderRadius: 12, fontSize: 12, color: C.red, marginTop: 10 }}>⛔ {bannedMsg}</div>
        ) : (
          <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 12, color: C.textDim, marginTop: 10 }}>Connecte-toi pour répondre.</div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '12px' : '20px 28px' }}>
      {reporting && <ReportModal type={reporting.type} targetId={reporting.targetId} reporterId={user?.id} onClose={() => setReporting(null)} />}

      {/* ── LAYOUT 2 COLONNES sur desktop ── */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: 20,
        alignItems: 'start',
      }}>

      {/* ── COLONNE PRINCIPALE ── */}
      <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22, color: 'var(--text)', marginBottom: 2, letterSpacing: -.3 }}>Forum</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>{filtered.length} discussion{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {user && !isBanned && (
          <button onClick={() => setComposing(v => !v)} style={{ padding: isMobile ? '8px 16px' : '10px 22px', background: 'linear-gradient(135deg,#f0c800,#c8a200)', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#3a2e00', boxShadow: '0 2px 12px rgba(200,162,0,.35)', fontFamily: 'inherit', transition: 'transform .15s, box-shadow .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(200,162,0,.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(200,162,0,.35)' }}>
            + Nouvelle discussion
          </button>
        )}
        {isBanned && (
          <div style={{ fontSize: 12, color: C.red, fontWeight: 600, padding: '8px 14px', background: C.surfaceB, borderRadius: 10, border: `1px solid ${C.red}` }}>⛔ {bannedMsg}</div>
        )}
      </div>

      {composing && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>Nouvelle discussion</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Catégorie</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.filter(c => c !== 'Tous' && (c !== '+18' || isAdult || canMod)).map(c => {
                const cc = CAT_COLORS[c] || C.accentDk
                return (
                  <button key={c} onClick={() => setNCat(c)} style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', background: nCat === c ? cc + '22' : C.surfaceB, border: `1px solid ${nCat === c ? cc : C.border}`, color: nCat === c ? cc : C.textMid, fontSize: 12, fontFamily: 'inherit', fontWeight: nCat === c ? 700 : 400, transition: 'all .15s' }}>
                    {c === '+18' ? '🔞 +18' : c}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>Titre</div>
          <Input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="Titre de ta discussion…" style={{ width: '100%', marginBottom: 14, borderRadius: 10, padding: '10px 14px' }} />
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>Message</div>
          <RichInput value={nBody} onChange={e => setNBody(e.target.value)} placeholder="Développe ta discussion…" rows={4} />
          {spamError && <div style={{ fontSize: 11, color: C.red, marginTop: 8, fontWeight: 600 }}>⏳ {spamError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setComposing(false)} variant="ghost">Annuler</Btn>
            <Btn onClick={postThread} variant="yellow">{posting ? '…' : 'Publier'}</Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Rechercher dans le forum…"
            style={{ width: '100%', padding: '9px 16px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surfaceB)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s' }}
            onFocus={e => { e.target.style.borderColor = 'var(--accentDk)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,162,0,.12)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ key: 'recent', label: '🕐 Récents' }, { key: 'popular', label: '🔥 Populaires' }, { key: 'unanswered', label: '💬 Sans réponse' }].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${sortBy === s.key ? C.accentDk : C.border}`, background: sortBy === s.key ? C.accentBg : C.surfaceB, color: sortBy === s.key ? C.accentTxt : C.textMid, fontSize: 11, fontWeight: sortBy === s.key ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {visibleCats.map(c => {
          const cc = CAT_COLORS[c] || C.accentDk
          return (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', background: cat === c ? cc + '22' : C.surfaceB, border: `1px solid ${cat === c ? cc : C.border}`, color: cat === c ? cc : C.textMid, fontSize: 12, fontFamily: 'inherit', fontWeight: cat === c ? 700 : 400, transition: 'all .15s' }}>
              {c === '+18' ? '🔞 +18' : c}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paginated.map(t => {
          const author = getMember(t.author_id)
          const catColor = CAT_COLORS[t.cat] || C.accentDk
          const replyCount = replyCounts[t.id] || 0
          const novel = isNew(t.created_at)
          return (
            <div key={t.id} onClick={() => openThread(t)}
              style={{ background: t.hidden ? 'rgba(200,50,50,.04)' : 'var(--white)', border: `1px solid ${t.hidden ? 'rgba(200,50,50,.2)' : 'var(--border)'}`, borderLeft: `3px solid ${catColor}`, borderRadius: 14, padding: isMobile ? '13px 14px' : '15px 18px', cursor: 'pointer', display: 'flex', gap: 13, transition: 'all .2s cubic-bezier(.25,.46,.45,.94)', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = catColor + '66' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)'; e.currentTarget.style.borderColor = t.hidden ? 'rgba(200,50,50,.2)' : 'var(--border)' }}>
              <Avatar member={author} size={isMobile ? 36 : 42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12, color: C.text }}>@{author?.pseudo || 'Inconnu'}</strong>
                  <RoleBadge role={author?.role || 'membre'} />
                  <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: catColor + '22', color: catColor, border: `1px solid ${catColor}44` }}>{t.cat === '+18' ? '🔞 +18' : t.cat}</span>
                  {novel && <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: '#2ecc71', color: '#fff' }}>NOUVEAU</span>}
                  {t.pinned && <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700 }}>📌</span>}
                  {t.locked && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🔒</span>}
                  {t.hidden && canMod && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑</span>}
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(t.created_at)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: 'var(--text)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--textDim)', display: 'flex', alignItems: 'center', gap: 3 }}>♥ {t.likes || 0}</span>
                  <span style={{ fontSize: 11, color: replyCount === 0 ? 'var(--red)' : 'var(--textDim)', fontWeight: replyCount === 0 ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>💬 {replyCount}</span>
                  <span style={{ fontSize: 11, color: 'var(--textDim)', display: 'flex', alignItems: 'center', gap: 3 }}>👁 {t.views || 0}</span>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 30px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, fontSize: 13, color: 'var(--textDim)' }}>
            {searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Aucune discussion dans cette catégorie.'}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0 }) }} disabled={page === 1}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: page === 1 ? C.textDim : C.text, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            ← Préc.
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0 }) }}
              style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${p === page ? C.accentDk : C.border}`, background: p === page ? '#fffae6' : C.white, color: p === page ? C.accentTxt : C.text, fontWeight: p === page ? 700 : 400, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              {p}
            </button>
          ))}
          <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0 }) }} disabled={page === totalPages}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: page === totalPages ? C.textDim : C.text, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Suiv. →
          </button>
        </div>
      )}
      </div>{/* ── fin colonne principale ── */}

      {/* ── SIDEBAR DROITE (desktop only) ── */}
      {!isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 80 }}>

          {/* Catégories rapides */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>📂 Catégories</span>
            </div>
            {visibleCats.filter(c => c !== 'Tous').map(c => {
              const cc = CAT_COLORS[c] || C.accentDk
              const count = threads.filter(t => t.cat === c && !t.hidden).length
              return (
                <div key={c} onClick={() => { setCat(c); setPage(1) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background .13s', background: cat === c ? cc + '15' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = cc + '10'}
                  onMouseLeave={e => e.currentTarget.style.background = cat === c ? cc + '15' : 'transparent'}>
                  <span style={{ fontSize: 13, color: cat === c ? cc : C.text, fontWeight: cat === c ? 700 : 400 }}>
                    {c === '+18' ? '🔞 +18' : c}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: C.surfaceB, padding: '1px 7px', borderRadius: 99, border: `1px solid ${C.border}` }}>{count}</span>
                </div>
              )
            })}
            <div onClick={() => { setCat('Tous'); setPage(1) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer', transition: 'background .13s', background: cat === 'Tous' ? C.accentBg : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = C.accentBg}
              onMouseLeave={e => e.currentTarget.style.background = cat === 'Tous' ? C.accentBg : 'transparent'}>
              <span style={{ fontSize: 13, color: cat === 'Tous' ? C.accentTxt : C.text, fontWeight: cat === 'Tous' ? 700 : 400 }}>Toutes</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: C.surfaceB, padding: '1px 7px', borderRadius: 99, border: `1px solid ${C.border}` }}>{threads.filter(t => !t.hidden).length}</span>
            </div>
          </div>

          {/* Stats rapides */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Stats</span>
            </div>
            {[
              { icon: '💬', label: 'Discussions', value: threads.filter(t => !t.hidden).length },
              { icon: '📌', label: 'Épinglées',   value: threads.filter(t => t.pinned).length },
              { icon: '🔒', label: 'Verrouillées',value: threads.filter(t => t.locked).length },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{s.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Top contributeurs */}
          {topAuthors.length > 0 && (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB }}>
                  <span style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Top auteurs</span>
                </div>
                {topAuthors.map((m, i) => {
                  const threadCount = threads.filter(t => t.author_id === m.id).length
                  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
                  const ac = colors[(m.pseudo?.charCodeAt(0) || 0) % colors.length]
                  const ring = ROLE_RING[m.role] || null
                  return (
                    <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .13s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontWeight: 800, fontSize: 13, width: 18, textAlign: 'center', opacity: i < 3 ? 1 : .5 }}>
                        {['🥇','🥈','🥉'][i] || i + 1}
                      </span>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.avatar_url ? '#444' : ac, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, border: ring ? `2px solid ${ring}` : '2px solid rgba(255,255,255,.15)', boxShadow: ring ? `0 0 8px ${ring}66` : 'none' }}>
                        {m.avatar_url ? <img loading="lazy" decoding="async" src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.initials || '?'}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pseudo}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accentTxt }}>{threadCount}</span>
                    </div>
                  )
                })}
              </div>
          )}

        </div>
      )}

      </div>{/* ── fin grid 2 colonnes ── */}
    </div>
  )
}