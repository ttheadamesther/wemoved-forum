import { C, GEO, getRegions, getDepts, getVilles } from '../lib/constants'

export const GeoBadge = ({ user }) => (
  <span style={{ fontSize: 11, color: C.textDim }}>
    📍 {[user.city, user.dept?.replace(/\s*\(\d+\)/, ''), user.region].filter(Boolean).join(' · ')}
  </span>
)

export const GeoSelects = ({ region, dept, city, onRegion, onDept, onCity }) => {
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
      <select className="wmi" style={sel} value={city} onChange={e => onCity(e.target.value)} disabled={!dept}>
        <option value="">— Toutes villes —</option>
        {getVilles(region, dept).map(v => <option key={v}>{v}</option>)}
      </select>
    </div>
  )
}
