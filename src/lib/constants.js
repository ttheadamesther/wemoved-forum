// ─── ROLES ───────────────────────────────────────────────────────────────────
export const ROLES = {
  admin:      { label: "Administrateur", short: "Admin",      color: "#7a5500", bg: "#fff8dc", rank: 4 },
  manager:    { label: "Manager",        short: "Manager",    color: "#5a0080", bg: "#f3e0ff", rank: 3 },
  moderateur: { label: "Modérateur",     short: "Modérateur", color: "#1a5c30", bg: "#d4f0e0", rank: 2 },
  animateur:  { label: "Animateur",      short: "Animateur",  color: "#1a3c6b", bg: "#dce8ff", rank: 1 },
  membre:     { label: "Membre",         short: "Membre",     color: "#555",    bg: "#eee",    rank: 0 },
}

// ─── VOTES ───────────────────────────────────────────────────────────────────
export const VOTES_DEF = [
  { key: "mimi",  label: "Top Mimi",  emoji: "🥰" },
  { key: "cool",  label: "Top Cool",  emoji: "😎" },
  { key: "sexy",  label: "Top Sexy",  emoji: "🔥" },
  { key: "loose", label: "Top Loose", emoji: "💀" },
]

export const initVotes  = () => ({ mimi: 0, cool: 0, sexy: 0, loose: 0 })
export const initVotedD = () => ({ mimi: false, cool: false, sexy: false, loose: false })

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
export const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
export const monthKey   = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}` }
export const monthLabel = () => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }

// ─── COULEURS ────────────────────────────────────────────────────────────────
export const C = {
  bg:        'var(--bg)',
  nav:       'var(--navBg)',
  navBorder: 'var(--navBorder)',
  white:     'var(--white)',
  surface:   'var(--surface)',
  surfaceB:  'var(--surfaceB)',
  border:    'var(--border)',
  borderMid: 'var(--borderMid)',
  accent:    'var(--accent)',
  accentDk:  'var(--accentDk)',
  accentTxt: 'var(--accentTxt)',
  accentBg:  'var(--accentBg)',
  text:      'var(--text)',
  textMid:   'var(--textMid)',
  textDim:   'var(--textDim)',
  online:    'var(--online)',
  red:       'var(--red)',
}

// ─── CATÉGORIES FORUM ────────────────────────────────────────────────────────
export const CATS = ["Tous", "Musique", "Culture", "Voyages", "Lifestyle", "Rencontres", "Divers", "+18"]