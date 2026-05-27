// ── Système XP & Badges ──────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export const BADGES_DEF = [
  { key: 'flash',    emoji: '⚡', label: 'Early adopter',   desc: 'Parmi les premiers membres' },
  { key: 'heart',    emoji: '❤️', label: 'Populaire',       desc: 'Reçu 10 votes' },
  { key: 'star',     emoji: '⭐', label: 'Contributeur',    desc: 'Posté 10 topics' },
  { key: 'thumb',    emoji: '👍', label: 'Apprécié',        desc: 'Reçu 50 votes' },
  { key: 'fire',     emoji: '🔥', label: 'Top membre',      desc: 'Reçu 100 votes' },
  { key: 'friend',   emoji: '🤝', label: 'Social',          desc: '5 amis acceptés' },
  { key: 'writer',   emoji: '✍️', label: 'Rédacteur',       desc: 'Posté 50 réponses' },
  { key: 'veteran',  emoji: '🎖️', label: 'Vétéran',        desc: 'Niveau 5 atteint' },
]

async function getToken() {
  try {
    const keys = Object.keys(localStorage)
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (authKey) {
      const data = JSON.parse(localStorage.getItem(authKey))
      if (data?.access_token) return data.access_token
    }
  } catch {}
  return ANON_KEY
}

async function getProfile(userId) {
  const token = await getToken()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
  })
  const d = await r.json()
  return d?.[0] || null
}

async function patchProfile(userId, body) {
  const token = await getToken()
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(body)
  })
}

function computeBadges(profile, extraStats = {}) {
  const currentBadges = profile.badges || []
  const newBadges = [...currentBadges]
  const totalVotes = Object.values(profile.votes || {}).reduce((a, b) => a + b, 0)
  const posts   = extraStats.posts   ?? profile.posts   ?? 0
  const replies = extraStats.replies ?? profile.replies ?? 0
  const friends = extraStats.friends ?? profile.friends ?? 0
  const level   = extraStats.level   ?? profile.level   ?? 1

  const checks = [
    { key: 'flash',   cond: true },
    { key: 'heart',   cond: totalVotes >= 10 },
    { key: 'thumb',   cond: totalVotes >= 50 },
    { key: 'fire',    cond: totalVotes >= 100 },
    { key: 'star',    cond: posts >= 10 },
    { key: 'friend',  cond: friends >= 5 },
    { key: 'writer',  cond: replies >= 50 },
    { key: 'veteran', cond: level >= 5 },
  ]

  checks.forEach(({ key, cond }) => {
    if (cond && !newBadges.includes(key)) newBadges.push(key)
  })

  return newBadges
}

function computeLevel(xp) {
  return Math.floor(xp / 1000) + 1
}

export async function awardXP(userId, amount, refreshProfile = null) {
  try {
    const profile = await getProfile(userId)
    if (!profile) return

    const newXP    = (profile.xp || 0) + amount
    const newLevel = computeLevel(newXP)
    const newBadges = computeBadges({ ...profile, level: newLevel })

    await patchProfile(userId, {
      xp:     newXP,
      level:  newLevel,
      badges: newBadges,
    })

    if (refreshProfile) await refreshProfile()
  } catch (e) {
    console.error('awardXP error:', e)
  }
}

export async function checkAndAwardBadges(userId, extraStats = {}, refreshProfile = null) {
  try {
    const profile = await getProfile(userId)
    if (!profile) return
    const newBadges = computeBadges(profile, extraStats)
    if (newBadges.length !== (profile.badges || []).length) {
      await patchProfile(userId, { badges: newBadges })
      if (refreshProfile) await refreshProfile()
    }
  } catch (e) {
    console.error('checkAndAwardBadges error:', e)
  }
}

export { SUPABASE_URL, ANON_KEY }