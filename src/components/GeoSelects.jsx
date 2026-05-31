import { useState, useEffect } from 'react'
import { C, getRegions, getDepts } from '../lib/constants'

export const GeoBadge = ({ user }) => (
  <span style={{ fontSize: 11, color: C.textDim }}>
    📍 {[user.city, user.dept?.replace(/\s*\(\d+\)/, ''), user.region].filter(Boolean).join(' · ')}
  </span>
)

// Régions étrangères (pas de code dept → pas d'API geo.api.gouv.fr)
const FOREIGN_REGIONS = ['Belgique', 'Suisse', 'Luxembourg', 'Québec']

export const GeoSelects = ({ region, dept, city, onRegion, onDept, onCity }) => {
  const [villes,   setVilles]   = useState([])
  const [loadingV, setLoadingV] = useState(false)
  const isForeign = FOREIGN_REGIONS.includes(region)

  useEffect(() => {
    if (!dept || isForeign) { setVilles([]); return }
    const match = dept.match(/\((\d+[AB]?)\)/)
    if (!match) { setVilles([]); return }
    const code = match[1]
    setLoadingV(true)
    fetch(`https://geo.api.gouv.fr/departements/${code}/communes?fields=nom&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setVilles(data.map(c => c.nom).sort((a, b) => a.localeCompare(b, 'fr')))
        setLoadingV(false)
      })
      .catch(() => setLoadingV(false))
  }, [dept, isForeign])

  const sel = {
    width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 8,
    padding: '7px 10px', fontSize: 13, color: C.text, background: C.white,
    fontFamily: 'inherit'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Région */}
      <select style={sel} value={region} onChange={e => { onRegion(e.target.value); onDept(''); onCity('') }}>
        <option value="">— Toutes régions —</option>
        {getRegions().map(r => <option key={r}>{r}</option>)}
      </select>

      {/* Département — masqué si étranger sans depts */}
      {region && getDepts(region).length > 0 && (
        <select style={sel} value={dept} onChange={e => { onDept(e.target.value); onCity('') }}>
          <option value="">— Tous départements —</option>
          {getDepts(region).map(d => <option key={d}>{d}</option>)}
        </select>
      )}

      {/* Ville — champ libre pour étranger, select pour France */}
      {region && (
        isForeign ? (
          <input
            value={city}
            onChange={e => onCity(e.target.value)}
            placeholder="Ville (ex: Bruxelles)"
            style={{ ...sel, outline: 'none' }}
          />
        ) : dept ? (
          <select style={sel} value={city} onChange={e => onCity(e.target.value)} disabled={loadingV}>
            <option value="">{loadingV ? 'Chargement…' : '— Toutes villes —'}</option>
            {villes.map(v => <option key={v}>{v}</option>)}
          </select>
        ) : null
      )}
    </div>
  )
}