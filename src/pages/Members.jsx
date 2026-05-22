import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Input } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function MembersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(false)
  const [members, setMembers] = useState([])
  const [search, setSearch]   = useState('')
  const [region, setRegion]   = useState('')
  const [dept,   setDept]     = useState('')
  const [city,   setCity]     = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setIsMobile(entry.contentRect.width < 600)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(data => { if (Array.isArray(data)) setMembers(data) })
  }, [])

  const filtered = members.filter(u => {
    if (u.id === user?.id) return false
    const q      = search.toLowerCase()
    const matchQ = !q      || u.pseudo?.toLowerCase().includes(q)
    const matchR = !region || u.region === region
    const matchD = !dept   || u.dept   === dept
    const matchC = !city   || u.city   === city
    return matchQ && matchR && matchD && matchC
  })

  const hasFilters = region || dept || city || search

  return (
    <div ref={containerRef} style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: isMobile ? 18 : 22, color: '#ddd', marginBottom: 2 }}>Membres</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>
            {filtered.length} membre{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowFilters(f => !f)} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${hasFilters ? C.accentDk : C.borderMid}`, background: hasFilters ? '#fffae6' : C.white, color: hasFilters ? C.accentTxt : C.textMid, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔍 Filtres {hasFilters && <span style={{ background: C.accentDk, color: '#3a2e00', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>!</span>}
        </button>
      </div>

      {/* Barre de recherche rapide */}
      <div style={{ marginBottom: 12 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Rechercher un pseudo…" style={{ width: '100%', fontSize: 14, padding: '10px 16px', borderRadius: 12, border: `1px solid ${C.borderMid}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }} />
      </div>

      {/* Filtres avancés */}
      {showFilters && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)', animation: 'fadein .2s ease' }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Filtrer par localisation</div>
          <GeoSelects region={region} dept={dept} city={city} onRegion={setRegion} onDept={setDept} onCity={setCity} />
          {hasFilters && (
            <button onClick={() => { setSearch(''); setRegion(''); setDept(''); setCity('') }} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.borderMid}`, background: 'transparent', color: C.textMid, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ✕ Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Grille membres */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill,minmax(140px,1fr))' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {filtered.map(u => {
          const votes = u.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
          const tot   = Object.values(votes).reduce((a, b) => a + b, 0)
          const te    = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
          const tv    = te && te[1] > 0 ? VOTES_DEF.find(v => v.key === te[0]) : null
          const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
          const avatarColor = colors[(u.pseudo?.charCodeAt(0) || 0) % colors.length]

          return (
            <div key={u.id} onClick={() => navigate(`/members/${u.id}`)} style={{
              background: u.banned ? '#fff8f8' : C.white,
              border: `1px solid ${u.banned ? '#f5c0c0' : C.border}`,
              borderRadius: 16,
              padding: '20px 14px 14px',
              cursor: 'pointer',
              transition: 'all .2s ease',
              textAlign: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,.04)',
              position: 'relative',
              overflow: 'hidden'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : '#c8a200' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.04)'; e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : C.border }}
            >
              {/* Bande colorée en haut */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: u.banned ? '#e74c3c' : avatarColor, opacity: .7 }} />

              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                <div style={{ width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: '50%', background: u.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? 18 : 22, color: '#fff', overflow: 'hidden', margin: '0 auto', border: '3px solid #fff', boxShadow: `0 0 0 2px ${avatarColor}44` }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.initials || u.pseudo?.slice(0, 2).toUpperCase()
                  }
                </div>
                {/* Dot en ligne */}
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: u.online ? C.online : '#ccc', border: '2px solid #fff' }} />
              </div>

              {/* Pseudo */}
              <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 13, color: u.banned ? C.red : C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.pseudo}</div>

              {/* Badge rôle */}
              <div style={{ marginBottom: 6 }}><RoleBadge role={u.role} /></div>

              {/* Infos */}
              {u.age && u.sexe && (
                <div style={{ fontSize: 10, color: C.textMid, marginBottom: 3 }}>
                  {u.age} ans · {u.sexe.charAt(0).toUpperCase() + u.sexe.slice(1)}
                </div>
              )}
              {u.city
              && <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>📍 {u.city}</div>}

              {u.banned && <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 6 }}>⛔ Banni</div>}

              {tv && !u.banned && (
                <div style={{ display: 'inline-block', background: '#fffae6', border: `1px solid ${C.accentDk}`, borderRadius: 20, padding: '2px 10px', marginBottom: 8, fontSize: 10, fontWeight: 700, color: C.accentTxt }}>
                  {tv.emoji} {tv.label}
                </div>
              )}

              {!u.banned && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.accentTxt }}>{u.friends || 0}</div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: .5 }}>Amis</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.accentTxt }}>{tot}</div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: .5 }}>Votes</div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: C.textDim, fontSize: 13, background: C.white, border: `1px solid ${C.border}`, borderRadius: 16 }}>
            Aucun membre trouvé.
          </div>
        )}
      </div>
    </div>
  )
}