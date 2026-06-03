import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { C, VOTES_DEF, CATS, ROLE_RING } from '../lib/constants'
import { RoleBadge } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { BADGES_DEF } from '../lib/xp'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

function apiFetch(path) {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  }).then(r => r.json())
}

function SkeletonThread() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 11, width: '30%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 11, width: '40%' }} />
      </div>
    </div>
  )
}

function SkeletonActivity() {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
      </div>
    </div>
  )
}

function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)    return "à l'instant"
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return new Date(ts).toLocaleDateString('fr-FR')
}

// Avatar réutilisable avec anneau de rôle
function MemberAvatar({ member, size = 34, colors }) {
  const ac = colors[(member?.pseudo?.charCodeAt(0) || 0) % colors.length]
  const ring = ROLE_RING[member?.role] || null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: member?.avatar_url ? '#444' : ac,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      overflow: 'hidden', flexShrink: 0,
      border: ring ? `3px solid ${ring}` : '2px solid rgba(255,255,255,.2)',
      boxShadow: ring ? `0 0 8px ${ring}88` : 'none',
    }}>
      {member?.avatar_url
        ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : member?.initials || '?'}
    </div>
  )
}

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members,    setMembers]    = useState([])
  const [threads,    setThreads]    = useState([])
  const [loadingT,   setLoadingT]   = useState(true)
  const [loadingA,   setLoadingA]   = useState(true)
  const [stats,      setStats]      = useState({ members: 0, threads: 0, messages: 0, online: 0 })
  const [topMembers, setTopMembers] = useState([])
  const [activity,   setActivity]   = useState([])
  const [newThread,  setNewThread]  = useState(false)
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [cat,        setCat]        = useState('Divers')
  const [posting,    setPosting]    = useState(false)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setIsMobile(entry.contentRect.width < 768)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    apiFetch('/rest/v1/profiles?select=*&order=created_at.desc').then(d => {
      if (Array.isArray(d)) {
        setMembers(d)
        setStats(s => ({ ...s, members: d.length, online: d.filter(m => m.online).length }))
        const sorted = [...d].sort((a, b) => {
          const va = Object.values(a.votes || {}).reduce((x, y) => x + y, 0)
          const vb = Object.values(b.votes || {}).reduce((x, y) => x + y, 0)
          return vb - va
        })
        setTopMembers(sorted.slice(0, 5))
      }
    })
    apiFetch('/rest/v1/threads?select=*,replies(count)&hidden=eq.false&order=created_at.desc&limit=6').then(d => {
      if (Array.isArray(d)) { setThreads(d); setStats(s => ({ ...s, threads: d.length })) }
      setLoadingT(false)
    })
    apiFetch('/rest/v1/threads?select=id,title,author_id,created_at&order=created_at.desc&limit=8').then(d => {
      if (Array.isArray(d)) setActivity(d)
      setLoadingA(false)
    })
    apiFetch('/rest/v1/messages?select=id').then(d => {
      if (Array.isArray(d)) setStats(s => ({ ...s, messages: d.length }))
    })
  }, [])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('profiles-online')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.new && 'online' in payload.new) {
          setMembers(prev => {
            const updated = prev.map(m => m.id === payload.new.id ? { ...m, online: payload.new.online } : m)
            setStats(s => ({ ...s, online: updated.filter(m => m.online).length }))
            return updated
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('threads-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threads' }, (payload) => {
        if (payload.new) {
          setActivity(prev => [payload.new, ...prev].slice(0, 8))
          setThreads(prev => [payload.new, ...prev].slice(0, 6))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const postThread = async () => {
    if (!title.trim() || !body.trim() || !user) return
    setPosting(true)
    await fetch(`${SUPABASE_URL}/rest/v1/threads`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, cat, title, body, likes: 0, pinned: false, locked: false, hidden: false })
    })
    setTitle(''); setBody(''); setNewThread(false); setPosting(false)
    apiFetch('/rest/v1/threads?select=*&hidden=eq.false&order=created_at.desc&limit=6').then(d => { if (Array.isArray(d)) setThreads(d) })
  }

  const getMember = (id) => members.find(m => m.id === id)
  const getTopVoteType = (votes) => {
    if (!votes) return null
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
    return top ? VOTES_DEF.find(v => v.key === top[0]) : null
  }
  const xpPercent = profile ? ((profile.xp || 0) % 1000) / 10 : 0
  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: 12 }
    : { display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16 }

  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']

  return (
    <div ref={containerRef}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px', ...gridStyle }}>

        {/* ── SIDEBAR GAUCHE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Top du mois */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🏆 TOP DU MOIS</span>
              <Link to="/members" style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>Voir tout →</Link>
            </div>
            {topMembers.map((m, i) => {
              const tv  = getTopVoteType(m.votes)
              const tot = Object.values(m.votes || {}).reduce((a, b) => a + b, 0)
              const medals = ['🥇','🥈','🥉']
              return (
                <div key={m.id} onClick={() => navigate(`/members/${m.id}`)} className="row"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, width: 20, textAlign: 'center' }}>{medals[i] || i + 1}</span>
                  <MemberAvatar member={m} size={34} colors={colors} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pseudo}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.accentTxt }}>{tot}</span>
                  {tv && <span title={tv.label}>{tv.emoji}</span>}
                </div>
              )
            })}
            <div onClick={() => navigate('/members')} className="row" style={{ padding: '10px 16px', textAlign: 'center', cursor: 'pointer', background: C.surfaceB }}>
              <span style={{ fontSize: 12, color: C.accentTxt, fontWeight: 700 }}>Voir le classement complet</span>
            </div>
          </div>

          {/* Membres en ligne */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.online, marginRight: 6, animation: 'pulse 2s infinite' }} />
                MEMBRES EN LIGNE
              </span>
            </div>
            {members.filter(m => m.online).length === 0
              ? <div style={{ padding: '14px 16px', fontSize: 12, color: C.textDim, textAlign: 'center', fontStyle: 'italic' }}>Aucun membre en ligne</div>
              : members.filter(m => m.online).slice(0, isMobile ? 3 : 6).map(m => (
                  <div key={m.id} onClick={() => navigate(`/members/${m.id}`)} className="row"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    {/* Avatar avec anneau de rôle + pastille online */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <MemberAvatar member={m} size={34} colors={colors} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: C.online, border: '2px solid #fff' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.pseudo}</div>
                      <div style={{ transform: 'scale(0.8)', transformOrigin: 'left center', marginTop: 1 }}><RoleBadge role={m.role} /></div>
                    </div>
                  </div>
                ))
            }
            <div onClick={() => navigate('/members')} className="row" style={{ padding: '8px 16px', textAlign: 'center', cursor: 'pointer', background: C.surfaceB }}>
              <span style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>Voir tous les membres →</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>STATISTIQUES</div>
            {[
              { icon: '👥', label: 'Membres',         value: stats.members },
              { icon: '💬', label: 'Discussions',      value: stats.threads },
              { icon: '✉️', label: 'Messages',         value: stats.messages },
              { icon: '🟢', label: 'Membres en ligne', value: stats.online },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                <span>{s.icon}</span>
                <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{s.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONTENU CENTRAL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15, color: C.text, textTransform: 'uppercase', letterSpacing: 1 }}>Discussions récentes</h2>
            {user && (
              <button onClick={() => setNewThread(t => !t)} style={{ padding: isMobile ? '7px 14px' : '9px 18px', background: 'linear-gradient(135deg,#f0c800,#c8a200)', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: isMobile ? 12 : 13, color: '#3a2e00', boxShadow: '0 2px 8px rgba(200,162,0,.3)' }}>
                + Nouvelle discussion
              </button>
            )}
          </div>

          {newThread && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)', animation: 'fadein .2s ease' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginBottom: 10 }}>
                <select value={cat} onChange={e => setCat(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.text, background: C.white }}>
                  {CATS.filter(c => c !== 'Tous').map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la discussion…" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.text, fontFamily: 'inherit', background: C.white }} />
              </div>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Contenu…" rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.text, fontFamily: 'inherit', resize: 'vertical', marginBottom: 10, boxSizing: 'border-box', background: C.surfaceB }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setNewThread(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.borderMid}`, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid }}>Annuler</button>
                <button onClick={postThread} disabled={posting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#3a2e00' }}>{posting ? '…' : 'Publier'}</button>
              </div>
            </div>
          )}

          {/* Threads */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `2px solid ${C.accent}`, fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>DISCUSSIONS RÉCENTES</div>
            {loadingT
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonThread key={i} />)
              : threads.length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.textDim, fontSize: 13 }}>Aucune discussion pour l'instant</div>
                : threads.map(t => {
                    const author = getMember(t.author_id)
                    return (
                      <div key={t.id} onClick={() => navigate('/forum')} className="row"
                        style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, padding: isMobile ? '12px' : '14px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                        {!isMobile && (
                          <div style={{ flexShrink: 0 }}>
                            {t.pinned ? <span style={{ fontSize: 16 }}>📌</span> : t.locked ? <span style={{ fontSize: 16 }}>🔒</span> : <span style={{ fontSize: 16 }}>💬</span>}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20044' }}>{t.cat}</span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: C.textMid }}>{author ? `@${author.pseudo}` : 'Inconnu'} · {formatTimeAgo(t.created_at)}</div>
                        </div>
                        {!isMobile && (
                          <div style={{ display: 'flex', gap: 16, flexShrink: 0, color: C.textMid, fontSize: 12 }}>
                            <span>💬 {t.replies?.[0]?.count || 0}</span>
                            <span>❤️ {t.likes || 0}</span>
                          </div>
                        )}
                        {/* Avatar auteur thread avec anneau */}
                        <MemberAvatar member={author} size={30} colors={colors} />
                      </div>
                    )
                  })
            }
            <div onClick={() => navigate('/forum')} className="row" style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: C.surfaceB, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.accentTxt, fontWeight: 700 }}>Voir toutes les discussions →</span>
            </div>
          </div>

          {/* Catégories */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `2px solid ${C.accent}`, fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>CATÉGORIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0 }}>
              {[
                { cat: 'Musique',    icon: '🎵', desc: 'Tous styles musicaux, artistes, labels…' },
                { cat: 'Rencontres', icon: '💜', desc: 'Rencontrez, discutez, partagez…' },
                { cat: 'Culture',    icon: '🎭', desc: 'Cinéma, séries, livres, art…' },
                { cat: 'Lifestyle',  icon: '☕', desc: 'Mode de vie, bien-être, sport…' },
                { cat: 'Voyages',    icon: '✈️', desc: 'Destinations, bons plans…' },
                { cat: 'Divers',     icon: '💬', desc: "Tout ce qui n'entre pas ailleurs !" },
              ].map(c => (
                <div key={c.cat} onClick={() => navigate('/forum')} className="row"
                  style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.accentTxt, marginBottom: 2 }}>{c.cat}</div>
                    <div style={{ fontSize: 11, color: C.textMid }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Citation */}
          <div style={{ background: 'linear-gradient(135deg,#1a1a1a,#1a1a2e)', borderRadius: 12, padding: isMobile ? '24px 20px' : '28px 36px', textAlign: 'center', border: '1px solid rgba(200,162,0,.2)' }}>
            <div style={{ fontSize: 36, color: C.accent, lineHeight: 1, marginBottom: 10, opacity: .7 }}>"</div>
            <p style={{ fontSize: isMobile ? 14 : 17, color: '#fff', fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>La communauté, c'est ce qui nous fait avancer.</p>
            <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>Restons respectueux, ouverts et bienveillants envers tous les membres.</p>
            <div style={{ fontSize: 36, color: C.accent, lineHeight: 1, marginTop: 10, opacity: .7 }}>"</div>
          </div>
        </div>

        {/* ── SIDEBAR DROITE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Activité en temps réel */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>ACTIVITÉ RÉCENTE</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            </div>
            {loadingA
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonActivity key={i} />)
              : activity.length === 0
                ? <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Aucune activité</div>
                : activity.map((t, i) => {
                    const author = getMember(t.author_id)
                    return (
                      <div key={t.id} onClick={() => navigate('/forum')} className="row"
                        style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', animation: `fadein .${2 + i}s ease` }}>
                        <MemberAvatar member={author} size={34} colors={colors} />
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, color: C.accentTxt }}>@{author?.pseudo || 'Inconnu'}</span>{author?.is_bot && <span style={{ marginLeft: 3, padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: '#5865f2', color: '#fff' }}>BOT</span>}
                          {' '}a créé{' '}
                          <span style={{ fontWeight: 600 }}>"{t.title?.slice(0, 30)}{t.title?.length > 30 ? '…' : ''}"</span>
                          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{formatTimeAgo(t.created_at)}</div>
                        </div>
                      </div>
                    )
                  })
            }
          </div>

          {/* Récompenses */}
          {user && profile && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>VOS RÉCOMPENSES</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {BADGES_DEF.map(b => {
                  const has = (profile.badges || []).includes(b.key)
                  return (
                    <div key={b.key} title={`${b.label}${has ? ' ✓' : ' (verrouillé)'}`}
                      style={{ width: 38, height: 38, borderRadius: '50%', background: has ? (b.bg || '#fffae6') : C.surfaceB, border: `2px solid ${has ? (b.color || C.accentDk) : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, opacity: has ? 1 : 0.3, transition: 'all .2s', cursor: has ? 'help' : 'default', filter: has ? 'none' : 'grayscale(100%)' }}>
                      {b.emoji}
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>Niveau {profile.level || 1}</span>
                <span>{(profile.xp || 0) % 1000} / 1000 XP</span>
              </div>
              <div style={{ height: 8, background: C.surfaceB, borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right, #f0c800, #c8a200)', borderRadius: 20, transition: 'width .5s' }} />
              </div>
            </div>
          )}

          {/* Annonces */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>📢 ANNONCES</div>
            <div style={{ padding: 14 }}>
              <div style={{ background: C.surfaceB, border: `1px solid ${C.accentDk}`, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.accentTxt, marginBottom: 4 }}>🎉 Bienvenue sur Wemoved !</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>La communauté est lancée. Créez votre profil et participez !</div>
              </div>
              <div style={{ fontSize: 12, color: C.text, padding: '0 2px' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Nouveau système de badges disponible !</div>
                <div style={{ color: C.textMid, lineHeight: 1.5 }}>Découvrez-les dans votre profil.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}