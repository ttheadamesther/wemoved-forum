import { C, VOTES_DEF, monthLabel } from '../lib/constants'
import { Av } from './UI'
import { Section } from './UI'
import { useCountdown } from '../hooks/useCountdown'

export default function TopRankings({ allVotes, allUsers, onView }) {
  const cd = useCountdown()
  const winners = VOTES_DEF.map(v => {
    const ranked = allUsers.map(u => ({ u, c: (allVotes[u.id] || u.votes)[v.key] || 0 })).sort((a, b) => b.c - a.c)
    return { v, w: ranked[0], r2: ranked[1] }
  })

  return (
    <Section
      title={`🏆 Tops du mois — ${monthLabel()}`}
      extra={<span style={{ fontSize: 11, color: C.textDim }}>Reset dans <strong style={{ color: C.accentTxt }}>{cd}</strong></span>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {winners.map(({ v, w, r2 }) => (
          <div key={v.key} className="rc" onClick={() => onView(w.u)} style={{ background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 3, padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
              <span style={{ fontSize: 15 }}>{v.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: C.accentTxt, textTransform: 'uppercase', letterSpacing: .5 }}>{v.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Av u={w.u} size={38} />
                <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 12 }}>👑</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{w.u.pseudo}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{w.u.city}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: C.accentTxt }}>{w.c}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>votes</div>
              </div>
            </div>
            {r2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.white, border: `1px solid ${C.border}`, borderRadius: 2, padding: '4px 8px' }}>
                <Av u={r2.u} size={18} />
                <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>2. @{r2.u.pseudo}</span>
                <span style={{ fontSize: 11, color: C.textDim }}>{r2.c}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
