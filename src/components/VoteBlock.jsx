import { C, VOTES_DEF } from '../lib/constants'
import { Section, Btn } from './UI'

export default function VoteBlock({ votes, voted, onVote, isOwn }) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0)
  return (
    <Section title={`Votes · ${total} au total`}>
      {!isOwn && <p style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>Un seul vote par mention.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {VOTES_DEF.map(({ key, label, emoji }) => {
          const c = votes[key] || 0, on = voted[key], pct = total > 0 ? Math.round((c / total) * 100) : 0
          return (
            <div key={key} style={{ background: on ? '#fffdf0' : C.surfaceB, border: `1px solid ${on ? C.accentDk : C.border}`, borderRadius: 3, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 15 }}>{emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: on ? C.accentTxt : C.text }}>{label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: on ? C.accentTxt : C.textMid }}>{c}</span>
              </div>
              <div style={{ height: 4, background: '#e8e8e8', borderRadius: 2, marginBottom: 9, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: on ? C.accent : '#ccc', transition: 'width .4s' }} />
              </div>
              {!isOwn && (
                <button className={`vb${on ? ' on' : ''}`} onClick={() => onVote(key)}
                  style={{ width: '100%', padding: '5px 0', borderRadius: 2, cursor: 'pointer', border: `1px solid ${on ? C.accentDk : C.borderMid}`, background: on ? '#fffae6' : C.white, color: on ? C.accentTxt : C.textMid, fontSize: 12, fontFamily: "'Open Sans',sans-serif", fontWeight: on ? 700 : 400 }}>
                  {on ? '✓ Voté !' : 'Voter'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
