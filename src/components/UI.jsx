import { C, ROLES } from '../lib/constants'

export const Av = ({ u, size = 38 }) => (
  <div style={{ width: size, height: size, borderRadius: 4, flexShrink: 0, background: '#444', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * .28, color: '#fff', letterSpacing: .5 }}>
    {u.initials}
  </div>
)

export const Dot = ({ on, size = 9 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: on ? C.online : '#bbb', border: `2px solid ${C.white}`, animation: on ? 'pulse 2.5s infinite' : 'none' }} />
)

export const RoleBadge = ({ role }) => {
  const r = ROLES[role] || ROLES.membre
  return <span style={{ padding: '1px 7px', borderRadius: 2, fontSize: 10, fontWeight: 700, color: r.color, background: r.bg, border: `1px solid ${r.color}44`, whiteSpace: 'nowrap' }}>{r.short}</span>
}

export const CatBadge = ({ cat }) => (
  <span style={{ padding: '2px 7px', borderRadius: 2, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, background: '#f0f0f0', color: C.textMid, border: '1px solid #ddd' }}>{cat}</span>
)

export const Chip = ({ label }) => (
  <span className="chip" style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#f5f5f5', color: C.textMid, border: '1px solid #ddd', display: 'inline-block', transition: 'all .2s' }}>{label}</span>
)

export const Section = ({ title, children, extra = null, style = {} }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 3, marginBottom: 12, overflow: 'hidden', ...style }}>
    {title && (
      <div style={{ padding: '9px 16px', borderBottom: `1px solid ${C.border}`, background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: .5 }}>{title}</span>
        {extra}
      </div>
    )}
    <div style={{ padding: '14px 16px' }}>{children}</div>
  </div>
)

export const Btn = ({ onClick, children, style = {}, variant = 'yellow' }) => {
  const base = { border: 'none', borderRadius: 3, fontWeight: 700, fontSize: 12, padding: '6px 16px', cursor: 'pointer', fontFamily: "'Open Sans',sans-serif", transition: 'all .15s' }
  const v = {
    yellow: { background: `linear-gradient(to bottom,#f0c800,#c8a200)`, border: '1px solid #b89000', color: '#3a2e00' },
    ghost:  { background: C.white, border: `1px solid ${C.borderMid}`, color: C.textMid },
    red:    { background: '#c0392b', border: '1px solid #922b21', color: '#fff' },
    blue:   { background: '#1a3c6b', border: '1px solid #102a4c', color: '#fff' },
    green:  { background: '#1a5c30', border: '1px solid #10401f', color: '#fff' },
  }
  return <button onClick={onClick} style={{ ...base, ...v[variant], ...style }}>{children}</button>
}

export const Input = ({ value, onChange, placeholder, style = {}, ...props }) => (
  <input className="wmi" value={value} onChange={onChange} placeholder={placeholder}
    style={{ border: `1px solid ${C.borderMid}`, borderRadius: 2, padding: '7px 10px', fontSize: 13, color: C.text, background: C.white, fontFamily: "'Open Sans',sans-serif", transition: 'all .2s', ...style }}
    {...props} />
)

export const Textarea = ({ value, onChange, placeholder, rows = 4 }) => (
  <textarea className="wmi" value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{ width: '100%', border: `1px solid ${C.borderMid}`, borderRadius: 2, padding: '7px 10px', fontSize: 13, color: C.text, background: C.white, fontFamily: "'Open Sans',sans-serif", resize: 'vertical', lineHeight: 1.6, transition: 'all .2s' }} />
)
