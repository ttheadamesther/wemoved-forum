import { C, ROLES } from '../lib/constants'

export const Av = ({ u, size = 38 }) => {
  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const color = colors[(u?.pseudo?.charCodeAt(0) || u?.initials?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: u?.avatar_url ? '#444' : color, border: '2px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * .32, color: '#fff', letterSpacing: .5 }}>
      {u?.avatar_url
        ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : u?.initials || '??'
      }
    </div>
  )
}

export const Dot = ({ on, size = 9 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: on ? C.online : '#bbb', border: `2px solid ${C.white}`, animation: on ? 'pulse 2.5s infinite' : 'none' }} />
)

export const RoleBadge = ({ role }) => {
  const r = ROLES[role] || ROLES.membre
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: r.color, background: r.bg, border: `1px solid ${r.color}44`, whiteSpace: 'nowrap', letterSpacing: .3 }}>{r.short}</span>
}

export const CatBadge = ({ cat }) => (
  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, background: '#fffae6', color: '#7a6200', border: '1px solid #c8a20044' }}>{cat}</span>
)

export const Chip = ({ label }) => (
  <span className="chip" style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: C.surfaceB, color: C.textMid, border: `1px solid ${C.border}`, display: 'inline-block', transition: 'all .2s' }}>{label}</span>
)

export const Section = ({ title, children, extra = null, style = {} }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)', ...style }}>
    {title && (
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceB, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8 }}>{title}</span>
        {extra}
      </div>
    )}
    <div style={{ padding: '14px 16px' }}>{children}</div>
  </div>
)

export const Btn = ({ onClick, children, style = {}, variant = 'yellow' }) => {
  const base = { border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Inter','Open Sans',sans-serif", transition: 'all .15s ease', letterSpacing: .3 }
  const v = {
    yellow: { background: `linear-gradient(135deg,#f0c800,#c8a200)`, border: '1px solid #b89000', color: '#3a2e00', boxShadow: '0 2px 8px rgba(200,162,0,.3)' },
    ghost:  { background: 'transparent', border: `1px solid ${C.borderMid}`, color: C.textMid },
    red:    { background: 'linear-gradient(135deg,#e74c3c,#c0392b)', border: '1px solid #922b21', color: '#fff', boxShadow: '0 2px 8px rgba(192,57,43,.3)' },
    blue:   { background: 'linear-gradient(135deg,#2980b9,#1a3c6b)', border: '1px solid #102a4c', color: '#fff', boxShadow: '0 2px 8px rgba(26,60,107,.3)' },
    green:  { background: 'linear-gradient(135deg,#27ae60,#1a5c30)', border: '1px solid #10401f', color: '#fff', boxShadow: '0 2px 8px rgba(26,92,48,.3)' },
  }
  return <button onClick={onClick} style={{ ...base, ...v[variant], ...style }}>{children}</button>
}

export const Input = ({ value, onChange, placeholder, style = {}, ...props }) => (
  <input className="wmi" value={value} onChange={onChange} placeholder={placeholder}
    style={{ border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, background: C.white, fontFamily: "'Inter','Open Sans',sans-serif", transition: 'all .2s', ...style }}
    {...props} />
)

export const Textarea = ({ value, onChange, placeholder, rows = 4 }) => (
  <textarea className="wmi" value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{ width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.text, background: C.white, fontFamily: "'Inter','Open Sans',sans-serif", resize: 'vertical', lineHeight: 1.6, transition: 'all .2s' }} />
)