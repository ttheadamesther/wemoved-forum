import { useState, useEffect } from 'react'
import { C, getRegions, getDepts } from '../lib/constants'

export const GeoBadge = ({ user }) => (
  <span style={{ fontSize: 11, color: C.textDim }}>
    📍 {[user.city, user.dept?.replace(/\s*\(\d+\)/, ''), user.region].filter(Boolean).join(' · ')}
  </span>
)

export const GeoSelects = ({ region, dept, city, onRegion, onDept, onCity }) => {
  const [villes, setVilles]     = useState([])
  const [loadingV, setLoadingV] = useState(false)

  useEffect(() => {
    if (!dept) { setVilles([]); return }
    // Extraire le numéro de département ex: "Charente (16)" → "16"
    const match = dept.match(/\((\d+[AB]?)\)/)
    if (!match) return
    const code = match[1]
    setLoadingV(true)
    fetch(`https://geo.api.gouv.fr/departements/${code}/communes?fields=nom&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVilles(data.map(c => c.nom).sort((a, b) => a.localeCompare(b, 'fr')))
        }
        setLoadingV(false)
      })
      .catch(() => setLoadingV(false))
  }, [dept])

  const sel = { width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 2, padding: '6px 8px', fontSize: 12, color: C.text, background: C.white, fontFamily: "'Open Sans',sans-serif" }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <select className="wmi" style={sel} value={region} onChange={e => { onRegion(e.target.value); onDept(''); onCity('') }}>
        <option value="">— Toutes régions —</option>
        {getRegions().map(r => <option key={r}>{r}</option>)}
      </select>
      <select className="wmi" style={sel} value={dept} onChange={e => { onDept(e.target.value); onCity('') }} disabled={!region}>
        <option value="">— Tous départements —</option>
        {getDepts(region).map(d => <option key={d}>{d}</option>)}
      </select>
      <select className="wmi" style={sel} value={city} onChange={e => onCity(e.target.value)} disabled={!dept || loadingV}>
        <option value="">{loadingV ? 'Chargement…' : '— Toutes villes —'}</option>
        {villes.map(v => <option key={v}>{v}</option>)}
      </select>
    </div>
  )
}