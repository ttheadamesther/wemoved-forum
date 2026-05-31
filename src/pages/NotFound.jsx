import { useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontWeight: 700, fontSize: 32, color: C.text, marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 15, color: C.textMid, marginBottom: 24 }}>Cette page n'existe pas ou a été déplacée.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Retour
          </button>
          <button onClick={() => navigate('/')}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            🏠 Accueil
          </button>
        </div>
      </div>
    </div>
  )
}