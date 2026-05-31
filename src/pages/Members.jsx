import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Input } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

const ROLE_RING = {
  admin:      'avatar-ring-admin',
  manager:    'avatar-ring-manager',
  moderateur: 'avatar-ring-moderateur',
  animateur:  'avatar-ring-animateur',
  membre:     'avatar-ring-membre',
}

function LevelBadge({ level }) {
  const l = level || 1
  let cls = 'level-bronze'
  if (l >= 20) cls = 'level-diamond'
  else if (l >= 10) cls = 'level-gold'
  else if (l >= 5)  cls = 'level-silver'
  return <span className={`badge ${cls}`} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20 }}>Niv.{l}</span>
}

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

const AGE_RANGES = [
  { label: 'Tous âges', min: 0,  max: 999 },
  { label: '18–25 ans', min: 18, max: 25 },
  { label: '26–35 ans', min: 26, max: 35 },
  { label: '36–45 ans', min: 36, max: 45 },
  { label: '46+ ans',   min: 46, max: 999 },
]

export default function MembersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState('')
  const [region,  setRegion]    = useState('')
  const [dept,    setDept]      = useState('')
  const [city,    setCity]      = useState('')
  const [sexe,    setSexe]      = useState('')
  const [ageRange, setAgeRange] = useState(0) // index dans AGE_RANGES
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy]     = useState('recent') // recent | votes | friends

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

  const range = AGE_RANGES[ageRange]
  const hasFilters = region || dept || city || search || sexe || ageRange > 0 || onlineOnly

  let filtered = members.filter(u => {
    if (u.id === user?.id) return false
    const q = search.toLowerCase()
    if (q && !u.pseudo?.toLowerCase().includes(q)) return false
    if (region && u.region !== region) return false
    if (dept   && u.dept   !== dept)   return false
    if (city   && u.city   !== city)   return false
    if (sexe   && u.sexe   !== sexe)   return false
    if (onlineOnly && !u.online)       return false
    if (ageRange > 0) {
      const age = parseInt(u.age) || 0
      if (age < range.min || age > range.max) return false
    }
    return true
  })

  if (sortBy === 'votes') {
    filtered = [...filtered].sort((a, b) => {
      const va = Object.values(a.votes || {}).reduce((x, y) => x + y, 0)
      const vb = Object.values(b.votes || {}).reduce((x, y) => x + y, 0)
      return vb - va
    })
  } else if (sortBy === 'friends') {
    filtered = [...filtered].sort((a, b) => (b.friends || 0) - (a.friends || 0))
  }

  const resetFilters = () => { setSearch(''); setRegion(''); setDept(''); setCity(''); setSexe(''); setAgeRange(0); setOnlineOnly(false) }

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

      {/* Recherche + tri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un pseudo…" style={{ flex: 1, fontSize: 13, padding: '9px 14px', borderRadius: 10 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.text, background: C.white, fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="recent">📅 Récents</option>
          <option value="votes">🏆 Votes</option>
          <option value="friends">👥 Amis</option>
        </select>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>

          {/* Sexe */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Sexe</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: '', l: 'Tous' }, { v: 'homme', l: '👨 Homme' }, { v: 'femme', l: '👩 Femme' }, { v: 'autre', l: '🌈 Autre' }].map(o => (
                <button key={o.v} onClick={() => setSexe(o.v)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${sexe === o.v ? C.accentDk : C.border}`, background: sexe === o.v ? '#fffae6' : C.surfaceB, color: sexe === o.v ? C.accentTxt : C.textMid, fontSize: 12, fontWeight: sexe === o.v ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Âge */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Âge</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AGE_RANGES.map((r, i) => (
                <button key={i} onClick={() => setAgeRange(i)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${ageRange === i ? C.accentDk : C.border}`, background: ageRange === i ? '#fffae6' : C.surfaceB, color: ageRange === i ? C.accentTxt : C.textMid, fontSize: 12, fontWeight: ageRange === i ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* En ligne */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: onlineOnly ? 700 : 400 }}>
              <input type="checkbox" checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)} style={{ accentColor: C.accentDk, width: 16, height: 16 }} />
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.online }} />
              En ligne uniquement
            </label>
          </div>

          {/* Localisation */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Localisation</div>
            <GeoSelects region={region} dept={dept} city={city} onRegion={v => { setRegion(v); setDept(''); setCity('') }} onDept={v => { setDept(v); setCity('') }} onCity={setCity} />
          </div>

          {hasFilters && (
            <button onClick={resetFilters} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.borderMid}`, background: 'transparent', color: C.textMid, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill,minmax(140px,1fr))' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(u => {
              const votes = u.votes || {}
              const tot   = Object.values(votes).reduce((a, b) => a + b, 0)
              const te    = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
              const tv    = te && te[1] > 0 ? VOTES_DEF.find(v => v.key === te[0]) : null
              const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
              const avatarColor = colors[(u.pseudo?.charCodeAt(0) || 0) % colors.length]
              const ringClass = ROLE_RING[u.role] || ROLE_RING.membre
              return (
                <div key={u.id} onClick={() => navigate(`/members/${u.id}`)} className="lift"
                  style={{ background: u.banned ? '#fff8f8' : C.white, border: `1px solid ${u.banned ? '#f5c0c0' : C.border}`, borderRadius: 16, padding: '20px 14px 14px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : '#c8a200'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = u.banned ? '#f5c0c0' : C.border}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: u.banned ? '#e74c3c' : avatarColor, opacity: .8 }} />
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                    <div className={ringClass} style={{ width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: '50%', background: u.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? 18 : 22, color: '#fff', overflow: 'hidden', margin: '0 auto' }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.initials || u.pseudo?.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: u.online ? C.online : '#ccc', border: '2px solid #fff' }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 13, color: u.banned ? C.red : C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.pseudo}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                    <RoleBadge role={u.role} />
                    <LevelBadge level={u.level} />
                  </div>
                  {u.age && u.sexe && <div style={{ fontSize: 10, color: C.textMid, marginBottom: 3 }}>{u.age} ans · {u.sexe.charAt(0).toUpperCase() + u.sexe.slice(1)}</div>}
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
            Aucun membre trouvé avec ces filtres.
          </div>
        )}
      </div>
    </div>
  )
}