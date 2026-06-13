import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/ThemeContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

const COLORS = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
const avatarColor = (pseudo) => COLORS[(pseudo?.charCodeAt(0) || 0) % COLORS.length]

function getTimeLeft() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const diff = end - now
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${d}j ${h}h ${m}min`
}

function Avatar({ member, size = 40, onClick }) {
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', background: member?.avatar_url ? '#444' : avatarColor(member?.pseudo), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .32, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, cursor: onClick ? 'pointer' : 'default' }}>
      {member?.avatar_url ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : member?.initials || '??'}
    </div>
  )
}

function Podium({ members, voteKey }) {
  const sorted = [...members]
    .map(m => ({ ...m, count: m.votes?.[voteKey] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const order = [sorted[1], sorted[0], sorted[2]].filter(Boolean)
  const heights = [120, 160, 100]
  const medals = ['🥈', '🥇', '🥉']

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
      {order.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 20 }}>{medals[i]}</div>
          <Avatar member={m} size={44} />
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, maxWidth: 70, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{m.pseudo}</div>
          <div style={{ width: 70, height: heights[i], background: i === 1 ? 'linear-gradient(to top, #f0c800, #c8a200)' : C.surfaceB, border: `2px solid ${i === 1 ? '#c8a200' : C.border}`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: i === 1 ? '#3a2e00' : C.text }}>{m.count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Rankings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { dark } = useTheme()
  const [members,  setMembers]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [activeV,  setActiveV]  = useState(VOTES_DEF[0]?.key || 'mimi')
  const [tab,      setTab]      = useState('votes')
  const [timeLeft, setTimeLeft] = useState(getTimeLeft())

  // Couleurs adaptées au dark mode
  const highlightBg  = dark ? '#2a2400' : '#fffae6'
  const highlightBorder = C.accentDk
  const highlightText   = dark ? '#f0c800' : '#7a6200'

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMembers(d)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft()), 60000)
    return () => clearInterval(interval)
  }, [])

  const currentVote = VOTES_DEF.find(v => v.key === activeV)
  const ranked = [...members]
    .map(m => ({ ...m, count: m.votes?.[activeV] || 0 }))
    .sort((a, b) => b.count - a.count)

  const topXP      = [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0))
  const topFriends = [...members].sort((a, b) => (b.friends || 0) - (a.friends || 0))
  const topPosts   = [...members].sort((a, b) => (b.posts || 0) - (a.posts || 0))

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Chargement…</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 28px 40px' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, color: C.text, marginBottom: 4 }}>🏆 Classements</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.textDim }}>Reset mensuel dans</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: highlightText, background: highlightBg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${highlightBorder}` }}>{timeLeft}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.surfaceB, borderRadius: 12, padding: 4 }}>
        {[
          { key: 'votes',    label: '🗳️ Votes' },
          { key: 'xp',       label: '⚡ XP' },
          { key: 'activity', label: '💬 Activité' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: tab === t.key ? C.white : 'transparent', color: tab === t.key ? C.text : C.textMid, fontWeight: tab === t.key ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'votes' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {VOTES_DEF.map(v => (
              <button key={v.key} onClick={() => setActiveV(v.key)}
                style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${activeV === v.key ? highlightBorder : C.border}`, background: activeV === v.key ? highlightBg : C.white, color: activeV === v.key ? highlightText : C.textMid, fontWeight: activeV === v.key ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>

          {ranked.filter(m => m.count > 0).length >= 2 && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 16px 0', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>{currentVote?.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: C.text, marginLeft: 8 }}>Top {currentVote?.label}</span>
              </div>
              <Podium members={members} voteKey={activeV} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranked.map((m, i) => (
              <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                style={{ background: i === 0 ? highlightBg : C.white, border: `1px solid ${i === 0 ? highlightBorder : C.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                  {i < 3 ? medals[i] : <span style={{ fontSize: 13, color: C.textDim }}>#{i + 1}</span>}
                </div>
                <Avatar member={m} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{m.pseudo}</span>
                    <RoleBadge role={m.role} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{m.city || ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: m.count > 0 ? C.accentTxt : C.textDim }}>{m.count}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>votes</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'xp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: highlightBg, border: `1px solid ${highlightBorder}`, borderRadius: 12, padding: '10px 16px', fontSize: 12, color: highlightText, marginBottom: 8 }}>
            ⚡ L'XP est permanent — il s'accumule au fil du temps.
          </div>
          {topXP.map((m, i) => (
            <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
              style={{ background: i === 0 ? highlightBg : C.white, border: `1px solid ${i === 0 ? highlightBorder : C.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                {i < 3 ? medals[i] : <span style={{ fontSize: 13, color: C.textDim }}>#{i + 1}</span>}
              </div>
              <Avatar member={m} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{m.pseudo}</span>
                  <RoleBadge role={m.role} />
                </div>
                <div style={{ height: 4, background: C.surfaceB, borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((m.xp || 0) % 1000) / 10)}%`, background: 'linear-gradient(to right, #f0c800, #c8a200)', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.accentTxt }}>{m.xp || 0}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>Niv.{m.level || 1}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>💬 Top Posteurs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topPosts.slice(0, 10).map((m, i) => (
                <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                  style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <span style={{ width: 24, textAlign: 'center', fontSize: i < 3 ? 16 : 12, color: C.textDim, fontWeight: 700 }}>{i < 3 ? medals[i] : `#${i+1}`}</span>
                  <Avatar member={m} size={32} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>@{m.pseudo}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#2ecc71' }}>{m.posts || 0}</span>
                  <span style={{ fontSize: 10, color: C.textDim }}>posts</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>👥 Top Sociaux</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topFriends.slice(0, 10).map((m, i) => (
                <div key={m.id} onClick={() => navigate(`/members/${m.id}`)}
                  style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <span style={{ width: 24, textAlign: 'center', fontSize: i < 3 ? 16 : 12, color: C.textDim, fontWeight: 700 }}>{i < 3 ? medals[i] : `#${i+1}`}</span>
                  <Avatar member={m} size={32} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>@{m.pseudo}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#3498db' }}>{m.friends || 0}</span>
                  <span style={{ fontSize: 10, color: C.textDim }}>amis</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}