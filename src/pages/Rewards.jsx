import { C, VOTES_DEF } from '../lib/constants'
import { useAuth } from '../hooks/useAuth'

const LEVELS = [
  { level: 1, xp: 0,    label: 'Nouveau',    emoji: '🌱', color: '#6b7280' },
  { level: 2, xp: 1000, label: 'Actif',       emoji: '⚡', color: '#3b82f6' },
  { level: 3, xp: 2000, label: 'Régulier',    emoji: '🔥', color: '#8b5cf6' },
  { level: 4, xp: 4000, label: 'Confirmé',    emoji: '💎', color: '#ec4899' },
  { level: 5, xp: 7000, label: 'Expert',      emoji: '👑', color: '#f59e0b' },
  { level: 6, xp: 12000, label: 'Légende',   emoji: '🌟', color: '#c8a200' },
]

const XP_ACTIONS = [
  { action: 'Poster un message sur le forum',    xp: 5,  icon: '💬' },
  { action: 'Recevoir un vote',                  xp: 2,  icon: '🏆' },
  { action: 'Ajouter un ami',                    xp: 15, icon: '👥' },
  { action: 'Accepter une demande d\'ami',       xp: 15, icon: '✅' },
  { action: 'Compléter son profil',              xp: 20, icon: '👤' },
  { action: 'Recevoir un like sur une photo',    xp: 1,  icon: '❤️' },
]

const BADGES = [
  { id: 'first_post',    label: 'Premier pas',     desc: 'Poster ton premier message',        emoji: '🐣', color: '#3b82f6' },
  { id: 'popular',       label: 'Populaire',        desc: 'Recevoir 10 votes au total',        emoji: '⭐', color: '#f59e0b' },
  { id: 'social',        label: 'Sociable',         desc: 'Avoir 5 amis',                      emoji: '🤝', color: '#10b981' },
  { id: 'photogenic',    label: 'Photogénique',     desc: 'Avoir 10 likes sur tes photos',     emoji: '📸', color: '#ec4899' },
  { id: 'veteran',       label: 'Vétéran',          desc: 'Être inscrit depuis 1 an',          emoji: '🎖️', color: '#8b5cf6' },
  { id: 'top_mimi',      label: 'Top Mimi',         desc: 'Être le + voté Mimi du mois',       emoji: '🥰', color: '#f43f5e' },
  { id: 'top_cool',      label: 'Top Cool',         desc: 'Être le + voté Cool du mois',       emoji: '😎', color: '#06b6d4' },
  { id: 'contributor',   label: 'Contributeur',     desc: 'Poster 50 messages',                emoji: '✍️', color: '#c8a200' },
]

const ROLES = [
  { value: 'membre',     label: 'Membre',      color: '#555',    bg: '#eee',    desc: 'Rôle de base attribué à l\'inscription.' },
  { value: 'animateur',  label: 'Animateur',   color: '#1a3c6b', bg: '#dce8ff', desc: 'Anime la communauté, crée du contenu.' },
  { value: 'moderateur', label: 'Modérateur',  color: '#1a5c30', bg: '#d4f0e0', desc: 'Modère les contenus et gère les signalements.' },
  { value: 'manager',    label: 'Manager',     color: '#5a0080', bg: '#f3e0ff', desc: 'Gère les équipes et les événements.' },
  { value: 'admin',      label: 'Admin',       color: '#7a5500', bg: '#fff8dc', desc: 'Accès complet à la plateforme.' },
]

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      {title}
    </h2>
    {children}
  </div>
)

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)', ...style }}>
    {children}
  </div>
)

export default function Rewards() {
  const { profile } = useAuth()
  const xp = profile?.xp || 0
  const level = profile?.level || 1
  const currentLevel = LEVELS.find(l => l.level === level) || LEVELS[0]
  const nextLevel = LEVELS.find(l => l.level === level + 1)
  const xpToNext = nextLevel ? nextLevel.xp - xp : null
  const xpPercent = nextLevel ? Math.min(100, ((xp - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100) : 100

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 40px' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 6 }}>🏆 Système de récompenses</h1>
        <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>
          Gagne de l'XP en étant actif, monte en niveau et débloque des badges. Plus tu participes, plus tu évolues dans la communauté.
        </p>
      </div>

      {/* Ton niveau actuel */}
      {profile && (
        <Card style={{ marginBottom: 28, borderTop: `4px solid ${currentLevel.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 40 }}>{currentLevel.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 2 }}>Ton niveau actuel</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: currentLevel.color }}>Niveau {level} — {currentLevel.label}</div>
              <div style={{ fontSize: 13, color: C.textMid }}>{xp} XP au total</div>
            </div>
            {nextLevel && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: C.textDim }}>Prochain niveau</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{nextLevel.emoji} Niv.{nextLevel.level}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{xpToNext} XP restants</div>
              </div>
            )}
          </div>
          <div style={{ height: 8, background: C.surfaceB, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${xpPercent}%`, background: `linear-gradient(to right, ${currentLevel.color}88, ${currentLevel.color})`, borderRadius: 8, transition: 'width .5s' }} />
          </div>
          {nextLevel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: C.textDim }}>Niv.{level} — {currentLevel.xp} XP</span>
              <span style={{ fontSize: 10, color: C.textDim }}>Niv.{nextLevel.level} — {nextLevel.xp} XP</span>
            </div>
          )}
        </Card>
      )}

      {/* Niveaux */}
      <Section title="📈 Les niveaux">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LEVELS.map((l, i) => {
            const isCurrentLevel = profile?.level === l.level
            const isUnlocked = (profile?.level || 1) >= l.level
            return (
              <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: isCurrentLevel ? `${l.color}15` : C.white, border: `1px solid ${isCurrentLevel ? l.color : C.border}`, borderRadius: 12, opacity: isUnlocked ? 1 : 0.5 }}>
                <div style={{ fontSize: 28, width: 40, textAlign: 'center' }}>{l.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: l.color }}>Niveau {l.level}</span>
                    <span style={{ fontSize: 13, color: C.text }}>{l.label}</span>
                    {isCurrentLevel && <span style={{ fontSize: 10, background: l.color, color: '#fff', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Ton niveau</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Requis : {l.xp.toLocaleString()} XP</div>
                </div>
                {isUnlocked && <span style={{ fontSize: 18 }}>✅</span>}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Gagner de l'XP */}
      <Section title="⚡ Comment gagner de l'XP">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {XP_ACTIONS.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500, lineHeight: 1.4 }}>{a.action}</div>
              </div>
              <div style={{ background: '#fffae6', border: '1px solid #c8a200', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#7a6200' }}>+{a.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Votes */}
      <Section title="🗳️ Les votes">
        <Card>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
            Chaque mois, les membres peuvent voter pour toi dans 4 catégories. Les votes te rapportent de l'XP et contribuent à ton classement mensuel.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {VOTES_DEF.map(v => (
              <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surfaceB, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 24 }}>{v.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>+2 XP par vote reçu</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fffae6', border: '1px solid #c8a200', borderRadius: 10, fontSize: 12, color: '#7a6200' }}>
            💡 Les votes se remettent à zéro chaque mois — reste actif pour rester en tête !
          </div>
        </Card>
      </Section>

      {/* Badges */}
      <Section title="🎖️ Les badges">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {BADGES.map(b => {
            const unlocked = (profile?.badges || []).includes(b.id)
            return (
              <div key={b.id} style={{ padding: '16px 14px', background: C.white, border: `1px solid ${unlocked ? b.color : C.border}`, borderRadius: 14, textAlign: 'center', opacity: unlocked ? 1 : 0.6, position: 'relative', overflow: 'hidden' }}>
                {unlocked && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 12 }}>✅</div>}
                <div style={{ fontSize: 32, marginBottom: 8, filter: unlocked ? 'none' : 'grayscale(100%)' }}>{b.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: unlocked ? b.color : C.textMid, marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{b.desc}</div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Rôles */}
      <Section title="🛡️ Les rôles">
        <Card>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
            Les rôles sont attribués par les administrateurs en fonction de ton implication dans la communauté. Ils ne s'obtiennent pas automatiquement.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ROLES.map(r => (
              <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surfaceB, borderRadius: 10 }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: r.color, background: r.bg, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: C.textMid }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

    </div>
  )
}