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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 10, width: '25%', marginBottom: 8, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 6, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

function SkeletonActivity() {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 11, width: '88%', marginBottom: 6, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 9, width: '38%', borderRadius: 6 }} />
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
      border: ring ? `2.5px solid ${ring}` : '2px solid rgba(255,255,255,.15)',
      boxShadow: ring ? `0 0 10px ${ring}66` : 'none',
    }}>
      {member?.avatar_url
        ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : member?.initials || '?'}
    </div>
  )
}

/* ── Petit composant carte section ── */
function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid rgba(200,162,0,.5)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,.07), 0 1px 3px rgba(0,0,0,.05)',
      transition: 'box-shadow .25s ease, border-color .25s ease',
      ...style
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ children, accent = false }) {
  return (
    <div style={{
      padding: '13px 18px',
      border: '1px solid rgba(200,162,0,.5)',
      borderBottom: '1px solid rgba(200,162,0,.4)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'var(--surfaceB)',
    }}>
      {children}
    </div>
  )
}

const CAT_COLORS = {
  Musique:    { bg: 'rgba(155,89,182,.12)', color: '#9b59b6', border: 'rgba(155,89,182,.25)' },
  Culture:    { bg: 'rgba(52,152,219,.12)', color: '#3498db', border: 'rgba(52,152,219,.25)' },
  Voyages:    { bg: 'rgba(26,188,156,.12)', color: '#1abc9c', border: 'rgba(26,188,156,.25)' },
  Lifestyle:  { bg: 'rgba(230,184,0,.12)',  color: '#b89200', border: 'rgba(200,162,0,.25)' },
  Rencontres: { bg: 'rgba(233,30,99,.12)',  color: '#e91e63', border: 'rgba(233,30,99,.25)' },
  Divers:     { bg: 'rgba(100,100,130,.12)', color: '#7070a0', border: 'rgba(100,100,130,.25)' },
  '+18':      { bg: 'rgba(192,57,43,.12)',  color: '#c0392b', border: 'rgba(192,57,43,.25)' },
}

function CatBadge({ cat }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.Divers
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .3,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
    }}>{cat}</span>
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
    ? { display: 'flex', flexDirection: 'column', gap: 14 }
    : { display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 18 }

  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']

  const inputStyle = {
    padding: '9px 13px',
    borderRadius: 10,
    border: '1px solid var(--borderMid)',
    fontSize: 13,
    color: 'var(--text)',
    background: 'var(--surfaceB)',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
  }

  const onlineMems = members.filter(m => m.online)

  return (
    <div ref={containerRef}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: isMobile ? '14px 12px' : '22px 18px', ...gridStyle }}>

        {/* ── SIDEBAR GAUCHE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top du mois */}
          <SectionCard>
            <SectionHeader>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                🏆 Top du mois
              </span>
              <Link to="/members" style={{ fontSize: 11, color: 'var(--accentTxt)', fontWeight: 700, opacity: .85 }}>Voir tout →</Link>
            </SectionHeader>
            {topMembers.map((m, i) => {
              const tv  = getTopVoteType(m.votes)
              const tot = Object.values(m.votes || {}).reduce((a, b) => a + b, 0)
              const medals = ['🥇','🥈','🥉']
              return (
                <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .13s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontWeight: 800, fontSize: 15, width: 22, textAlign: 'center', opacity: i < 3 ? 1 : .5 }}>{medals[i] || i + 1}</span>
                  <MemberAvatar member={m} size={34} colors={colors} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pseudo}</span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--accentTxt)', marginRight: 2 }}>{tot}</span>
                  {tv && <span title={tv.label} style={{ fontSize: 15 }}>{tv.emoji}</span>}
                </div>
              )
            })}
            <div onClick={() => navigate('/members')}
              style={{ padding: '11px 18px', textAlign: 'center', cursor: 'pointer', background: 'var(--surfaceB)', transition: 'background .13s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surfaceB)'}>
              <span style={{ fontSize: 12, color: 'var(--accentTxt)', fontWeight: 700 }}>Voir le classement complet</span>
            </div>
          </SectionCard>

          {/* Membres en ligne */}
          <SectionCard>
            <SectionHeader>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--online)', display: 'inline-block', boxShadow: '0 0 8px var(--online)', animation: 'pulse 2s infinite' }} />
                En ligne
                <span style={{ fontWeight: 700, color: 'var(--online)', fontSize: 12, marginLeft: 2 }}>{onlineMems.length}</span>
              </span>
            </SectionHeader>
            {onlineMems.length === 0
              ? <div style={{ padding: '18px 18px', fontSize: 12, color: 'var(--textDim)', textAlign: 'center', fontStyle: 'italic' }}>Aucun membre en ligne</div>
              : onlineMems.slice(0, isMobile ? 3 : 6).map(m => (
                  <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .13s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <MemberAvatar member={m} size={34} colors={colors} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--online)', border: '2px solid var(--white)', boxShadow: '0 0 6px var(--online)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{m.pseudo}</div>
                      <div style={{ transform: 'scale(0.8)', transformOrigin: 'left center', marginTop: 1 }}><RoleBadge role={m.role} /></div>
                    </div>
                  </div>
                ))
            }
            <div onClick={() => navigate('/members')}
              style={{ padding: '10px 18px', textAlign: 'center', cursor: 'pointer', background: 'var(--surfaceB)', transition: 'background .13s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surfaceB)'}>
              <span style={{ fontSize: 11, color: 'var(--accentTxt)', fontWeight: 700 }}>Voir tous les membres →</span>
            </div>
          </SectionCard>

          {/* Stats */}
          <SectionCard style={{ padding: 0 }}>
            <SectionHeader>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1 }}>Statistiques</span>
            </SectionHeader>
            <div style={{ padding: '4px 0' }}>
              {[
                { icon: '👥', label: 'Membres',         value: stats.members },
                { icon: '💬', label: 'Discussions',      value: stats.threads },
                { icon: '✉️', label: 'Messages',         value: stats.messages },
                { icon: '🟢', label: 'En ligne',          value: stats.online },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 15 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--textMid)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── CONTENU CENTRAL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1.2 }}>Discussions récentes</h2>
            {user && (
              <button onClick={() => setNewThread(t => !t)} style={{
                padding: isMobile ? '8px 14px' : '9px 20px',
                background: 'linear-gradient(135deg,#f0c800,#c8a200)',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, color: '#3a2e00',
                boxShadow: '0 2px 12px rgba(200,162,0,.35)',
                transition: 'transform .15s, box-shadow .15s',
                fontFamily: 'inherit',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(200,162,0,.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(200,162,0,.35)' }}>
                + Nouvelle discussion
              </button>
            )}
          </div>

          {newThread && (
            <SectionCard style={{ padding: 18, animation: 'fadein .2s ease' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginBottom: 12 }}>
                <select value={cat} onChange={e => setCat(e.target.value)} className="wmi" style={{ ...inputStyle, minWidth: 140 }}>
                  {CATS.filter(c => c !== 'Tous').map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la discussion…" className="wmi" style={{ ...inputStyle, flex: 1 }} />
              </div>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Contenu…" rows={3} className="wmi" style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setNewThread(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--borderMid)', background: 'var(--surfaceB)', cursor: 'pointer', fontSize: 12, color: 'var(--textMid)', fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={postThread} disabled={posting} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#3a2e00', fontFamily: 'inherit', opacity: posting ? .7 : 1 }}>{posting ? '…' : 'Publier'}</button>
              </div>
            </SectionCard>
          )}

          {/* Threads */}
          <SectionCard>
            <SectionHeader accent>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1 }}>Discussions récentes</span>
            </SectionHeader>
            {loadingT
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonThread key={i} />)
              : threads.length === 0
                ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--textDim)', fontSize: 13 }}>Aucune discussion pour l'instant</div>
                : threads.map((t, idx) => {
                    const author = getMember(t.author_id)
                    return (
                      <div key={t.id} onClick={() => navigate(`/forum/${t.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, padding: isMobile ? '13px 14px' : '15px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .13s', animation: `fadein .${2 + idx}s ease` }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {!isMobile && (
                          <div style={{ fontSize: 18, flexShrink: 0, opacity: .8 }}>
                            {t.pinned ? '📌' : t.locked ? '🔒' : '💬'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ marginBottom: 5 }}>
                            <CatBadge cat={t.cat} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--textMid)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{author ? `@${author.pseudo}` : 'Inconnu'}</span>
                            <span style={{ opacity: .5 }}>·</span>
                            <span>{formatTimeAgo(t.created_at)}</span>
                          </div>
                        </div>
                        {!isMobile && (
                          <div style={{ display: 'flex', gap: 14, flexShrink: 0, color: 'var(--textDim)', fontSize: 12, fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>💬 {t.replies?.[0]?.count || 0}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>❤️ {t.likes || 0}</span>
                          </div>
                        )}
                        <MemberAvatar member={author} size={32} colors={colors} />
                      </div>
                    )
                  })
            }
            <div onClick={() => navigate('/forum')}
              style={{ padding: '13px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surfaceB)', borderTop: '1px solid var(--border)', transition: 'background .13s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surfaceB)'}>
              <span style={{ fontSize: 12, color: 'var(--accentTxt)', fontWeight: 700 }}>Voir toutes les discussions →</span>
            </div>
          </SectionCard>

          {/* Catégories */}
          <SectionCard>
            <SectionHeader accent>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1 }}>Catégories</span>
            </SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0 }}>
              {[
                { cat: 'Musique',    icon: '🎵', desc: 'Artistes, labels, styles…' },
                { cat: 'Rencontres', icon: '💜', desc: 'Rencontrez, discutez…' },
                { cat: 'Culture',    icon: '🎭', desc: 'Cinéma, séries, livres…' },
                { cat: 'Lifestyle',  icon: '☕', desc: 'Bien-être, mode de vie…' },
                { cat: 'Voyages',    icon: '✈️', desc: 'Destinations, bons plans…' },
                { cat: 'Divers',     icon: '💬', desc: "Tout le reste !" },
              ].map((c, i) => {
                const cc = CAT_COLORS[c.cat] || CAT_COLORS.Divers
                return (
                  <div key={c.cat} onClick={() => navigate(`/forum?cat=${c.cat}`)}
                    style={{ display: 'flex', gap: 13, padding: '14px 18px', borderBottom: '1px solid var(--border)', borderRight: i % 2 === 0 && !isMobile ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .13s, border-color .13s', alignItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.background = cc.bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: cc.color, marginBottom: 2 }}>{c.cat}</div>
                      <div style={{ fontSize: 11, color: 'var(--textMid)' }}>{c.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Banner */}
          <div style={{
            background: 'linear-gradient(135deg,#0e0e1e 0%,#141428 50%,#0a0a18 100%)',
            borderRadius: 16,
            padding: isMobile ? '24px 20px' : '30px 40px',
            textAlign: 'center',
            border: '1px solid rgba(200,162,0,.18)',
            boxShadow: '0 4px 24px rgba(0,0,0,.25), inset 0 1px 0 rgba(200,162,0,.08)',
          }}>
            <div style={{ fontSize: 40, color: 'var(--accent)', lineHeight: 1, marginBottom: 12, opacity: .6, fontFamily: 'Georgia, serif' }}>"</div>
            <p style={{ fontSize: isMobile ? 15 : 18, color: '#fff', fontWeight: 700, marginBottom: 10, lineHeight: 1.5 }}>La communauté, c'est ce qui nous fait avancer.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>Restons respectueux, ouverts et bienveillants envers tous.</p>
          </div>
        </div>

        {/* ── SIDEBAR DROITE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Activité */}
          <SectionCard>
            <SectionHeader>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                Activité récente
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--online)', display: 'inline-block', boxShadow: '0 0 6px var(--online)', animation: 'pulse 2s infinite' }} />
              </span>
            </SectionHeader>
            {loadingA
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonActivity key={i} />)
              : activity.length === 0
                ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Aucune activité</div>
                : activity.map((t, i) => {
                    const author = getMember(t.author_id)
                    return (
                      <div key={t.id} onClick={() => navigate(`/forum/${t.id}`)}
                        style={{ display: 'flex', gap: 11, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .13s', animation: `fadein .${2 + i}s ease` }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <MemberAvatar member={author} size={34} colors={colors} />
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accentTxt)' }}>@{author?.pseudo || 'Inconnu'}</span>
                          {author?.is_bot && <span style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: '#5865f2', color: '#fff' }}>BOT</span>}
                          {' '}a créé{' '}
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>"{t.title?.slice(0, 28)}{t.title?.length > 28 ? '…' : ''}"</span>
                          <div style={{ fontSize: 10, color: 'var(--textDim)', marginTop: 3 }}>{formatTimeAgo(t.created_at)}</div>
                        </div>
                      </div>
                    )
                  })
            }
          </SectionCard>

          {/* Récompenses */}
          {user && profile && (
            <SectionCard style={{ padding: 0 }}>
              <SectionHeader>
                <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1 }}>Vos récompenses</span>
              </SectionHeader>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
                  {BADGES_DEF.map(b => {
                    const has = (profile.badges || []).includes(b.key)
                    return (
                      <div key={b.key} title={`${b.label}${has ? ' ✓' : ' (verrouillé)'}`}
                        style={{ width: 38, height: 38, borderRadius: '50%', background: has ? (b.bg || 'var(--accentBg)') : 'var(--surfaceB)', border: `2px solid ${has ? (b.color || 'var(--accentDk)') : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, opacity: has ? 1 : 0.28, transition: 'all .2s, transform .15s', cursor: has ? 'help' : 'default', filter: has ? 'none' : 'grayscale(100%)' }}
                        onMouseEnter={e => has && (e.currentTarget.style.transform = 'scale(1.15)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                        {b.emoji}
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--textMid)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>Niveau {profile.level || 1}</span>
                  <span>{(profile.xp || 0) % 1000} / 1000 XP</span>
                </div>
                <div style={{ height: 7, background: 'var(--surfaceB)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right, #f0c800, #c8a200)', borderRadius: 99, transition: 'width .6s cubic-bezier(.25,.46,.45,.94)' }} />
                </div>
              </div>
            </SectionCard>
          )}

          {/* Annonces */}
          <SectionCard>
            <SectionHeader>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: 1 }}>📢 Annonces</span>
            </SectionHeader>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--accentBg)', border: '1px solid rgba(200,162,0,.25)', borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accentTxt)', marginBottom: 4 }}>🎉 Bienvenue sur WeMoved !</div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, opacity: .85 }}>La communauté est lancée. Créez votre profil et participez !</div>
              </div>
              <div style={{ padding: '2px 2px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3, color: 'var(--text)' }}>Nouveau système de badges !</div>
                <div style={{ fontSize: 12, color: 'var(--textMid)', lineHeight: 1.5 }}>Découvrez-les dans votre profil.</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}