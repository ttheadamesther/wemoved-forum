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
  if (!member) return <div style={{ padding: 40, textAlign: 'center', color: C.textMid }}>Profil introuvable</div>

  const votes      = member.votes || { mimi: 0, cool: 0, sexy: 0, loose: 0 }
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
  const sexeLabel  = member.sexe ? member.sexe.charAt(0).toUpperCase() + member.sexe.slice(1) : null

  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(member.pseudo?.charCodeAt(0) || 0) % colors.length]
  const initials = member.initials || member.pseudo?.slice(0, 2).toUpperCase() || '??'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

      <Btn onClick={() => navigate('/members')} variant="ghost" style={{ marginBottom: 16, fontSize: 12 }}>← Retour</Btn>

      {/* Bannière + Avatar */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        {/* Bannière */}
        <div style={{ height: 160, background: member.banner_url ? `url(${member.banner_url}) center/cover no-repeat` : 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', position: 'relative' }} />

        {/* Avatar + infos */}
        <div style={{ padding: '0 24px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* Avatar */}
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: member.avatar_url ? '#444' : avatarColor, border: '4px solid #fff', marginTop: -45, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,.15)' }}>
              {member.avatar_url
                ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : initials
              }
            </div>

            {/* Bouton envoyer un message */}
            {user && user.id !== id && (
              <Btn onClick={() => navigate('/messages')} variant="yellow" style={{ fontSize: 12 }}>
                ✉️ Envoyer un message
              </Btn>
            )}
          </div>

          {/* Nom + role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontWeight: 700, fontSize: 20, color: C.text, margin: 0 }}>@{member.pseudo}</h1>
            <RoleBadge role={member.role} />
            {member.online && <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 600 }}>● En ligne</span>}
          </div>

          {/* Infos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {member.joined  && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>📅 {member.joined}</span>}
            {member.age     && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🎂 {member.age} ans</span>}
            {sexeLabel      && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>👤 {sexeLabel}</span>}
            {member.city    && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>📍 {member.city}</span>}
            {member.dept    && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🗺 {member.dept}</span>}
            {member.region  && <span style={{ fontSize: 12, color: C.textMid, background: C.surfaceB, padding: '3px 10px', borderRadius: 20 }}>🌍 {member.region}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'AMIS',        value: member.friends || 0, color: '#3498db', bg: '#eaf4fd' },
          { label: 'POSTS',       value: member.posts   || 0, color: '#2ecc71', bg: '#eafaf1' },
          { label: 'VOTES REÇUS', value: totalVotes,          color: C.accentTxt, bg: '#fffae6' },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)', borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontWeight: 700, fontSize: 28, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bio */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>🔥 Bio</div>
        <p style={{ fontSize: 13, color: member.bio ? C.textMid : C.textDim, lineHeight: 1.7, margin: 0, fontStyle: member.bio ? 'normal' : 'italic' }}>
          {member.bio || 'Aucune bio renseignée.'}
        </p>
      </div>

      {/* Votes */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 14 }}>🏆 Votes reçus</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {VOTES_DEF.map(v => {
            const voted = myVotes[v.key]
            const count = votes[v.key] || 0
            return (
              <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surfaceB, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 20 }}>{v.emoji}</span>
                <span style={{ fontSize: 13, color: C.textMid, flex: 1, fontWeight: 500 }}>{v.label}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.text, minWidth: 28, textAlign: 'right' }}>{count}</span>
                {user && user.id !== id && (
                  <button onClick={() => vote(v.key)} disabled={!!voting} style={{
                    padding: '5px 14px', borderRadius: 20,
                    border: `1px solid ${voted ? C.accentDk : C.borderMid}`,
                    background: voted ? '#fffae6' : C.white,
                    color: voted ? C.accentTxt : C.textMid,
                    fontWeight: voted ? 700 : 400, fontSize: 12,
                    cursor: voting ? 'wait' : 'pointer',
                    transition: 'all .15s', fontFamily: 'inherit'
                  }}>
                    {voting === v.key ? '…' : voted ? '✓ Voté' : 'Voter'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {!user && <p style={{ fontSize: 12, color: C.textDim, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>Connecte-toi pour voter</p>}
      </div>

      {/* Intérêts */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>🎯 Intérêts</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(member.interests || []).length === 0
            ? <span style={{ fontSize: 13, color: C.textDim, fontStyle: 'italic' }}>Aucun intérêt renseigné.</span>
            : (member.interests || []).map(i => (
              <span key={i} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, background: '#fffae6', color: C.accentTxt, border: `1px solid ${C.accentDk}`, fontWeight: 600 }}>{i}</span>
            ))
          }
        </div>
      </div>

      {/* Photos */}
      {(member.photos || []).length > 0 && (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.accentDk}`, borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>📸 Photos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {(member.photos || []).map((url, i) => (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
