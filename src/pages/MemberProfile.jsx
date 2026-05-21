import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { C, VOTES_DEF } from '../lib/constants'
import { RoleBadge, Btn } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function MemberProfile() {
  const { id }       = useParams()
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [member, setMember]   = useState(null)
  const [myVotes, setMyVotes] = useState({})
  const [voting, setVoting]   = useState(null)
  const [loading, setLoading] = useState(true)

  const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}` }

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&limit=1`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(data => {
      if (data && data[0]) setMember(data[0])
      setLoading(false)
    })

    if (user) {
      fetch(`${SUPABASE_URL}/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&month_key=eq.${monthKey()}`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const v = {}
          data.forEach(d => { v[d.vote_type] = true })
          setMyVotes(v)
        }
      })
    }
  }, [id, user])

  const vote = async (voteType) => {
    if (!user || voting) return
    setVoting(voteType)

    if (myVotes[voteType]) {
      await fetch(`${SUPABASE_URL}/rest/v1/votes?from_id=eq.${user.id}&to_id=eq.${id}&vote_type=eq.${voteType}&month_key=eq.${monthKey()}`, {
        method: 'DELETE',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      })
      const newVotes = { ...member.votes, [voteType]: Math.max(0, (member.votes?.[voteType] || 0) - 1) }
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ votes: newVotes })
      })
      setMember(m => ({ ...m, votes: newVotes }))
      setMyVotes(v => ({ ...v, [voteType]: false }))
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/votes`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_id: user.id, to_id: id, vote_type: voteType, month_key: monthKey() })
      })
      const newVotes = { ...member.votes, [voteType]: (member.votes?.[voteType] || 0) + 1 }
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ votes: newVotes })
      })
      setMember(m => ({ ...m, votes: newVotes }))
      setMyVotes(v => ({ ...v, [voteType]: true }))
    }
    setVoting(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Chargement…</div>
  if (!member) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Membre introuvable</div>

  const votes      = member.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const sexeLabel  = member.sexe
    ? member.sexe.charAt(0).toUpperCase() + member.sexe.slice(1)
    : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

      <Btn onClick={() => navigate('/members')} variant="ghost" style={{ marginBottom: 12, fontSize: 12 }}>← Retour</Btn>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 24, marginBottom: 12, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 80, height: 80, borderRadius: 4, background: '#444', border: '2px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 28, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : member.initials || member.pseudo?.slice(0, 2).toUpperCase()
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: C.text }}>@{member.pseudo}</span>
            <RoleBadge role={member.role} />
          </div>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>
            Membre depuis {member.joined}
            {member.age  && ` · ${member.age} ans`}
            {sexeLabel   && ` · ${sexeLabel}`}
          </div>
          {member.city && (
            <div style={{ fontSize: 12, color: C.textMid }}>
              📍 {member.city}{member.dept ? `, ${member.dept}` : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Bio</div>
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>
            {member.bio || <span style={{ color: C.textDim, fontStyle: 'italic' }}>Aucune bio</span>}
          </p>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Amis',        value: member.friends || 0 },
              { label: 'Posts',       value: member.posts   || 0 },
              { label: 'Votes reçus', value: totalVotes },
              { label: 'Âge',         value: member.age     || '—' },
            ].map(s => (
              <div key={s.label} style={{ background: C.surfaceB, borderRadius: 3, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: C.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textMid }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Voter ce mois</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {VOTES_DEF.map(v => {
              const voted = myVotes[v.key]
              const count = votes[v.key] || 0
              return (
                <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, textAlign: 'center' }}>{v.emoji}</span>
                  <span style={{ fontSize: 12, color: C.textMid, flex: 1 }}>{v.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text, minWidth: 24, textAlign: 'right' }}>{count}</span>
                  {user && (
                    <button onClick={() => vote(v.key)} disabled={!!voting} style={{
                      padding: '3px 10px', borderRadius: 3, border: `1px solid ${voted ? C.accentDk : C.borderMid}`,
                      background: voted ? C.accent : C.white, color: voted ? '#3a2e00' : C.textMid,
                      fontWeight: voted ? 700 : 400, fontSize: 11, cursor: 'pointer', transition: 'all .15s'
                    }}>
                      {voting === v.key ? '…' : voted ? '✓ Voté' : 'Voter'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {!user && <p style={{ fontSize: 11, color: C.textDim, marginTop: 10, fontStyle: 'italic' }}>Connecte-toi pour voter</p>}
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Intérêts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(member.interests || []).length === 0
              ? <span style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>Aucun intérêt</span>
              : (member.interests || []).map(i => (
                <span key={i} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#f5f5f5', color: C.textMid, border: '1px solid #ddd' }}>{i}</span>
              ))
            }
          </div>
        </div>

      </div>

      {(member.photos || []).length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {(member.photos || []).map((url, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 3, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}