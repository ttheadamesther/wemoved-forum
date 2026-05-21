import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Btn, Input } from '../components/UI'
import { Dot } from '../components/UI'
import { GeoSelects } from '../components/GeoSelects'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function MembersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [search, setSearch]   = useState('')
  const [region, setRegion]   = useState('')
  const [dept,   setDept]     = useState('')
  const [city,   setCity]     = useState('')

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

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 19, color: '#555' }}>Membres</h1>
          <p style={{ fontSize: 12, color: C.textDim }}>
            {filtered.length} membre{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pseudo…" style={{ width: '100%' }} />
          <GeoSelects region={region} dept={dept} city={city} onRegion={setRegion} onDept={setDept} onCity={setCity} />
          {(region || dept || city || search) && (
            <div style={{ textAlign: 'right' }}>
              <Btn onClick={() => { setSearch(''); setRegion(''); setDept(''); setCity('') }} variant="ghost" style={{ fontSize: 11 }}>
                ✕ Réinitialiser
              </Btn>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 8 }}>
        {filtered.map(u => {
          const votes = u.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
          const tot   = Object.values(votes).reduce((a, b) => a + b, 0)
          const te    = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
          const tv    = te ? VOTES_DEF.find(v => v.key === te[0]) : null

          return (
            <div key={u.id} onClick={() => navigate(`/members/${u.id}`)} style={{
              background: u.banned ? '#fff8f8' : C.white,
              border: `1px solid ${u.banned ? '#f5c0c0' : C.border}`,
              borderRadius: 3, padding: '14px 12px', cursor: 'pointer',
              transition: 'all .2s', textAlign: 'center'
            }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                <div style={{ width: 42, height: 42, borderRadius: 4, background: '#444', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff', overflow: 'hidden', margin: '0 auto' }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.initials || u.pseudo?.slice(0, 2).toUpperCase()
                  }
                </div>
                <div style={{ position: 'absolute', bottom: 0, right: -2 }}><Dot on={u.online} /></div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: u.banned ? C.red : C.text, marginBottom: 2 }}>@{u.pseudo}</div>
              <div style={{ marginBottom: 5 }}><RoleBadge role={u.role} /></div>
              {u.city && <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>📍 {u.city}</div>}
              {u.banned && <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 8 }}>⛔ Banni</div>}
              {tot > 0 && !u.banned && tv && (
                <div style={{ display: 'inline-block', background: '#fffae6', border: `1px solid ${C.accentDk}`, borderRadius: 10, padding: '2px 8px', marginBottom: 8, fontSize: 10, fontWeight: 700, color: C.accentTxt }}>
                  {tv.emoji} {tv.label}
                </div>
              )}
              {!u.banned && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.accentTxt }}>{u.friends || 0}</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>AMIS</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.accentTxt }}>{tot}</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>VOTES</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 7 }}>
                <span style={{ fontSize: 10, color: u.online ? C.online : C.textDim }}>
                  {u.online ? '● En ligne' : '○ Hors ligne'}
                </span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: C.textDim, fontSize: 13, background: C.white, border: `1px solid ${C.border}`, borderRadius: 3 }}>
            Aucun membre trouvé.
          </div>
        )}
      </div>
    </div>
  )
}