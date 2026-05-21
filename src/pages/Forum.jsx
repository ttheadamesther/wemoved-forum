import { useState, useEffect, useRef } from 'react'
import { C, CATS } from '../lib/constants'
import { RoleBadge, CatBadge, Btn, Input, Textarea } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import EmojiPicker from 'emoji-picker-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  if (diff < 60)   return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR')
}

// Rendu du texte avec liens cliquables
function RichText({ text }) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <span>
      {parts.map((part, i) =>
        urlRegex.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: C.accentTxt, textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

// Input avec émojis
function RichInput({ value, onChange, placeholder, rows = 3 }) {
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef()
  const emojiRef    = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const insertEmoji = (emojiData) => {
    const el    = textareaRef.current
    const start = el.selectionStart
    const end   = el.selectionEnd
    const newVal = value.slice(0, start) + emojiData.emoji + value.slice(end)
    onChange({ target: { value: newVal } })
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length) }, 0)
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{ width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 2, padding: '7px 10px', fontSize: 13, color: C.text, background: C.white, fontFamily: "'Open Sans',sans-serif", resize: 'vertical', lineHeight: 1.6 }}
      />
      <button
        type="button"
        onClick={() => setShowEmoji(s => !s)}
        style={{ position: 'absolute', bottom: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
      >😊</button>
      {showEmoji && (
        <div ref={emojiRef} style={{ position: 'absolute', bottom: '110%', right: 0, zIndex: 1000 }}>
          <EmojiPicker onEmojiClick={insertEmoji} width={300} height={350} />
        </div>
      )}
    </div>
  )
}

function Avatar({ member, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 3, background: '#444', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .28, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
      {member?.avatar_url
        ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : member?.initials || '??'
      }
    </div>
  )
}

export default function ForumPage() {
  const { user, profile } = useAuth()
  const [members,   setMembers]   = useState([])
  const [threads,   setThreads]   = useState([])
  const [replies,   setReplies]   = useState([])
  const [cat,       setCat]       = useState('Tous')
  const [openId,    setOpenId]    = useState(null)
  const [composing, setComposing] = useState(false)
  const [nTitle,    setNTitle]    = useState('')
  const [nBody,     setNBody]     = useState('')
  const [nCat,      setNCat]      = useState('Divers')
  const [replyText, setReplyText] = useState('')
  const [posting,   setPosting]   = useState(false)
  const [likes,     setLikes]     = useState({})

  const myRole = profile?.role || 'membre'
  const ROLES_RANK = { admin: 4, manager: 3, moderateur: 2, animateur: 1, membre: 0 }
  const myRank = ROLES_RANK[myRole] || 0
  const canMod = myRank >= 2

  const getMember = (id) => members.find(m => m.id === id)

  useEffect(() => {
    api('/rest/v1/profiles?select=*').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d) })
    loadThreads()
  }, [])

  const loadThreads = () => {
    api('/rest/v1/threads?select=*&order=pinned.desc,created_at.desc').then(r => r.json()).then(d => { if (Array.isArray(d)) setThreads(d) })
  }

  const loadReplies = (threadId) => {
    api(`/rest/v1/replies?thread_id=eq.${threadId}&order=created_at.asc`).then(r => r.json()).then(d => { if (Array.isArray(d)) setReplies(d) })
  }

  const openThread = (id) => {
    setOpenId(id)
    loadReplies(id)
  }

  const postThread = async () => {
    if (!nTitle.trim() || !nBody.trim() || !user) return
    setPosting(true)
    await api('/rest/v1/threads', {
      method: 'POST',
      body: JSON.stringify({ author_id: user.id, cat: nCat, title: nTitle.trim(), body: nBody.trim(), likes: 0, pinned: false, locked: false, hidden: false })
    })
    setNTitle(''); setNBody(''); setComposing(false)
    loadThreads()
    setPosting(false)
  }

  const postReply = async () => {
    if (!replyText.trim() || !openId || !user) return
    setPosting(true)
    await api('/rest/v1/replies', {
      method: 'POST',
      body: JSON.stringify({ thread_id: openId, author_id: user.id, body: replyText.trim(), hidden: false })
    })
    setReplyText('')
    loadReplies(openId)
    setPosting(false)
  }

  const patchThread = async (id, body) => {
    await api(`/rest/v1/threads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    loadThreads()
  }

  const toggleLike = async (thread) => {
    const liked    = likes[thread.id]
    const newLikes = thread.likes + (liked ? -1 : 1)
    setLikes(l => ({ ...l, [thread.id]: !liked }))
    await patchThread(thread.id, { likes: newLikes })
  }

  const currentThread = threads.find(t => t.id === openId)
  const visReplies    = replies.filter(r => !r.hidden || canMod)
  const filtered      = (cat === 'Tous' ? threads : threads.filter(t => t.cat === cat))
    .filter(t => !t.hidden || canMod)

  const ModBar = ({ thread }) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '7px 10px', background: '#fff8e1', border: `1px solid ${C.accentDk}`, borderRadius: 2, marginTop: 10 }}>
      <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700, alignSelf: 'center' }}>🛡 Modération :</span>
      <Btn onClick={() => patchThread(thread.id, { pinned: !thread.pinned })} variant={thread.pinned ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.pinned ? '📌 Désépingler' : '📌 Épingler'}</Btn>
      <Btn onClick={() => patchThread(thread.id, { locked: !thread.locked })} variant={thread.locked ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</Btn>
      <Btn onClick={() => patchThread(thread.id, { hidden: !thread.hidden })} variant={thread.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>{thread.hidden ? '👁 Restaurer' : '🗑 Masquer'}</Btn>
    </div>
  )

  // ── Thread ouvert ──────────────────────────────────────────────────────────
  if (currentThread) {
    const author = getMember(currentThread.author_id)
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px' }}>
        <Btn onClick={() => { setOpenId(null); setReplies([]) }} variant="ghost" style={{ marginBottom: 12 }}>← Retour au forum</Btn>

        {currentThread.hidden && (
          <div style={{ background: '#ffe0e0', border: '1px solid #c0392b', borderRadius: 3, padding: '8px 14px', marginBottom: 10, fontSize: 12, color: C.red, fontWeight: 600 }}>🗑 Discussion masquée</div>
        )}

        {/* Post principal */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '16px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar member={author} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                <strong style={{ fontSize: 14, color: C.text }}>@{author?.pseudo || 'Inconnu'}</strong>
                <RoleBadge role={author?.role || 'membre'} />
                <CatBadge cat={currentThread.cat} />
                {currentThread.pinned && <span style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>📌 Épinglé</span>}
                {currentThread.locked && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>🔒 Verrouillé</span>}
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(currentThread.created_at)}</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 10 }}>{currentThread.title}</h2>
              <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                <RichText text={currentThread.body} />
              </p>
              <div style={{ marginTop: 10 }}>
                <button onClick={() => toggleLike(currentThread)} style={{ background: likes[currentThread.id] ? '#fffae6' : 'transparent', border: `1px solid ${likes[currentThread.id] ? C.accentDk : C.borderMid}`, color: likes[currentThread.id] ? C.accentTxt : C.textMid, borderRadius: 2, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: "'Open Sans',sans-serif" }}>
                  ♥ {currentThread.likes + (likes[currentThread.id] ? 1 : 0)} J'aime
                </button>
              </div>
              {canMod && <ModBar thread={currentThread} />}
            </div>
          </div>
        </div>

        {/* Réponses */}
        {visReplies.map(r => {
          const ru = getMember(r.author_id)
          return (
            <div key={r.id} style={{ background: r.hidden ? '#fff8f8' : C.white, border: `1px solid ${r.hidden ? '#f5c0c0' : C.border}`, borderRadius: 3, padding: '12px 14px', marginBottom: 6, display: 'flex', gap: 10 }}>
              <Avatar member={ru} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 12, color: C.text }}>@{ru?.pseudo || 'Inconnu'}</strong>
                  <RoleBadge role={ru?.role || 'membre'} />
                  <span style={{ fontSize: 11, color: C.textDim }}>{formatDate(r.created_at)}</span>
                  {r.hidden && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑 Masqué</span>}
                </div>
                <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  <RichText text={r.body} />
                </p>
                {canMod && (
                  <div style={{ marginTop: 7 }}>
                    <Btn onClick={async () => {
                      await api(`/rest/v1/replies?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ hidden: !r.hidden }) })
                      loadReplies(openId)
                    }} variant={r.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>
                      {r.hidden ? 'Restaurer' : 'Masquer'}
                    </Btn>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {visReplies.length === 0 && (
          <div style={{ textAlign: 'center', padding: '14px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, color: C.textDim }}>
            Aucune réponse — soyez le premier !
          </div>
        )}

        {/* Zone de réponse */}
        {user && !currentThread.locked ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: 14, marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Votre réponse</div>
            <RichInput value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Écris ta réponse… (supporte les liens et les émojis)" rows={3} />
            <Btn onClick={postReply} variant="yellow" style={{ marginTop: 8 }}>{posting ? '…' : 'Publier ma réponse »'}</Btn>
          </div>
        ) : currentThread.locked ? (
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff8f8', border: `1px solid ${C.borderMid}`, borderRadius: 3, fontSize: 12, color: C.red, marginTop: 10 }}>
            🔒 Discussion verrouillée.
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px', background: '#f9f9f9', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, color: C.textDim, marginTop: 10 }}>
            Connecte-toi pour répondre.
          </div>
        )}
      </div>
    )
  }

  // ── Liste des threads ──────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 19, color: '#555' }}>Forum</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>{filtered.length} discussion{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {user && <Btn onClick={() => setComposing(v => !v)} variant="yellow">+ Nouvelle discussion</Btn>}
      </div>

      {/* Formulaire nouvelle discussion */}
      {composing && (
        <div style={{ background: C.white, border: `1px solid ${C.accentDk}`, borderRadius: 3, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 12 }}>Nouvelle discussion</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 5 }}>Catégorie :</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.filter(c => c !== 'Tous').map(c => (
                <button key={c} onClick={() => setNCat(c)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', background: nCat === c ? '#fffae6' : '#f5f5f5', border: `1px solid ${nCat === c ? C.accentDk : C.border}`, color: nCat === c ? C.accentTxt : C.textMid, fontSize: 11, fontFamily: "'Open Sans',sans-serif" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Titre :</label>
          <Input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="Titre de ta discussion…" style={{ width: '100%', marginBottom: 10 }} />
          <label style={{ fontSize: 12, color: C.textMid, display: 'block', marginBottom: 4 }}>Message :</label>
          <RichInput value={nBody} onChange={e => setNBody(e.target.value)} placeholder="Développe ta discussion… (supporte les liens et les émojis)" rows={4} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn onClick={postThread} variant="yellow">{posting ? '…' : 'Publier »'}</Btn>
            <Btn onClick={() => setComposing(false)} variant="ghost">Annuler</Btn>
          </div>
        </div>
      )}

      {/* Filtres catégories */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', background: cat === c ? '#fffae6' : '#f0f0f0', border: `1px solid ${cat === c ? C.accentDk : C.border}`, color: cat === c ? C.accentTxt : C.textMid, fontSize: 11, fontFamily: "'Open Sans',sans-serif" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(t => {
          const author = getMember(t.author_id)
          return (
            <div key={t.id} onClick={() => openThread(t.id)} style={{ background: t.hidden ? '#fff8f8' : t.pinned ? '#fffef0' : C.white, border: `1px solid ${t.hidden ? '#f5c0c0' : t.pinned ? C.accentDk : C.border}`, borderRadius: 3, padding: '11px 14px', cursor: 'pointer', display: 'flex', gap: 12, transition: 'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <Avatar member={author} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12, color: C.text }}>@{author?.pseudo || 'Inconnu'}</strong>
                  <RoleBadge role={author?.role || 'membre'} />
                  <CatBadge cat={t.cat} />
                  {t.pinned && <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700 }}>📌</span>}
                  {t.locked && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🔒</span>}
                  {t.hidden && canMod && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑 Masqué</span>}
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(t.created_at)}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 2 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>♥ {t.likes}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>↩ réponses</span>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, color: C.textDim }}>
            Aucune discussion dans cette catégorie.
          </div>
        )}
      </div>
    </div>
  )
}