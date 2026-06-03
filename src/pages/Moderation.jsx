import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { C } from '../lib/constants'
import { RoleBadge, Btn } from '../components/UI'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

function api(path, opts = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

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

async function apiAuth(path, opts = {}) {
  const token = await getToken()
  return fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
  })
}

const BAN_OPTIONS = [
  { label: '1 heure',   value: '1h',        ms: 3600000 },
  { label: '1 jour',    value: '1d',        ms: 86400000 },
  { label: '1 semaine', value: '1w',        ms: 604800000 },
  { label: '1 mois',    value: '1m',        ms: 2592000000 },
  { label: 'Définitif', value: 'permanent', ms: null },
]

const STATUS_COLORS = { ouvert: '#e74c3c', 'en cours': '#e67e22', résolu: '#2ecc71' }
const REPORT_STATUS_COLORS = { pending: '#e67e22', resolved: '#2ecc71', rejected: '#95a5a6' }
const REPORT_STATUS_LABELS = { pending: 'En attente', resolved: 'Résolu', rejected: 'Rejeté' }

const LOG_LABELS = {
  ban:           { icon: '🔨', label: 'Ban', color: '#e74c3c' },
  unban:         { icon: '✅', label: 'Déban', color: '#2ecc71' },
  delete_reply:  { icon: '🗑', label: 'Réponse supprimée', color: '#e67e22' },
  delete_thread: { icon: '🗑', label: 'Topic supprimé', color: '#e67e22' },
  hide_reply:    { icon: '🙈', label: 'Réponse masquée', color: '#95a5a6' },
  hide_thread:   { icon: '🙈', label: 'Topic masqué', color: '#95a5a6' },
}

async function logAction(modId, targetId, action, details = {}) {
  try {
    await apiAuth('/rest/v1/mod_logs', {
      method: 'POST',
      body: JSON.stringify({ mod_id: modId, target_id: targetId, action, details })
    })
  } catch {}
}

export default function Moderation() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [tab,         setTab]        = useState('members')
  const [members,     setMembers]    = useState([])
  const [bugs,        setBugs]       = useState([])
  const [reports,     setReports]    = useState([])
  const [logs,        setLogs]       = useState([])
  const [reportContents, setReportContents] = useState({}) // cache contenu signalé
  const [search,      setSearch]     = useState('')
  const [loading,     setLoading]    = useState(true)
  const [banTarget,   setBanTarget]  = useState(null)
  const [banDuration, setBanDuration]= useState('1d')
  const [banReason,   setBanReason]  = useState('')
  const [expandedMember, setExpandedMember] = useState(null) // pour historique ban

  const canMod = ['admin', 'manager', 'moderateur'].includes(profile?.role)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (profile && !canMod) { navigate('/'); return }
  }, [user, profile])

  useEffect(() => {
    if (!canMod) return
    setLoading(true)
    Promise.all([
      api('/rest/v1/profiles?select=*&order=created_at.desc').then(r => r.json()),
      api('/rest/v1/bug_reports?select=*&order=created_at.desc').then(r => r.json()),
      api('/rest/v1/reports?select=*&order=created_at.desc').then(r => r.json()),
      apiAuth('/rest/v1/mod_logs?select=*&order=created_at.desc&limit=100').then(r => r.json()),
    ]).then(([m, b, rp, lg]) => {
      if (Array.isArray(m))  setMembers(m)
      if (Array.isArray(b))  setBugs(b)
      if (Array.isArray(rp)) {
        setReports(rp)
        // Charger le contenu des signalements
        rp.forEach(r => fetchReportContent(r))
      }
      if (Array.isArray(lg)) setLogs(lg)
      setLoading(false)
    })
  }, [canMod])

  // Charger le contenu signalé (thread ou reply)
  const fetchReportContent = async (report) => {
    if (!report.target_id || reportContents[report.id]) return
    try {
      const table = report.type === 'thread' ? 'threads' : 'replies'
      const r = await api(`/rest/v1/${table}?id=eq.${report.target_id}&select=title,body&limit=1`)
      const d = await r.json()
      if (Array.isArray(d) && d[0]) {
        setReportContents(prev => ({ ...prev, [report.id]: d[0] }))
      }
    } catch {}
  }

  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const getMember = (id) => members.find(m => m.id === id)

  const banMember = async (memberId) => {
    const opt = BAN_OPTIONS.find(o => o.value === banDuration)
    const bannedUntil = opt.ms ? new Date(Date.now() + opt.ms).toISOString() : null
    await apiAuth(`/rest/v1/profiles?id=eq.${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ banned: true, banned_until: bannedUntil, ban_reason: banReason || null })
    })
    await logAction(user.id, memberId, 'ban', {
      duration: banDuration,
      reason: banReason || null,
      until: bannedUntil,
      target_pseudo: getMember(memberId)?.pseudo
    })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, banned: true, banned_until: bannedUntil } : m))
    // Refresh logs
    apiAuth('/rest/v1/mod_logs?select=*&order=created_at.desc&limit=100').then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d) })
    setBanTarget(null); setBanReason(''); setBanDuration('1d')
  }

  const unbanMember = async (memberId) => {
    await apiAuth(`/rest/v1/profiles?id=eq.${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ banned: false, banned_until: null, ban_reason: null })
    })
    await logAction(user.id, memberId, 'unban', { target_pseudo: getMember(memberId)?.pseudo })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, banned: false, banned_until: null } : m))
    apiAuth('/rest/v1/mod_logs?select=*&order=created_at.desc&limit=100').then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d) })
  }

  const updateBugStatus = async (bugId, status) => {
    await apiAuth(`/rest/v1/bug_reports?id=eq.${bugId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setBugs(prev => prev.map(b => b.id === bugId ? { ...b, status } : b))
  }

  const deleteBug = async (bugId) => {
    await apiAuth(`/rest/v1/bug_reports?id=eq.${bugId}`, { method: 'DELETE' })
    setBugs(prev => prev.filter(b => b.id !== bugId))
  }

  const updateReportStatus = async (reportId, status) => {
    await apiAuth(`/rest/v1/reports?id=eq.${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r))
  }

  const deleteReport = async (reportId) => {
    await apiAuth(`/rest/v1/reports?id=eq.${reportId}`, { method: 'DELETE' })
    setReports(prev => prev.filter(r => r.id !== reportId))
  }

  const filtered = members.filter(m =>
    m.id !== user?.id &&
    (!search || m.pseudo?.toLowerCase().includes(search.toLowerCase()))
  )

  const pendingReports = reports.filter(r => r.status === 'pending').length

  if (!canMod && profile) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Accès refusé.</div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* Modal ban */}
      {banTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>🔨 Bannir @{banTarget.pseudo}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Choisir la durée du bannissement</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {BAN_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setBanDuration(o.value)}
                  style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${banDuration === o.value ? C.accentDk : C.border}`, background: banDuration === o.value ? C.accentBg : C.surfaceB, color: banDuration === o.value ? C.accentTxt : C.textMid, fontWeight: banDuration === o.value ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>Raison (optionnel)</div>
              <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ex: Spam, comportement inapproprié…"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: C.surfaceB, color: C.text }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => { setBanTarget(null); setBanReason(''); setBanDuration('1d') }} variant="ghost">Annuler</Btn>
              <Btn onClick={() => banMember(banTarget.id)} variant="red">🔨 Bannir</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, color: C.text, marginBottom: 4 }}>🛡️ Modération</h1>
        <p style={{ fontSize: 13, color: C.textDim }}>Gestion des membres, signalements et bugs</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.surfaceB, borderRadius: 12, padding: 4 }}>
        {[
          { key: 'members', label: `👥 Membres (${members.length})` },
          { key: 'reports', label: `🚩 Signalements${pendingReports > 0 ? ` (${pendingReports})` : ''}` },
          { key: 'bugs',    label: `🐛 Bugs (${bugs.filter(b => b.status !== 'résolu').length})` },
          { key: 'logs',    label: `📋 Logs (${logs.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: tab === t.key ? C.white : 'transparent', color: tab === t.key ? C.text : C.textMid, fontWeight: tab === t.key ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>Chargement…</div>

      ) : tab === 'members' ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un membre…"
              style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: C.white, color: C.text }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(m => {
              const avatarColor = colors[(m.pseudo?.charCodeAt(0) || 0) % colors.length]
              const memberLogs = logs.filter(l => l.target_id === m.id && l.action === 'ban')
              const isExpanded = expandedMember === m.id
              return (
                <div key={m.id} style={{ background: C.white, border: `1px solid ${m.banned ? '#e74c3c66' : C.border}`, borderLeft: `4px solid ${m.banned ? '#e74c3c' : C.accentDk}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: m.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                      {m.avatar_url ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : m.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{m.pseudo}</span>
                        <RoleBadge role={m.role} />
                        {m.banned && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#e74c3c', background: 'transparent', padding: '2px 8px', borderRadius: 20, border: '1px solid #e74c3c' }}>
                            ⛔ Banni{m.banned_until ? ` jusqu'au ${new Date(m.banned_until).toLocaleDateString('fr-FR')}` : ' définitivement'}
                          </span>
                        )}
                        {memberLogs.length > 0 && (
                          <button onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                            style={{ fontSize: 10, color: C.textDim, background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            📋 {memberLogs.length} ban{memberLogs.length > 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim }}>
                        {m.city && `📍 ${m.city} · `}Inscrit le {m.joined}
                      </div>
                      {m.ban_reason && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 2 }}>Raison : {m.ban_reason}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Btn onClick={() => navigate(`/members/${m.id}`)} variant="ghost" style={{ fontSize: 11 }}>👁</Btn>
                      {m.banned
                        ? <Btn onClick={() => unbanMember(m.id)} variant="green" style={{ fontSize: 11 }}>✅ Débannir</Btn>
                        : <Btn onClick={() => setBanTarget(m)} variant="red" style={{ fontSize: 11 }}>🔨 Bannir</Btn>
                      }
                    </div>
                  </div>
                  {/* Historique des bans */}
                  {isExpanded && memberLogs.length > 0 && (
                    <div style={{ borderTop: `1px solid ${C.border}`, background: C.surfaceB, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>Historique des bans</div>
                      {memberLogs.map(lg => {
                        const mod = getMember(lg.mod_id)
                        return (
                          <div key={lg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMid }}>
                            <span style={{ color: '#e74c3c' }}>🔨</span>
                            <span>Par <strong>@{mod?.pseudo || 'Inconnu'}</strong></span>
                            {lg.details?.duration && <span style={{ background: C.border, borderRadius: 10, padding: '1px 6px' }}>{BAN_OPTIONS.find(o => o.value === lg.details.duration)?.label || lg.details.duration}</span>}
                            {lg.details?.reason && <span style={{ color: C.textDim }}>— {lg.details.reason}</span>}
                            <span style={{ marginLeft: 'auto', color: C.textDim }}>{new Date(lg.created_at).toLocaleDateString('fr-FR')} {new Date(lg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: C.textDim, fontSize: 13, background: C.white, borderRadius: 14, border: `1px solid ${C.border}` }}>
                Aucun membre trouvé.
              </div>
            )}
          </div>
        </>

      ) : tab === 'reports' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: C.textDim, fontSize: 13, background: C.white, borderRadius: 14, border: `1px solid ${C.border}` }}>
              🎉 Aucun signalement pour l'instant.
            </div>
          )}
          {reports.map(r => {
            const reporter = getMember(r.reporter_id)
            const statusColor = REPORT_STATUS_COLORS[r.status] || '#888'
            const content = reportContents[r.id]
            return (
              <div key={r.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderLeft: `4px solid ${statusColor}`, borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, background: C.surfaceB, padding: '2px 8px', borderRadius: 20, border: `1px solid ${C.border}` }}>
                        {r.type === 'thread' ? '💬 Topic' : '↩️ Réponse'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.reason}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim }}>
                      Signalé par <strong>@{reporter?.pseudo || 'Inconnu'}</strong> · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    {/* Contenu signalé */}
                    {content && (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: C.surfaceB, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${statusColor}` }}>
                        {content.title && <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 4 }}>{content.title}</div>}
                        <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {(content.body || '').slice(0, 300)}{(content.body || '').length > 300 ? '…' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44`, flexShrink: 0 }}>
                    {REPORT_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {['pending', 'resolved', 'rejected'].map(s => (
                    <button key={s} onClick={() => updateReportStatus(r.id, s)}
                      style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${r.status === s ? REPORT_STATUS_COLORS[s] : C.border}`, background: r.status === s ? `${REPORT_STATUS_COLORS[s]}22` : C.surfaceB, color: r.status === s ? REPORT_STATUS_COLORS[s] : C.textMid, fontSize: 11, fontWeight: r.status === s ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {REPORT_STATUS_LABELS[s]}
                    </button>
                  ))}
                  {r.status !== 'pending' && (
                    <button onClick={() => deleteReport(r.id)}
                      style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : tab === 'bugs' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bugs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: C.textDim, fontSize: 13, background: C.white, borderRadius: 14, border: `1px solid ${C.border}` }}>
              Aucun rapport de bug.
            </div>
          )}
          {bugs.map(b => {
            const author = getMember(b.author_id)
            return (
              <div key={b.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderLeft: `4px solid ${STATUS_COLORS[b.status] || '#ccc'}`, borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: C.textDim }}>
                      @{author?.pseudo || 'Inconnu'} · {new Date(b.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${STATUS_COLORS[b.status]}22`, color: STATUS_COLORS[b.status], border: `1px solid ${STATUS_COLORS[b.status]}44`, flexShrink: 0 }}>
                    {b.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 12 }}>{b.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {['ouvert', 'en cours', 'résolu'].map(s => (
                    <button key={s} onClick={() => updateBugStatus(b.id, s)}
                      style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${b.status === s ? STATUS_COLORS[s] : C.border}`, background: b.status === s ? `${STATUS_COLORS[s]}22` : C.surfaceB, color: b.status === s ? STATUS_COLORS[s] : C.textMid, fontSize: 11, fontWeight: b.status === s ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {s}
                    </button>
                  ))}
                  {b.status === 'résolu' && (
                    <button onClick={() => deleteBug(b.id)}
                      style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* Onglet Logs */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: C.textDim, fontSize: 13, background: C.white, borderRadius: 14, border: `1px solid ${C.border}` }}>
              Aucune action de modération enregistrée.
            </div>
          )}
          {logs.map(lg => {
            const mod    = getMember(lg.mod_id)
            const target = getMember(lg.target_id)
            const info   = LOG_LABELS[lg.action] || { icon: '📋', label: lg.action, color: '#888' }
            return (
              <div key={lg.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderLeft: `4px solid ${info.color}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{info.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 3 }}>
                    <strong style={{ color: info.color }}>@{mod?.pseudo || 'Inconnu'}</strong>
                    {' '}→{' '}
                    <span style={{ fontWeight: 700 }}>{info.label}</span>
                    {target && <span> sur <strong>@{target.pseudo || lg.details?.target_pseudo || 'Inconnu'}</strong></span>}
                    {lg.details?.duration && (
                      <span style={{ marginLeft: 6, fontSize: 11, background: C.surfaceB, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1px 7px', color: C.textMid }}>
                        {BAN_OPTIONS.find(o => o.value === lg.details.duration)?.label || lg.details.duration}
                      </span>
                    )}
                  </div>
                  {lg.details?.reason && (
                    <div style={{ fontSize: 11, color: C.textDim }}>Raison : {lg.details.reason}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, flexShrink: 0, textAlign: 'right' }}>
                  <div>{new Date(lg.created_at).toLocaleDateString('fr-FR')}</div>
                  <div>{new Date(lg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}