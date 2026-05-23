import { useState, useEffect, useRef } from 'react'
import { C, CATS } from '../lib/constants'
import { RoleBadge, Btn, Input } from '../components/UI'
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
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR')
}

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
        style={{ width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 10, padding: '10px 44px 10px 14px', fontSize: 13, color: C.text, background: C.surfaceB, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', transition: 'border .2s', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = '#c8a200'}
        onBlur={e => e.target.style.borderColor = C.borderMid}
      />
      <button type="button" onClick={() => setShowEmoji(s => !s)} style={{ position: 'absolute', bottom: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: .6 }}>
        😊
      </button>
      {showEmoji && (
        <div ref={emojiRef} style={{ position: 'absolute', bottom: '110%', right: 0, zIndex: 1000 }}>
          <EmojiPicker onEmojiClick={insertEmoji} width={300} height={350} />
        </div>
      )}
    </div>
  )
}

function Avatar({ member, size = 36 }) {
  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const color = colors[(member?.pseudo?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: member?.avatar_url ? '#444' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .32, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,.3)' }}>
      {member?.avatar_url
        ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : member?.initials || '??'
      }
    </div>
  )
}

export default function ForumPage() {
  const { user, profile } = useAuth()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members,      setMembers]      = useState([])
  const [threads,      setThreads]      = useState([])
  const [replies,      setReplies]      = useState([])
  const [cat,          setCat]          = useState('Tous')
  const [openId,       setOpenId]       = useState(null)
  const [composing,    setComposing]    = useState(false)
  const [nTitle,       setNTitle]       = useState('')
  const [nBody,        setNBody]        = useState('')
  const [nCat,         setNCat]         = useState('Divers')
  const [replyText,    setReplyText]    = useState('')
  const [posting,      setPosting]      = useState(false)
  const [likes,        setLikes]        = useState({})
  const [editingThread, setEditingThread] = useState(null) // { title, body }
  const [editingReply,  setEditingReply]  = useState(null) // { id, body }

  const myRole = profile?.role || 'membre'
  const ROLES_RANK = { admin: 4, manager: 3, moderateur: 2, animateur: 1, membre: 0 }
  const myRank = ROLES_RANK[myRole] || 0
  const canMod = myRank >= 2

  const getMember = (id) => members.find(m => m.id === id)

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

  const loadThreads = () => {
    api('/rest/v1/threads?select=*&order=pinned.desc,created_at.desc').then(r => r.json()).then(d => { if (Array.isArray(d)) setThreads(d) })
  }

  const loadReplies = (threadId) => {
    api(`/rest/v1/replies?thread_id=eq.${threadId}&order=created_at.asc`).then(r => r.json()).then(d => { if (Array.isArray(d)) setReplies(d) })
  }

  const openThread = (id) => { setOpenId(id); loadReplies(id) }

  const postThread = async () => {
    if (!nTitle.trim() || !nBody.trim() || !user) return
    setPosting(true)
    await api('/rest/v1/threads', {
      method: 'POST',
      body: JSON.stringify({ author_id: user.id, cat: nCat, title: nTitle.trim(), body: nBody.trim(), likes: 0, pinned: false, locked: false, hidden: false })
    })
    setNTitle(''); setNBody(''); setComposing(false); loadThreads(); setPosting(false)
  }

  const postReply = async () => {
    if (!replyText.trim() || !openId || !user) return
    setPosting(true)
    await api('/rest/v1/replies', {
      method: 'POST',
      body: JSON.stringify({ thread_id: openId, author_id: user.id, body: replyText.trim(), hidden: false })
    })
    setReplyText(''); loadReplies(openId); setPosting(false)
  }

  const patchThread = async (id, body) => {
    await api(`/rest/v1/threads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    loadThreads()
  }

  const toggleLike = async (thread) => {
    const liked = likes[thread.id]
    setLikes(l => ({ ...l, [thread.id]: !liked }))
    await patchThread(thread.id, { likes: thread.likes + (liked ? -1 : 1) })
  }

  // ── Modifier un thread ──
  const updateThread = async (id, title, body) => {
    await api(`/rest/v1/threads?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, body, edited_at: new Date().toISOString() })
    })
    loadThreads()
  }

  // ── Modifier une réponse ──
  const updateReply = async (id, body) => {
    await api(`/rest/v1/replies?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body, edited_at: new Date().toISOString() })
    })
    loadReplies(openId)
  }

  // ── Supprimer un thread (modération) ──
  const deleteThread = async (id) => {
    if (!window.confirm('Supprimer définitivement ce topic et toutes ses réponses ?')) return
    await api(`/rest/v1/replies?thread_id=eq.${id}`, { method: 'DELETE' })
    await api(`/rest/v1/threads?id=eq.${id}`, { method: 'DELETE' })
    setOpenId(null)
    setReplies([])
    loadThreads()
  }

  // ── Supprimer une réponse (modération) ──
  const deleteReply = async (id) => {
    if (!window.confirm('Supprimer définitivement cette réponse ?')) return
    await api(`/rest/v1/replies?id=eq.${id}`, { method: 'DELETE' })
    loadReplies(openId)
  }

  const currentThread = threads.find(t => t.id === openId)
  const visReplies    = replies.filter(r => !r.hidden || canMod)
  const filtered      = (cat === 'Tous' ? threads : threads.filter(t => t.cat === cat)).filter(t => !t.hidden || canMod)

  const ModBar = ({ thread }) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px', background: '#fffae6', border: `1px solid ${C.accentDk}`, borderRadius: 10, marginTop: 10 }}>
      <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700, alignSelf: 'center' }}>🛡 Modération :</span>
      <Btn onClick={() => patchThread(thread.id, { pinned: !thread.pinned })} variant={thread.pinned ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.pinned ? '📌 Désépingler' : '📌 Épingler'}</Btn>
      <Btn onClick={() => patchThread(thread.id, { locked: !thread.locked })} variant={thread.locked ? 'yellow' : 'ghost'} style={{ fontSize: 10 }}>{thread.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</Btn>
      <Btn onClick={() => patchThread(thread.id, { hidden: !thread.hidden })} variant={thread.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>{thread.hidden ? '👁 Restaurer' : '🙈 Masquer'}</Btn>
      <Btn onClick={() => deleteThread(thread.id)} variant="red" style={{ fontSize: 10 }}>🗑 Supprimer le topic</Btn>
    </div>
  )

  // ── Thread ouvert ──
  if (currentThread) {
    const author = getMember(currentThread.author_id)
    return (
      <div ref={containerRef} style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '12px' : '20px 16px' }}>
        <button onClick={() => { setOpenId(null); setReplies([]); setEditingThread(null); setEditingReply(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Retour au forum
        </button>

        {currentThread.hidden && (
          <div style={{ background: '#ffe0e0', border: '1px solid #c0392b', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: C.red, fontWeight: 600 }}>🗑 Discussion masquée</div>
        )}

        {/* Post principal */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '14px' : '20px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <Avatar member={author} size={isMobile ? 36 : 48} />
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Infos auteur */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <strong style={{ fontSize: 14, color: C.text }}>@{author?.pseudo || 'Inconnu'}</strong>
                <RoleBadge role={author?.role || 'membre'} />
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20044' }}>{currentThread.cat}</span>
                {currentThread.pinned && <span style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>📌 Épinglé</span>}
                {currentThread.locked && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>🔒 Verrouillé</span>}
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(currentThread.created_at)}</span>
                {currentThread.edited_at && (
                  <span style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>✏️ modifié</span>
                )}
              </div>

              {/* Titre + body — édition inline */}
              {editingThread ? (
                <div>
                  <Input
                    value={editingThread.title}
                    onChange={e => setEditingThread(v => ({ ...v, title: e.target.value }))}
                    placeholder="Titre…"
                    style={{ width: '100%', marginBottom: 10, borderRadius: 10, padding: '10px 14px' }}
                  />
                  <RichInput
                    value={editingThread.body}
                    onChange={e => setEditingThread(v => ({ ...v, body: e.target.value }))}
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <Btn onClick={() => setEditingThread(null)} variant="ghost">Annuler</Btn>
                    <Btn onClick={async () => {
                      await updateThread(currentThread.id, editingThread.title, editingThread.body)
                      setEditingThread(null)
                    }} variant="yellow">Sauvegarder</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <h2 style={{ fontSize: isMobile ? 16 : 19, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 12 }}>
                    {currentThread.title}
                  </h2>
                  <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                    <RichText text={currentThread.body} />
                  </p>
                </>
              )}

              {/* Like + bouton modifier (auteur) */}
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => toggleLike(currentThread)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: nCat === c ? '#fffae6' : C.surfaceB  , border: `1px solid ${likes[currentThread.id] ? C.accentDk : '#ddd'}`, color: likes[currentThread.id] ? C.accentTxt : C.textMid, borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}>
                  ♥ {currentThread.likes + (likes[currentThread.id] ? 1 : 0)} J'aime'#f5f5f5'
                </button>

                {/* Modifier — visible par l'auteur uniquement */}
                {user?.id === currentThread.author_id && !editingThread && (
                  <Btn
                    onClick={() => setEditingThread({ title: currentThread.title, body: currentThread.body })}
                    variant="ghost"
                    style={{ fontSize: 11 }}
                  >
                    ✏️ Modifier
                  </Btn>
                )}
              </div>

              {/* Barre modération (épingler, verrouiller, masquer, supprimer) */}
              {canMod && <ModBar thread={currentThread} />}
            </div>
          </div>
        </div>

        {/* Réponses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {visReplies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, fontSize: 12, color: C.textDim }}>
              Aucune réponse — soyez le premier !
            </div>
          )}
          {visReplies.map(r => {
            const ru = getMember(r.author_id)
            const isEditingThis = editingReply?.id === r.id
            return (
              <div key={r.id} style={{ background: r.hidden ? '#fff8f8' : C.white, border: `1px solid ${r.hidden ? '#f5c0c0' : C.border}`, borderRadius: 14, padding: isMobile ? '12px' : '14px 16px', display: 'flex', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
                <Avatar member={ru} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 12, color: C.text }}>@{ru?.pseudo || 'Inconnu'}</strong>
                    <RoleBadge role={ru?.role || 'membre'} />
                    <span style={{ fontSize: 11, color: C.textDim }}>{formatDate(r.created_at)}</span>
                    {r.hidden && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑 Masqué</span>}
                    {r.edited_at && <span style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>✏️ modifié</span>}
                  </div>

                  {/* Body réponse — édition inline */}
                  {isEditingThis ? (
                    <div>
                      <RichInput
                        value={editingReply.body}
                        onChange={e => setEditingReply(v => ({ ...v, body: e.target.value }))}
                        rows={3}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <Btn onClick={() => setEditingReply(null)} variant="ghost" style={{ fontSize: 11 }}>Annuler</Btn>
                        <Btn onClick={async () => {
                          await updateReply(r.id, editingReply.body)
                          setEditingReply(null)
                        }} variant="yellow" style={{ fontSize: 11 }}>Sauvegarder</Btn>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                      <RichText text={r.body} />
                    </p>
                  )}

                  {/* Actions réponse */}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Modifier — auteur uniquement */}
                    {user?.id === r.author_id && !isEditingThis && (
                      <Btn
                        onClick={() => setEditingReply({ id: r.id, body: r.body })}
                        variant="ghost"
                        style={{ fontSize: 10 }}
                      >
                        ✏️ Modifier
                      </Btn>
                    )}

                    {/* Modération */}
                    {canMod && (
                      <>
                        <Btn onClick={async () => {
                          await api(`/rest/v1/replies?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ hidden: !r.hidden }) })
                          loadReplies(openId)
                        }} variant={r.hidden ? 'green' : 'red'} style={{ fontSize: 10 }}>
                          {r.hidden ? '👁 Restaurer' : '🙈 Masquer'}
                        </Btn>
                        <Btn onClick={() => deleteReply(r.id)} variant="red" style={{ fontSize: 10 }}>
                          🗑 Supprimer
                        </Btn>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Zone réponse */}
        {user && !currentThread.locked ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '14px' : '16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Votre réponse</div>
            <RichInput value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Écris ta réponse… (liens et émojis supportés)" rows={3} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Btn onClick={postReply} variant="yellow">{posting ? '…' : 'Publier ma réponse'}</Btn>
            </div>
          </div>
        ) : currentThread.locked ? (
          <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.borderMid}`, borderRadius: 12, fontSize: 12, color: C.red, marginTop: 10 }}>
            🔒 Discussion verrouillée.
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '14px', background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 12, color: C.textDim, marginTop: 10 }}>
            Connecte-toi pour répondre.
          </div>
        )}
      </div>
    )
  }

  // ── Liste threads ──
  return (
    <div ref={containerRef} style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '12px' : '20px 16px' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: isMobile ? 18 : 22, color: C.text, marginBottom: 2 }}>Forum</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>{filtered.length} discussion{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {user && (
          <button onClick={() => setComposing(v => !v)} style={{ padding: isMobile ? '8px 14px' : '10px 20px', background: 'linear-gradient(135deg,#f0c800,#c8a200)', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#3a2e00', boxShadow: '0 2px 8px rgba(200,162,0,.3)', fontFamily: 'inherit' }}>
            + Nouvelle discussion
          </button>
        )}
      </div>

      {/* Formulaire nouvelle discussion */}
      {composing && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', animation: 'fadein .2s ease' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>Nouvelle discussion</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Catégorie</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.filter(c => c !== 'Tous').map(c => (
                <button key={c} onClick={() => setNCat(c)} style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', background: nCat === c ? '#fffae6' : '#f5f5f5', border: `1px solid ${nCat === c ? C.accentDk : '#ddd'}`, color: nCat === c ? C.accentTxt : C.textMid, fontSize: 12, fontFamily: 'inherit', fontWeight: nCat === c ? 700 : 400, transition: 'all .15s' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>Titre</div>
          <Input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="Titre de ta discussion…" style={{ width: '100%', marginBottom: 14, borderRadius: 10, padding: '10px 14px' }} />
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>Message</div>
          <RichInput value={nBody} onChange={e => setNBody(e.target.value)} placeholder="Développe ta discussion…" rows={4} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setComposing(false)} variant="ghost">Annuler</Btn>
            <Btn onClick={postThread} variant="yellow">{posting ? '…' : 'Publier'}</Btn>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', background: cat === c ? '#fffae6' : C.surfaceB, border: `1px solid ${cat === c ? C.accentDk : '#ddd'}`, color: cat === c ? C.accentTxt : C.textMid, fontSize: 12, fontFamily: 'inherit', fontWeight: cat === c ? 700 : 400, transition: 'all .15s' }}>
            {c}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(t => {
          const author = getMember(t.author_id)
          return (
            <div key={t.id} onClick={() => openThread(t.id)} style={{ background: t.hidden ? '#fff8f8' : C.white, border: `1px solid ${t.hidden ? '#f5c0c0' : t.pinned ? C.accentDk : C.border}`, borderRadius: 14, padding: isMobile ? '12px' : '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px var(--card-shadow)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.03)' }}
            >
              <Avatar member={author} size={isMobile ? 36 : 42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12, color: C.text }}>@{author?.pseudo || 'Inconnu'}</strong>
                  <RoleBadge role={author?.role || 'membre'} />
                  <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20044' }}>{t.cat}</span>
                  {t.pinned && <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700 }}>📌</span>}
                  {t.locked && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🔒</span>}
                  {t.hidden && canMod && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🗑</span>}
                  <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{formatDate(t.created_at)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{t.body}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>♥ {t.likes}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>↩ réponses</span>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, fontSize: 13, color: C.textDim }}>
            Aucune discussion dans cette catégorie.
          </div>
        )}
      </div>
    </div>
  )
}
