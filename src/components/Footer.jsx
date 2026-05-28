import { Link } from 'react-router-dom'
import { C } from '../lib/constants'

export default function Footer() {
  return (
    <footer style={{
      marginTop: 'auto',
      borderTop: `1px solid ${C.border}`,
      padding: '20px 16px',
      textAlign: 'center',
      fontSize: 11,
      color: C.textDim,
      background: C.surfaceB
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px 20px' }}>
        <span>© {new Date().getFullYear()} WeMoved — Anthony Bocquez</span>
        <span style={{ color: C.border }}>|</span>
        <Link to="/legal" style={{ color: C.textDim, textDecoration: 'none', fontWeight: 600 }}
          onMouseEnter={e => e.currentTarget.style.color = C.accentTxt}
          onMouseLeave={e => e.currentTarget.style.color = C.textDim}
        >
          Mentions légales & Confidentialité
        </Link>
        <span style={{ color: C.border }}>|</span>
        <Link to="/legal#cgu" style={{ color: C.textDim, textDecoration: 'none', fontWeight: 600 }}
          onMouseEnter={e => e.currentTarget.style.color = C.accentTxt}
          onMouseLeave={e => e.currentTarget.style.color = C.textDim}
        >
          CGU
        </Link>
        <span style={{ color: C.border }}>|</span>
        <span>Hébergé par Vercel · Données sur Supabase</span>
      </div>
    </footer>
  )
}