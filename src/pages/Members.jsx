import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Input } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

// Anneau coloré selon le rôle
const ROLE_RING = {
  admin:      'avatar-ring-admin',
  manager:    'avatar-ring-manager',
  moderateur: 'avatar-ring-moderateur',
  animateur:  'avatar-ring-animateur',
  membre:     'avatar-ring-membre',
}

// Niveau → badge visuel
function LevelBadge({ level }) {
  const l = level || 1
  let cls = 'level-bronze', label = `Niv.${l}`
  if (l >= 20) { cls = 'level-diamond'; }
  else if (l >= 10) { cls = 'level-gold'; }
  else if (l >= 5)  { cls = 'level-silver'; }
  return (
    <span className={`badge ${cls}`} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20 }}>{label}</span>
  )
}

// Skeleton card
function SkeletonCard() {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 14px 14px', textAlign: 'center', overflow: 'hidden', position: 'relative' }}>
      <div className="skeleton" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 }} />
      <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px' }} />
      <div className="skeleton" style={{ height: 13, width: '70%', margin: '0 auto 8px' }} />
      <div className="skeleton" style={{ height: 10, width: '40%', margin: '0 auto 12px' }} />
      <div className="skeleton" style={{ height: 10, width: '55%', margin: '0 auto 6px' }} />
      <div className="skeleton" style={{ height: 10, width: '45%', margin: '0 auto 14px' }} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div className="skeleton" style={{ height: 28, width: 36 }} />
        <div className="skeleton" style={{ height: 28, width: 36 }} />
      </div>
    </div>
  )
}

export default function MembersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [region, setRegion]     = useState('')
  const [dept,   setDept]       = useState('')
  const [city,   setCity]       = useState('')
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
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setMembers(data)
      setLoading(false)
    })
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
          <h1 style={{ fontWeight: 700, fontSize: isMobile ? 18 : 22, color: C.text, marginBottom: 2 }}>Membres</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>
            {loading ? 'Chargement…' : `${filtered.length} membre${filtered.length !== 1 ? 's' : ''} trouvé${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setShowFilters(f => !f)} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${hasFilters ? C.accentDk : C.borderMid}`, background: hasFilters ? '#fffae6' : C.white, color: hasFilters ? C.accentTxt : C.textMid, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔍 Filtres {hasFilters && <span style={{ background: C.accentDk, color: '#3a2e00', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>!</span>}
        </button>
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 12 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Rechercher un pseudo…" style={{ width: '100%', fontSize: 14, padding: '10px 16px', borderRadius: 12, border: `1px solid ${C.borderMid}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }} />
      </div>

      {/* Filtres */}
      {showFilters && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)', animation: 'fadein .2s ease' }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>Filtrer par localisation</div>
          <GeoSelects region={region} dept={dept} city={city} onRegion={setRegion} onDept={setDept} onCity={setCity} />
          {hasFilters && (
            <button onClick={() => { setSearch(''); setRegion(''); setDept(''); setCity('') }} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.borderMid}`, background: 'transparent', color: C.textMid, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ✕ Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill,minmax(140px,1fr))' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(u => {
              const votes = u.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
              const tot   = Object.values(votes).reduce((a, b) => a + b, 0)
              const te    = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
              const tv    = te && te[1] > 0 ? VOTES_DEF.find(v => v.key === te[0]) : null
              const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
              const avatarColor = colors[(u.pseudo?.charCodeAt(0) || 0) % colors.length]
              const ringClass = ROLE_RING[u.role] || ROLE_RING.membre

              return (
                <div key={u.id} onClick={() => navigate(`/members/${u.id}`)}
                  className="lift"
                  style={{
                    background: u.banned ? '#fff8f8' : C.white,
                    border: `1px solid ${u.banned ? '#f5c0c0' : C.border}`,
                    borderRadius: 16,
                    padding: '20px 14px 14px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: 'fadein .25s ease forwards',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : '#c8a200' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : C.border }}
                >
                  {/* Bande colorée en haut */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: u.banned ? '#e74c3c' : avatarColor, opacity: .8 }} />

                  {/* Avatar avec anneau rôle */}
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                    <div
                      className={ringClass}
                      style={{ width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: '50%', background: u.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? 18 : 22, color: '#fff', overflow: 'hidden', margin: '0 auto' }}
                    >
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : u.initials || u.pseudo?.slice(0, 2).toUpperCase()
                      }
                    </div>
                    {/* Dot online */}
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: u.online ? C.online : '#ccc', border: '2px solid #fff' }} />
                  </div>

                  {/* Pseudo */}
                  <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 13, color: u.banned ? C.red : C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.pseudo}</div>

                  {/* Badge rôle + niveau */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                    <RoleBadge role={u.role} />
                    <LevelBadge level={u.level} />
                  </div>

                  {/* Infos */}
                  {u.age && u.sexe && (
                    <div style={{ fontSize: 10, color: C.textMid, marginBottom: 3 }}>
                      {u.age} ans · {u.sexe.charAt(0).toUpperCase() + u.sexe.slice(1)}
                    </div>
                  )}
                  {u.city && <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>📍 {u.city}</div>}

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
            })
        }
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: C.textDim, fontSize: 13, background: C.white, border: `1px solid ${C.border}`, borderRadius: 16 }}>
            Aucun membre trouvé.
          </div>
        )}
      </div>
    </div>
  )
}