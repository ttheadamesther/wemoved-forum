import { C } from '../lib/constants'

export default function Notifications() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontWeight: 700, fontSize: 19, color: '#555', marginBottom: 16 }}>Notifications</h1>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 24, textAlign: 'center', color: C.textDim, fontSize: 13, fontStyle: 'italic' }}>
        Aucune notification pour l'instant
      </div>
    </div>
  )
}