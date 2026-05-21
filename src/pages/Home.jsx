import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { C, VOTES_DEF, CATS } from '../lib/constants'
import { RoleBadge } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

function apiFetch(path) {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  }).then(r => r.json())
}

const BADGES_DEF = [
  { key: 'flash',  emoji: '⚡', label: 'Early adopter' },
  { key: 'heart',  emoji: '❤️', label: 'Populaire' },
  { key: 'star',   emoji: '⭐', label: 'Contributeur' },
  { key: 'thumb',  emoji: '👍', label: 'Apprécié' },
  { key: 'fire',   emoji: '🔥', label: 'Top membre' },
]

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [members,    setMembers]    = useState([])
  const [threads,    setThreads]    = useState([])
  const [stats,      setStats]      = useState({ members: 0, threads: 0, messages: 0, online: 0 })
  const [topMembers, setTopMembers] = useState([])
  const [activity,   setActivity]   = useState([])
  const [newThread,  setNewThread]  = useState(false)
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [cat,        setCat]        = useState('Divers')
  const [posting,    setPosting]    = useState(false)

  useEffect(() => {
    // Membres
    apiFetch('/rest/v1/profiles?select=*&order=created_at.desc').then(d => {
      if (Array.isArray(d)) {
        setMembers(d)
        setStats(s => ({ ...s, members: d.length, online: d.filter(m => m.online).length }))
        // Top membres par votes totaux
        const sorted = [...d].sort((a, b) => {
          const va = Object.values(a.votes || {}).reduce((x, y) => x + y, 0)
          const vb = Object.values(b.votes || {}).reduce((x, y) => x + y, 0)
          return vb - va
        })
        setTopMembers(sorted.slice(0, 5))
      }
    })
    // Threads
    apiFetch('/rest/v1/threads?select=*,replies(count)&hidden=eq.false&order=created_at.desc&limit=6').then(d => {
      if (Array.isArray(d)) {
        setThreads(d)
        setStats(s => ({ ...s, threads: d.length }))
      }
    })
    // Activité récente (derniers threads + replies)
    apiFetch('/rest/v1/threads?select=id,title,author_id,created_at&order=created_at.desc&limit=5').then(d => {
      if (Array.isArray(d)) setActivity(d)
    })
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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16 }}>

      {/* ── SIDEBAR GAUCHE ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Top du mois */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🏆 TOP DU MOIS</span>
            <Link to="/members" style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>Voir tout →</Link>
          </div>
          {topMembers.map((m, i) => {
            const tv = getTopVoteType(m.votes)
            const tot = Object.values(m.votes || {}).reduce((a, b) => a + b, 0)
            return (
              <div key={m.id} onClick={() => navigate(`/members/${m.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: C.textMid, width: 16 }}>{i + 1}</span>
                <div style={{ width: 32, height: 32, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.initials}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{m.pseudo}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.accentTxt }}>{tot}</span>
                {tv && <span>{tv.emoji}</span>}
              </div>
            )
          })}
          <div onClick={() => navigate('/members')} style={{ padding: '10px 16px', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}>
            <span style={{ fontSize: 12, color: C.accentTxt, fontWeight: 700 }}>Voir le classement complet</span>
          </div>
        </div>

        {/* Membres en ligne */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.online, marginRight: 6 }} />
              MEMBRES EN LIGNE
            </span>
          </div>
          {members.filter(m => m.online).slice(0, 6).map(m => (
            <div key={m.id} onClick={() => navigate(`/members/${m.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ position: 'relative' }}>
                <div style={{ width: 32, height: 32, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                  {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.initials}
                </div>
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.online, border: '1px solid #fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.pseudo}</div>
                <div style={{ fontSize: 10, color: C.textMid }}><RoleBadge role={m.role} /></div>
              </div>
            </div>
          ))}
          <div onClick={() => navigate('/members')} style={{ padding: '8px 16px', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}>
            <span style={{ fontSize: 11, color: C.accentTxt, fontWeight: 700 }}>Voir tous les membres en ligne →</span>
          </div>
        </div>

        {/* Statistiques */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>STATISTIQUES</div>
          {[
            { icon: '👥', label: 'Membres',          value: stats.members },
            { icon: '💬', label: 'Discussions',       value: stats.threads },
            { icon: '✉️', label: 'Messages',          value: 0 },
            { icon: '🟢', label: 'Membres en ligne',  value: stats.online },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <span>{s.icon}</span>
              <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{s.label}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENU CENTRAL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Bouton nouvelle discussion */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, color: '#ddd', textTransform: 'uppercase', letterSpacing: 1 }}>Discussions récentes</h2>
          {user && (
            <button onClick={() => setNewThread(t => !t)} style={{ padding: '8px 16px', background: `linear-gradient(to bottom,#f0c800,#c8a200)`, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#3a2e00' }}>
              + Nouvelle discussion
            </button>
          )}
        </div>

        {/* Formulaire nouvelle discussion */}
        {newThread && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select value={cat} onChange={e => setCat(e.target.value)} style={{ padding: '6px 10px', borderRadius: 3, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.text, background: C.white }}>
                {CATS.filter(c => c !== 'Tous').map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la discussion…" style={{ flex: 1, padding: '6px 10px', borderRadius: 3, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.text, fontFamily: "'Open Sans',sans-serif" }} />
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Contenu…" rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 3, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.text, fontFamily: "'Open Sans',sans-serif", resize: 'vertical', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setNewThread(false)} style={{ padding: '6px 14px', borderRadius: 3, border: `1px solid ${C.borderMid}`, background: C.white, cursor: 'pointer', fontSize: 12, color: C.textMid }}>Annuler</button>
              <button onClick={postThread} disabled={posting} style={{ padding: '6px 14px', borderRadius: 3, border: 'none', background: `linear-gradient(to bottom,#f0c800,#c8a200)`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#3a2e00' }}>{posting ? '…' : 'Publier'}</button>
            </div>
          </div>
        )}

        {/* Liste des discussions */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `2px solid ${C.accent}`, fontWeight: 700, fontSize: 13, color: C.text, textTransform: 'uppercase', letterSpacing: .5 }}>
            DISCUSSIONS RÉCENTES
          </div>
          {threads.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: C.textDim, fontSize: 13 }}>Aucune discussion pour l'instant</div>
          )}
          {threads.map(t => {
            const author = getMember(t.author_id)
            return (
              <div key={t.id} onClick={() => navigate('/forum')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ flexShrink: 0 }}>
                  {t.pinned && <span style={{ fontSize: 16 }}>📌</span>}
                  {t.locked && <span style={{ fontSize: 16 }}>🔒</span>}
                  {!t.pinned && !t.locked && <span style={{ fontSize: 16 }}>💬</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: C.accent, color: '#3a2e00' }}>{t.cat}</span>
                    {t.pinned && <span style={{ fontSize: 10, color: C.accentTxt, fontWeight: 700 }}>ÉPINGLÉ</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: C.textMid }}>
                    {author ? `@${author.pseudo}` : 'Inconnu'} • {new Date(t.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, color: C.textMid, fontSize: 12 }}>
                  <span>💬 {t.replies?.[0]?.count || 0}</span>
                  <span>❤️ {t.likes || 0}</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {author?.avatar_url ? <img src={author.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : author?.initials || '?'}
                </div>
              </div>
            )
          })}
          <div onClick={() => navigate('/forum')} style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.accentTxt, fontWeight: 700 }}>Voir toutes les discussions →</span>
          </div>
        </div>

        {/* Catégories */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `2px solid ${C.accent}`, fontWeight: 700, fontSize: 13, color: C.text, textTransform: 'uppercase', letterSpacing: .5 }}>CATÉGORIES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { cat: 'Musique',    icon: '🎵', desc: 'Musique électronique, artistes, labels…' },
              { cat: 'Rencontres', icon: '💜', desc: 'Rencontrez, discutez, partagez…' },
              { cat: 'Culture',    icon: '🎭', desc: 'Cinéma, séries, livres, art…' },
              { cat: 'Lifestyle',  icon: '☕', desc: 'Mode de vie, bien-être, sport…' },
              { cat: 'Voyages',    icon: '✈️', desc: 'Destinations, bons plans…' },
              { cat: 'Divers',     icon: '💬', desc: 'Tout ce qui n\'entre pas ailleurs !' },
            ].map(c => (
              <div key={c.cat} onClick={() => navigate('/forum')} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
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
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, color: C.accent, lineHeight: 1, marginBottom: 8 }}>"</div>
          <p style={{ fontSize: 16, color: '#fff', fontWeight: 700, marginBottom: 6 }}>La communauté, c'est ce qui nous fait avancer.</p>
          <p style={{ fontSize: 13, color: '#aaa' }}>Restons respectueux, ouverts et bienveillants envers tous les membres.</p>
          <div style={{ fontSize: 32, color: C.accent, lineHeight: 1, marginTop: 8 }}>"</div>
        </div>
      </div>

      {/* ── SIDEBAR DROITE ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Activité récente */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13, color: C.text }}>ACTIVITÉ RÉCENTE</div>
          {activity.map(t => {
            const author = getMember(t.author_id)
            return (
              <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                  {author?.avatar_url ? <img src={author.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : author?.initials || '?'}
                </div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: C.accentTxt }}>@{author?.pseudo || 'Inconnu'}</span>
                  {' '}a créé le sujet{' '}
                  <span style={{ fontWeight: 700 }}>"{t.title}"</span>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{new Date(t.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Récompenses */}
        {user && profile && (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>VOS RÉCOMPENSES</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {BADGES_DEF.map(b => {
                const has = (profile.badges || []).includes(b.key)
                return (
                  <div key={b.key} title={b.label} style={{ width: 38, height: 38, borderRadius: '50%', background: has ? '#fffae6' : '#f5f5f5', border: `2px solid ${has ? C.accentDk : '#ddd'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: has ? 1 : 0.35, cursor: 'default' }}>
                    {b.emoji}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>Niveau {profile.level || 1}</span>
              <span>{(profile.xp || 0) % 1000} / 1000 XP</span>
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${xpPercent}%`, background: `linear-gradient(to right, #f0c800, #c8a200)`, borderRadius: 4, transition: 'width .5s' }} />
            </div>
          </div>
        )}

        {/* Annonces */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13, color: C.text }}>📢 ANNONCES</div>
          <div style={{ padding: 14 }}>
            <div style={{ background: '#fffae6', border: `1px solid ${C.accentDk}`, borderRadius: 4, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.accentTxt, marginBottom: 4 }}>🎉 Bienvenue sur Wemoved !</div>
              <div style={{ fontSize: 12, color: C.text }}>La communauté est lancée. Créez votre profil et participez !</div>
            </div>
            <div style={{ fontSize: 12, color: C.text, padding: '0 2px' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Nouveau système de badges disponible !</div>
              <div style={{ color: C.textMid }}>Découvrez-les dans votre profil.</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}