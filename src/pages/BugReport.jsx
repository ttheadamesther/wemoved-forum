import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { C } from '../lib/constants'
import { Btn, Input, Textarea } from '../components/UI'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function BugReport() {
  const { user, profile } = useAuth()
  const [title, setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  if (!user) return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px', textAlign: 'center', color: C.textDim }}>
      Connecte-toi pour signaler un bug.
    </div>
  )

  const submit = async () => {
    if (!title.trim() || !description.trim()) return
    setSending(true)
    await fetch(`${SUPABASE_URL}/rest/v1/bug_reports`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, title: title.trim(), description: description.trim(), status: 'ouvert' })
    })
    setSending(false)
    setSent(true)
    setTitle('')
    setDescription('')
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, color: '#ddd', marginBottom: 6 }}>🐛 Signaler un bug</h1>
        <p style={{ fontSize: 13, color: C.textDim }}>Décris le problème rencontré, on le corrigera dès que possible.</p>
      </div>

      {sent ? (
        <div style={{ background: '#1a5c30', border: '1px solid #2d7a45', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8 }}>Rapport envoyé !</div>
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>Merci pour ton retour, on va regarder ça.</div>
          <Btn onClick={() => setSent(false)} variant="ghost">Signaler un autre bug</Btn>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e8e0c8', borderTop: '3px solid #c8a200', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Titre du bug</div>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Le bouton Envoyer ne fonctionne pas…" style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Description</div>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décris le bug en détail : que s'est-il passé ? Sur quelle page ? Sur quel appareil ?" rows={5} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textDim }}>Signalé par @{profile?.pseudo}</span>
            <Btn onClick={submit} variant="yellow" style={{ opacity: (!title.trim() || !description.trim()) ? .5 : 1 }}>
              {sending ? '…' : '🐛 Envoyer le rapport'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}