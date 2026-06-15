// ── Hook mentions @pseudo ──────────────────────────────────────────────────
// Usage: const { mentionState, handleMentionInput, insertMention, MentionDropdown } = useMention(members, inputRef, value, setValue)

import { useState, useCallback } from 'react'
import { C } from '../lib/constants'

export function useMention(members, inputRef, value, setValue) {
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionOpen,  setMentionOpen]  = useState(false)
  const [mentionIdx,   setMentionIdx]   = useState(0)

  // members peut être un array ou un object map
  const membersList = Array.isArray(members) ? members : Object.values(members)

  const filtered = mentionOpen && mentionQuery.length > 0
    ? membersList.filter(m => m?.pseudo?.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6)
    : []

  const handleMentionInput = useCallback((newVal, selectionPos) => {
    // Cherche un @ avant la position du curseur
    const textBefore = newVal.slice(0, selectionPos ?? newVal.length)
    const atIdx = textBefore.lastIndexOf('@')
    if (atIdx !== -1) {
      const query = textBefore.slice(atIdx + 1)
      // Pas d'espace dans la query = on est en train de taper un @mention
      if (!query.includes(' ') && query.length <= 30) {
        setMentionQuery(query)
        setMentionStart(atIdx)
        setMentionOpen(true)
        setMentionIdx(0)
        return
      }
    }
    setMentionOpen(false)
  }, [])

  const insertMention = useCallback((member) => {
    const el = inputRef?.current
    const pseudo = member.pseudo
    const before = value.slice(0, mentionStart)
    const after  = value.slice(mentionStart + 1 + mentionQuery.length)
    const newVal = `${before}@${pseudo} ${after}`
    setValue(newVal)
    setMentionOpen(false)
    setMentionQuery('')
    // Repositionne le curseur après le pseudo
    setTimeout(() => {
      if (el) {
        const pos = before.length + pseudo.length + 2
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    }, 0)
  }, [value, mentionStart, mentionQuery, inputRef, setValue])

  const handleKeyDown = useCallback((e) => {
    if (!mentionOpen || filtered.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % filtered.length) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => (i - 1 + filtered.length) % filtered.length) }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[mentionIdx]) { e.preventDefault(); insertMention(filtered[mentionIdx]) }
    }
    if (e.key === 'Escape') setMentionOpen(false)
  }, [mentionOpen, filtered, mentionIdx, insertMention])

  const colors = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']

  function MentionDropdown() {
    if (!mentionOpen || filtered.length === 0) return null
    return (
      <div style={{
        position: 'absolute', bottom: '105%', left: 0, zIndex: 500,
        background: 'var(--white, #fff)',
        border: `1px solid rgba(200,162,0,.4)`,
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,.18)',
        overflow: 'hidden',
        minWidth: 200,
        maxWidth: 280,
      }}>
        {filtered.map((m, i) => {
          const ac = colors[(m?.pseudo?.charCodeAt(0) || 0) % colors.length]
          return (
            <div key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                cursor: 'pointer',
                background: i === mentionIdx ? 'rgba(200,162,0,.12)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={() => setMentionIdx(i)}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: m.avatar_url ? '#444' : ac,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {m.avatar_url
                  ? <img src={m.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : m.initials || m.pseudo?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>@{m.pseudo}</div>
                {m.role && m.role !== 'membre' && (
                  <div style={{ fontSize: 10, color: 'var(--textDim)', textTransform: 'uppercase', letterSpacing: .5 }}>{m.role}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return { mentionOpen, handleMentionInput, insertMention, handleKeyDown, MentionDropdown }
}

// ── Render du texte avec @mentions cliquables ────────────────────────────────
export function renderWithMentions(text, members, navigate) {
  if (!text || !text.includes('@')) return text
  const membersList = Array.isArray(members) ? members : Object.values(members)
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const pseudo = part.slice(1)
      const member = membersList.find(m => m?.pseudo?.toLowerCase() === pseudo.toLowerCase())
      if (member) {
        return (
          <span key={i}
            onClick={(e) => { e.stopPropagation(); navigate(`/members/${member.id}`) }}
            style={{ color: 'var(--accentTxt, #c8a200)', fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            {part}
          </span>
        )
      }
    }
    return part
  })
}