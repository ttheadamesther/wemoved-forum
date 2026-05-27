import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { RoleBadge } from './UI'
import { Logo } from './Logo'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/ThemeContext'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const location  = useLocation()
  const navigate  = useNavigate()
  const path      = location.pathname
  const [search, setSearch]               = useState('')
  const [results, setResults]             = useState([])
  const [showRes, setShowRes]             = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [notifs,  setNotifs]              = useState([])
  const [showNotifs, setShowNotifs]       = useState(false)
  const [menuOpen, setMenuOpen]           = useState(false)
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const searchRef = useRef()
  const notifRef  = useRef()
  const navRef    = useRef()

  const canMod = ['admin', 'manager', 'moderateur'].includes(profile?.role)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setIsMobile(entry.contentRect.width < 768)
    })
    if (navRef.current) observer.observe(navRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setMenuOpen(false) }, [path])

  // ── Chargement initial des notifs ──
  useEffect(() => {
    if (!user) return
    const loadNotifs = async () => {
      const keys = Object.keys(localStorage)
      const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      let token = ANON_KEY
      try {
        if (authKey) {
          const data = JSON.parse(localStorage.getItem(authKey))
          if (data?.access_token) token = data.access_token
        }
      } catch {}
      fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false&order=created_at.desc&limit=20`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setNotifs(d) })
    }
    loadNotifs()
  }, [user])

  // ── Realtime notifications ──
  useEffect(() => {
    if (!user || !supabase) return

    const setupChannel = async () => {
      const token = await (async () => {
        try {
          const keys = Object.keys(localStorage)
          const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
          if (authKey) {
            const data = JSON.parse(localStorage.getItem(authKey))
            if (data?.access_token) return data.access_token
          }
        } catch {}
        return null
      })()

      if (token) await supabase.realtime.setAuth(token)

      const channel = supabase
        .channel(`notifs-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          setNotifs(prev => [payload.new, ...prev])
        })
        .subscribe()

      return channel
    }

    let channelRef = null
    setupChannel().then(ch => { channelRef = ch })
    return () => { if (channelRef) supabase.removeChannel(channelRef) }
  }, [user])

  // ── Messages non lus ──
  useEffect(() => {
    if (!user) return
    fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&read=eq.false&select=id`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUnreadMessages(d.length) })
  }, [user, path])

  // ── Realtime messages non lus ──
  useEffect(() => {
    if (!user || !supabase) return

    const channel = supabase
      .channel(`messages-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_id=eq.${user.id}`
      }, () => {
        fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&read=eq.false&select=id`, {
          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
        }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUnreadMessages(d.length) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      fetch(`${SUPABASE_URL}/rest/v1/profiles?pseudo=ilike.*${search}*&limit=5`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setResults(d) })
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) { setShowRes(false); setShowSearch(false) }
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (id) => {
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs(n => n.filter(x => x.id !== id))
  }

  const markAllRead = async () => {
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs([])
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const initials    = profile?.initials || profile?.pseudo?.slice(0, 2).toUpperCase() || '??'
  const xp          = profile?.xp || 0
  const level       = profile?.level || 1
  const xpPercent   = (xp % 1000) / 10
  const colors      = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(profile?.pseudo?.charCodeAt(0) || 0) % colors.length]

  const NavLink = ({ to, label, icon }) => {
    const active = path === to
    return (
      <Link to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: isMobile ? '14px 20px' : '0 10px',
          height: isMobile ? 'auto' : 64,
          color: active ? C.accent : '#ccc',
          fontWeight: active ? 700 : 400, fontSize: 12,
          borderBottom: isMobile ? '1px solid #222' : active ? `2px solid ${C.accent}` : '2px solid transparent',
          background: active && isMobile ? 'rgba(200,162,0,.1)' : 'transparent',
          cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          {label}
        </div>
      </Link>
    )
  }

  const MessagesNavLink = () => {
    const active = path === '/messages'
    return (
      <Link to="/messages" onClick={() => { setMenuOpen(false); setUnreadMessages(0) }} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: isMobile ? '14px 20px' : '0 10px',
          height: isMobile ? 'auto' : 64,
          color: active ? C.accent : '#ccc',
          fontWeight: active ? 700 : 400, fontSize: 12,
          borderBottom: isMobile ? '1px solid #222' : active ? `2px solid ${C.accent}` : '2px solid transparent',
          background: active && isMobile ? 'rgba(200,162,0,.1)' : 'transparent',
          cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: 14 }}>✉️</span>
          Messages
          {unreadMessages > 0 && (
            <span style={{ background: C.red, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 5px', marginLeft: 2, lineHeight: 1.6 }}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <>
      <nav ref={navRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, height: 64, display: 'flex', alignItems: 'center', padding: '0 12px', background: '#111', borderBottom: `2px solid ${C.navBorder}`, gap: 4 }}>

        <Link to="/" style={{ flexShrink: 0, marginTop: 8, marginRight: 4 }}>
          <Logo height={70} />
        </Link>

        {!isMobile && (
          <>
            <NavLink to="/"           label="Accueil"   icon="🏠" />
            <NavLink to="/forum"      label="Forum"     icon="💬" />
            <NavLink to="/members"    label="Membres"   icon="👥" />
            {user && <MessagesNavLink />}
            {user && <NavLink to="/profile"    label="Profil"    icon="👤" />}
            {user && <NavLink to="/bug-report" label="Bug"       icon="🐛" />}
            {user && canMod && <NavLink to="/moderation" label="Modération" icon="🛡️" />}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>

          {/* Bouton Dark Mode */}
          <button onClick={toggle} className="theme-toggle" title={dark ? 'Mode clair' : 'Mode sombre'}>
            {dark ? '☀️' : '🌙'}
          </button>

          {/* Recherche desktop */}
          {!isMobile && (
            <div ref={searchRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowSearch(s => !s)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: showSearch ? '#333' : '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                🔍
              </button>
              {showSearch && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 12, width: 260, zIndex: 1000 }}>
                  <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }} autoFocus
                    placeholder="Rechercher un membre…"
                    style={{ width: '100%', background: '#222', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {showRes && results.length > 0 && (
                    <div style={{ marginTop: 8, background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
                      {results.map(u => (
                        <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false); setShowSearch(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                            {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{u.pseudo}</div>
                            <div style={{ fontSize: 11, color: C.textMid }}>{u.city || ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {user && (
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowNotifs(s => !s)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, position: 'relative' }}>
                🔔
                {notifs.length > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 300, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 1000, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: C.textMid }}>Notifications</span>
                    {notifs.length > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accentTxt, fontWeight: 600 }}>
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifs.length === 0
                      ? <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Aucune notification</div>
                      : notifs.map(n => (
                        <div key={n.id} onClick={() => { markRead(n.id); if (n.link) navigate(n.link); setShowNotifs(false) }}
                          style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: C.surfaceB, fontSize: 12, color: C.text, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ flex: 1 }}>{n.content}</span>
                          <button onClick={e => { e.stopPropagation(); markRead(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avatar + XP desktop */}
          {user && !isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 42, background: '#1a1a1a', borderRadius: 22, border: '1px solid #2a2a2a' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: profile?.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo || user.email?.split('@')[0]}</span>
                  {profile && <RoleBadge role={profile.role} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: '#c8a200', fontWeight: 700 }}>Niv.{level}</span>
                  <div style={{ width: 50, height: 3, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right,#f0c800,#c8a200)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 9, color: '#666' }}>{xp % 1000}</span>
                </div>
              </div>
              <button onClick={handleSignOut} style={{ marginLeft: 2, background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16, lineHeight: 1 }} title="Déconnexion">⏻</button>
            </div>
          )}

          {/* Connexion desktop */}
          {!user && !isMobile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login"><button style={{ padding: '0 12px', height: 34, border: '1px solid #333', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 12 }}>Connexion</button></Link>
              <Link to="/register"><button style={{ padding: '0 12px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(to bottom,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 12 }}>S'inscrire</button></Link>
            </div>
          )}

          {/* Hamburger mobile */}
          {isMobile && (
            <button onClick={() => setMenuOpen(m => !m)} style={{ width: 40, height: 40, borderRadius: 6, border: 'none', background: '#222', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ width: 20, height: 2, background: menuOpen ? C.accent : '#ccc', transition: 'all .2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none', display: 'block' }} />
              <span style={{ width: 20, height: 2, background: menuOpen ? 'transparent' : '#ccc', transition: 'all .2s', display: 'block' }} />
              <span style={{ width: 20, height: 2, background: menuOpen ? C.accent : '#ccc', transition: 'all .2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none', display: 'block' }} />
            </button>
          )}
        </div>
      </nav>

      {/* Menu mobile */}
      {isMobile && menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, background: '#111', zIndex: 998, borderBottom: `2px solid ${C.navBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #333', borderRadius: 20, padding: '0 12px', gap: 8 }}>
              <span style={{ color: '#888' }}>🔍</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }}
                placeholder="Rechercher un membre…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, width: '100%', padding: '10px 0', fontFamily: 'inherit' }}
              />
            </div>
            {showRes && results.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 8, marginTop: 8, overflow: 'hidden' }}>
                {results.map(u => (
                  <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false); setMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.initials}
                    </div>
                    <div><div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{u.pseudo}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/"              label="Accueil"     icon="🏠" />
          <NavLink to="/forum"         label="Forum"       icon="💬" />
          <NavLink to="/members"       label="Membres"     icon="👥" />
          {user && <MessagesNavLink />}
          {user && <NavLink to="/notifications" label="Notifications" icon="🔔" />}
          {user && <NavLink to="/profile"       label="Mon Profil"   icon="👤" />}
          {user && <NavLink to="/bug-report"    label="Signaler un bug" icon="🐛" />}
          {user && canMod && <NavLink to="/moderation" label="Modération" icon="🛡️" />}

          <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #222', cursor: 'pointer', color: '#ccc', fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Mode clair' : 'Mode sombre'}
          </div>

          {user && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: profile?.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>@{profile?.pseudo || user.email?.split('@')[0]}</div>
                  {profile && <RoleBadge role={profile.role} />}
                </div>
                <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}>Déco</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#c8a200', fontWeight: 700 }}>Niv.{level}</span>
                <div style={{ flex: 1, height: 3, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right,#f0c800,#c8a200)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: '#666' }}>{xp % 1000}/1000 XP</span>
              </div>
            </div>
          )}

          {!user && (
            <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid #222' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ flex: 1 }}>
                <button style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 13 }}>Connexion</button>
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} style={{ flex: 1 }}>
                <button style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 6, cursor: 'pointer', background: 'linear-gradient(to bottom,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 13 }}>S'inscrire</button>
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}