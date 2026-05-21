import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { C } from '../lib/constants'
import { RoleBadge } from './UI'
import { Logo } from './Logo'
import { useAuth } from '../hooks/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()
  const path      = location.pathname
  const [search, setSearch]         = useState('')
  const [results, setResults]       = useState([])
  const [showRes, setShowRes]       = useState(false)
  const [notifs,  setNotifs]        = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [isMobile, setIsMobile]     = useState(false)
  const searchRef = useRef()
  const notifRef  = useRef()
  const navRef    = useRef()

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsMobile(entry.contentRect.width < 768)
      }
    })
    if (navRef.current) observer.observe(navRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setMenuOpen(false) }, [path])

  useEffect(() => {
    if (!user) return
    fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false&order=created_at.desc`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setNotifs(d) })
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
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowRes(false)
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

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const initials = profile?.initials || profile?.pseudo?.slice(0, 2).toUpperCase() || '??'

  const NavLink = ({ to, label, icon }) => {
    const active = path === to
    return (
      <Link to={to} onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '14px 20px' : '0 16px',
          height: isMobile ? 'auto' : 64,
          color: active ? C.accent : '#ccc',
          fontWeight: active ? 700 : 400, fontSize: 14,
          borderBottom: isMobile ? `1px solid #222` : active ? `2px solid ${C.accent}` : '2px solid transparent',
          background: active && isMobile ? 'rgba(200,162,0,.1)' : 'transparent',
          cursor: 'pointer', transition: 'all .15s'
        }}>
          <span>{icon}</span>
          {label}
        </div>
      </Link>
    )
  }

  return (
    <>
      <nav ref={navRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, height: 64, display: 'flex', alignItems: 'center', padding: '0 16px', background: '#111', borderBottom: `2px solid ${C.navBorder}`, gap: 8 }}>

        {/* Logo */}
        <Link to="/" style={{ flexShrink: 0, marginTop: 8, marginRight: 8 }}>
          <Logo height={70} />
        </Link>

        {/* Nav desktop */}
        {!isMobile && (
          <>
            <NavLink to="/"        label="Accueil"         icon="🏠" />
            <NavLink to="/forum"   label="Forum"           icon="💬" />
            <NavLink to="/members" label="Membres"         icon="👥" />
            {user && <NavLink to="/messages"  label="Messages privés" icon="✉️" />}
            {user && <NavLink to="/profile"   label="Mon Profil"      icon="👤" />}
          </>
        )}

        {/* Recherche desktop */}
        {!isMobile && (
          <div ref={searchRef} style={{ marginLeft: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #333', borderRadius: 20, padding: '0 12px', gap: 8 }}>
              <span style={{ color: '#888', fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }} onFocus={() => setShowRes(true)}
                placeholder="Rechercher…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, width: 160, padding: '8px 0', fontFamily: "'Open Sans',sans-serif" }}
              />
            </div>
            {showRes && results.length > 0 && (
              <div style={{ position: 'absolute', top: '110%', right: 0, width: 240, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,.15)', overflow: 'hidden', zIndex: 1000 }}>
                {results.map(u => (
                  <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
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

        {/* Côté droit */}
        <div style={{ marginLeft: isMobile ? 'auto' : 8, display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Notifications */}
          {user && (
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowNotifs(s => !s)} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, position: 'relative' }}>
                🔔
                {notifs.length > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 280, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 1000, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 12, color: '#555' }}>Notifications</div>
                  {notifs.length === 0
                    ? <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Aucune notification</div>
                    : notifs.map(n => (
                      <div key={n.id} onClick={() => { markRead(n.id); if (n.link) navigate(n.link) }}
                        style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: '#fffae6', fontSize: 12, color: C.text }}>
                        {n.content}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Avatar desktop */}
          {user && !isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44, background: '#222', borderRadius: 22, border: '1px solid #333' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo || user.email?.split('@')[0]}</div>
                {profile && <div style={{ fontSize: 10, color: '#888' }}><RoleBadge role={profile.role} /></div>}
              </div>
              <button onClick={handleSignOut} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, lineHeight: 1 }} title="Déconnexion">⏻</button>
            </div>
          )}

          {/* Boutons connexion desktop */}
          {!user && !isMobile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login"><button style={{ padding: '0 14px', height: 36, border: '1px solid #333', borderRadius: 3, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 12 }}>Connexion</button></Link>
              <Link to="/register"><button style={{ padding: '0 14px', height: 36, border: 'none', borderRadius: 3, cursor: 'pointer', background: `linear-gradient(to bottom,#f0c800,#c8a200)`, color: '#3a2e00', fontWeight: 700, fontSize: 12 }}>S'inscrire</button></Link>
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

          {/* Recherche mobile */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #222' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #333', borderRadius: 20, padding: '0 12px', gap: 8 }}>
              <span style={{ color: '#888' }}>🔍</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }}
                placeholder="Rechercher un membre…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, width: '100%', padding: '10px 0', fontFamily: "'Open Sans',sans-serif" }}
              />
            </div>
            {showRes && results.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                {results.map(u => (
                  <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false); setMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 3, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>@{u.pseudo}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Liens navigation */}
          <NavLink to="/"              label="Accueil"         icon="🏠" />
          <NavLink to="/forum"         label="Forum"           icon="💬" />
          <NavLink to="/members"       label="Membres"         icon="👥" />
          {user && <NavLink to="/messages"      label="Messages privés" icon="✉️" />}
          {user && <NavLink to="/notifications" label="Notifications"   icon="🔔" />}
          {user && <NavLink to="/profile"       label="Mon Profil"      icon="👤" />}

          {/* Profil mobile */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid #222' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo || user.email?.split('@')[0]}</div>
                {profile && <RoleBadge role={profile.role} />}
              </div>
              <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}>Déco</button>
            </div>
          )}

          {/* Connexion mobile */}
          {!user && (
            <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid #222' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ flex: 1 }}>
                <button style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 13 }}>Connexion</button>
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} style={{ flex: 1 }}>
                <button style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 6, cursor: 'pointer', background: `linear-gradient(to bottom,#f0c800,#c8a200)`, color: '#3a2e00', fontWeight: 700, fontSize: 13 }}>S'inscrire</button>
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}