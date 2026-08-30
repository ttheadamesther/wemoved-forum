import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, MessageSquare, Users, Hash, Mail, User, Shield,
  Search, Bell, Sun, Moon, X, ChevronUp, ChevronDown,
  Settings, Bug, Trophy, BarChart3, ScrollText, LogOut, Menu,
} from 'lucide-react'
import { C, ROLE_RING } from '../lib/constants'
import { RoleBadge } from './UI'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/ThemeContext'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

const ICON_STROKE = 1.75

// Variants partagés pour tous les dropdowns : slide vers le bas + fade
const dropdownVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.12, ease: 'easeIn' } },
}

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
  const [showUserMenu, setShowUserMenu]   = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const userMenuRef = useRef()
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

  useEffect(() => {
    setMenuOpen(false); setShowMobileMenu(false)
    if (path === '/notifications') return
    if (user) {
      getToken().then(token => {
        fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc&limit=20`, {
          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(d => { if (Array.isArray(d)) setNotifs(d) })
      })
    }
  }, [path])

  useEffect(() => {
    if (!user) return
    getToken().then(token => {
      fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc&limit=20`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setNotifs(d) })
    })
  }, [user])

  useEffect(() => {
    if (!user || !supabase) return
    const channel = supabase
      .channel(`notifs-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifs(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new.read === true) {
          setNotifs(prev => prev.map(n => n.id === payload.new.id ? { ...n, read: true } : n))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!user) return
    getToken().then(token => {
      fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&read=eq.false&select=id`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUnreadMessages(d.length) })
    })
  }, [user, path])

  useEffect(() => {
    if (!user || !supabase) return
    const channel = supabase
      .channel(`messages-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${user.id}` }, () => {
        getToken().then(token => {
          fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&read=eq.false&select=id`, {
            headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUnreadMessages(d.length) })
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!user) return
    const handler = () => setNotifs(n => n.map(x => ({ ...x, read: true })))
    window.addEventListener('notifs-read', handler)
    return () => window.removeEventListener('notifs-read', handler)
  }, [user])

  useEffect(() => {
    if (!user) return
    const handler = () => {
      getToken().then(token => {
        fetch(`${SUPABASE_URL}/rest/v1/messages?to_id=eq.${user.id}&read=eq.false&select=id`, {
          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(d => { if (Array.isArray(d)) setUnreadMessages(d.length) })
      })
    }
    window.addEventListener('messages-read', handler)
    return () => window.removeEventListener('messages-read', handler)
  }, [user])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,pseudo,initials,avatar_url,city,role&pseudo=ilike.*${search}*&limit=5`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setResults(d) })
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) { setShowRes(false); setShowSearch(false) }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        if (showNotifs && notifs.some(n => !n.read)) {
          getToken().then(token => {
            fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
              method: 'PATCH',
              headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ read: true })
            }).then(() => setNotifs(n => n.map(x => ({ ...x, read: true }))))
          })
        }
        setShowNotifs(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifs, notifs])

  const getToken = async () => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) return session.access_token
      }
    } catch {}
    try {
      const keys = Object.keys(localStorage)
      const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (authKey) { const data = JSON.parse(localStorage.getItem(authKey)); if (data?.access_token) return data.access_token }
    } catch {}
    return ANON_KEY
  }

  const markRead = async (id) => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }

  const markAllRead = async () => {
    const token = await getToken()
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true })
    })
    setNotifs(n => n.map(x => ({ ...x, read: true })))
  }


  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const initials    = profile?.initials || profile?.pseudo?.slice(0, 2).toUpperCase() || '??'
  const xp          = profile?.xp || 0
  const level       = profile?.level || 1
  const xpPercent   = (xp % 1000) / 10
  const colors      = ['#e74c3c','#e67e22','#c8a200','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']
  const avatarColor = colors[(profile?.pseudo?.charCodeAt(0) || 0) % colors.length]

  const dropBg      = dark ? '#1a1a1a' : '#fff'
  const dropBorder  = dark ? '#333'    : C.border
  const dropText    = dark ? '#eee'    : C.text
  const dropTextDim = dark ? '#888'    : C.textDim
  const dropHover   = dark ? '#2a2a2a' : '#f5f5f5'
  const dropSurface = dark ? '#222'    : C.surfaceB

  const NavLink = ({ to, label, Icon }) => {
    const active = path === to
    return (
      <Link to={to} style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 64, color: active ? '#fff' : 'rgba(255,255,255,.65)', fontWeight: active ? 700 : 500, fontSize: 12, borderBottom: active ? '2px solid #c8a200' : '2px solid transparent', cursor: 'pointer', transition: 'all .18s', whiteSpace: 'nowrap', letterSpacing: .2 }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,.9)' }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,.65)' }}>
          <Icon size={15} strokeWidth={ICON_STROKE} style={{ color: '#f0c800' }} />
          {label}
        </div>
      </Link>
    )
  }

  const BottomBar = () => {
    const tabs = [
      { to: '/',         label: 'Accueil',    Icon: Home },
      { to: '/forum',    label: 'Forum',      Icon: MessageSquare },
      { to: user ? '/profile' : '/login', label: user ? 'Mon profil' : 'Connexion', isProfile: true },
      { to: '/messages', label: 'Messages',   Icon: Mail, badge: unreadMessages },
      { to: '/members',  label: 'Membres',    Icon: Users },
      { to: '/chat',     label: 'Salon',      Icon: Hash },
    ]
    return (
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999, height: 64, background: 'rgba(4,4,4,.97)', borderTop: '1px solid rgba(200,162,0,.2)', display: 'flex', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -4px 24px rgba(0,0,0,.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        {tabs.map((tab) => {
          const active = path === tab.to
          const iconColor = active ? C.accent : '#999'
          return (
            <Link key={tab.to} to={tab.to} onClick={() => { if (tab.to === '/messages') setUnreadMessages(0) }}
              style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', transition: 'all .15s' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', lineHeight: 1, color: iconColor }}>
                  {tab.isProfile ? (
                    user ? (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: profile?.avatar_url ? '#444' : avatarColor, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', border: `2px solid ${active ? C.accentDk : '#444'}` }}>
                        {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
                      </div>
                    ) : <User size={22} strokeWidth={ICON_STROKE} />
                  ) : (
                    <tab.Icon size={22} strokeWidth={ICON_STROKE} />
                  )}
                </div>
                {tab.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -6, background: C.red, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 4px', lineHeight: 1.4 }}>{tab.badge > 9 ? '9+' : tab.badge}</span>}
              </div>
              <span style={{ fontSize: 10, color: active ? C.accent : '#888', fontWeight: active ? 700 : 400, transition: 'all .15s' }}>{tab.label}</span>
              {active && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: C.accentDk, borderRadius: '0 0 4px 4px' }} />}
            </Link>
          )
        })}
      </nav>
    )
  }

  if (isMobile) {
    return (
      <>
        <nav ref={navRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, height: 56, display: 'flex', alignItems: 'center', padding: '0 14px', background: 'rgba(4,4,4,.97)', borderBottom: '1px solid rgba(200,162,0,.2)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 2px 16px rgba(0,0,0,.35)' }}>
          <button onClick={() => setShowMobileMenu(m => !m)} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: showMobileMenu ? C.accent : '#ccc' }}>
            {showMobileMenu ? <X size={18} strokeWidth={ICON_STROKE} /> : <Menu size={18} strokeWidth={ICON_STROKE} />}
          </button>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <Link to="/"><img src="/wemoved-navbar-logo.png" alt="wemoved" style={{ height: 28, width: "auto", display: "block", objectFit: "contain" }} /></Link>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div ref={searchRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowSearch(s => !s)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: showSearch ? '#333' : '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                <Search size={15} strokeWidth={ICON_STROKE} />
              </button>
              <AnimatePresence>
                {showSearch && (
                  <motion.div
                    variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
                    style={{ position: 'fixed', top: 56, left: 12, right: 12, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 10, zIndex: 1000 }}>
                    <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }} autoFocus placeholder="Rechercher un membre…" style={{ width: '100%', background: '#222', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                    {showRes && results.length > 0 && (
                      <div style={{ marginTop: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, overflow: 'hidden' }}>
                        {results.map(u => (
                          <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false); setShowSearch(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                              {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.initials}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#eee' }}>@{u.pseudo}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {user && (
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button onClick={() => {
                  setShowNotifs(s => {
                    if (s && notifs.some(n => !n.read)) {
                      getToken().then(token => {
                        fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
                          method: 'PATCH',
                          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ read: true })
                        }).then(() => setNotifs(n => n.map(x => ({ ...x, read: true }))))
                      })
                    }
                    return !s
                  })
                }} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: '#ccc' }}>
                  <Bell size={15} strokeWidth={ICON_STROKE} />
                  {notifs.some(n => !n.read) && <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifs.filter(n => !n.read).length > 9 ? '9+' : notifs.filter(n => !n.read).length}</span>}
                </button>
                <AnimatePresence>
                  {showNotifs && (
                    <motion.div
                      variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
                      style={{ position: 'fixed', top: 56, left: 12, right: 12, background: dropBg, border: `1px solid ${dropBorder}`, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.3)', zIndex: 1000, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${dropBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: dropTextDim }}>Notifications</span>
                        {notifs.some(n => !n.read) && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accentTxt, fontWeight: 600 }}>Tout lire</button>}
                      </div>
                      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {notifs.length === 0
                          ? <div style={{ padding: 16, textAlign: 'center', color: dropTextDim, fontSize: 12 }}>Aucune notification</div>
                          : notifs.map(n => (
                            <div key={n.id} onClick={() => { markRead(n.id); if (n.link) navigate(n.link); setShowNotifs(false) }} style={{ padding: '12px 14px', borderBottom: `1px solid ${dropBorder}`, cursor: 'pointer', background: dropSurface, fontSize: 13, color: n.read ? dropTextDim : dropText, opacity: n.read ? 0.6 : 1, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ flex: 1, lineHeight: 1.5 }}>{n.content}</span>
                              <button onClick={e => { e.stopPropagation(); markRead(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dropTextDim, flexShrink: 0, padding: '0 4px', display: 'flex' }}>
                                <X size={14} strokeWidth={ICON_STROKE} />
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <button onClick={toggle} className="theme-toggle" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0c800' }}>
              {dark ? <Sun size={15} strokeWidth={ICON_STROKE} /> : <Moon size={15} strokeWidth={ICON_STROKE} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
              style={{ position: 'fixed', top: 56, left: 0, right: 0, background: 'rgba(4,4,4,.98)', zIndex: 998, borderBottom: '1px solid rgba(200,162,0,.15)', boxShadow: '0 8px 32px rgba(0,0,0,.6)', backdropFilter: 'blur(20px)' }}>
              {user && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: profile?.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', border: `2px solid ${C.accentDk}` }}>
                    {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo}</div>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Niveau {level} · {xp % 1000}/1000 XP</div>
                    <div style={{ height: 3, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right,#f0c800,#c8a200)', borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              )}
              {[
                { Icon: Settings,   label: 'Paramètres',      to: '/settings',      show: !!user },
                { Icon: Bug,        label: 'Signaler un bug',  to: '/bug-report',    show: !!user },
                { Icon: Trophy,     label: 'Récompenses',      to: '/rewards',       show: true },
                { Icon: BarChart3,  label: 'Classements',      to: '/rankings',      show: true },
                { Icon: Shield,     label: 'Modération',       to: '/moderation',    show: !!user && canMod },
                { Icon: ScrollText, label: 'Mentions légales', to: '/legal',         show: true },
              ].filter(i => i.show).map(item => (
                <Link key={item.to} to={item.to} onClick={() => setShowMobileMenu(false)}
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontSize: 13, color: '#ccc' }}>
                  <span style={{ width: 24, display: 'flex', justifyContent: 'center' }}><item.Icon size={17} strokeWidth={ICON_STROKE} style={{ color: '#f0c800' }} /></span>
                  {item.label}
                </Link>
              ))}
              {user ? (
                <div onClick={async () => { await handleSignOut(); setShowMobileMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', fontSize: 13, color: '#e74c3c' }}>
                  <span style={{ width: 24, display: 'flex', justifyContent: 'center' }}><LogOut size={17} strokeWidth={ICON_STROKE} /></span>
                  Déconnexion
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, padding: '14px 20px' }}>
                  <Link to="/login" onClick={() => setShowMobileMenu(false)} style={{ flex: 1 }}>
                    <button style={{ width: '100%', padding: '10px', border: '1px solid #333', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 13 }}>Connexion</button>
                  </Link>
                  <Link to="/register" onClick={() => setShowMobileMenu(false)} style={{ flex: 1 }}>
                    <button style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(to bottom,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 13 }}>S'inscrire</button>
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <BottomBar />
      </>
    )
  }

  // ── DESKTOP ──
  return (
    <>
      <nav ref={navRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, height: 64, display: 'flex', alignItems: 'center', padding: '0 16px', background: 'rgba(4,4,4,.97)', borderBottom: '1px solid rgba(200,162,0,.25)', gap: 4, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 2px 20px rgba(0,0,0,.4)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <Link to="/"><img src="/wemoved-navbar-logo.png" alt="wemoved" style={{ height: 48, width: "auto", display: "block", objectFit: "contain" }} /></Link>
        </div>
        <div style={{ width: 140, flexShrink: 0 }} />
        <NavLink to="/"        label="Accueil" Icon={Home} />
        <NavLink to="/forum"   label="Forum"   Icon={MessageSquare} />
        <NavLink to="/members" label="Membres" Icon={Users} />
        <NavLink to="/chat"    label="Salon"   Icon={Hash} />
        {user && (
          <Link to="/messages" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 64, color: path === '/messages' ? '#fff' : 'rgba(255,255,255,.65)', fontWeight: path === '/messages' ? 700 : 400, fontSize: 14, borderBottom: path === '/messages' ? '2px solid #c8a200' : '2px solid transparent', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', position: 'relative' }}>
              <Mail size={15} strokeWidth={ICON_STROKE} style={{ color: '#f0c800' }} />
              Messages
              {unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: 12, right: 2, background: C.red, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </div>
          </Link>
        )}
        {user && <NavLink to="/profile" label="Profil" Icon={User} />}
        {user && canMod && <NavLink to="/moderation" label="Modération" Icon={Shield} />}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={toggle} className="theme-toggle" title={dark ? 'Mode clair' : 'Mode sombre'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0c800' }}>
            {dark ? <Sun size={16} strokeWidth={ICON_STROKE} /> : <Moon size={16} strokeWidth={ICON_STROKE} />}
          </button>

          <div ref={searchRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowSearch(s => !s)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,.1)', background: showSearch ? 'rgba(200,162,0,.15)' : 'rgba(255,255,255,.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s', color: '#ccc' }}>
              <Search size={16} strokeWidth={ICON_STROKE} />
            </button>
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
                  style={{ position: 'absolute', top: '110%', right: 0, background: 'rgba(10,10,10,.97)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 12, width: 260, zIndex: 1000, backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
                  <input value={search} onChange={e => { setSearch(e.target.value); setShowRes(true) }} autoFocus placeholder="Rechercher un membre…" style={{ width: '100%', background: '#222', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  {showRes && results.length > 0 && (
                    <div style={{ marginTop: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, overflow: 'hidden' }}>
                      {results.map(u => (
                        <div key={u.id} onClick={() => { navigate(`/members/${u.id}`); setSearch(''); setShowRes(false); setShowSearch(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #2a2a2a', transition: 'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                            {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#eee' }}>@{u.pseudo}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>{u.city || ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user && (
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => {
                setShowNotifs(s => {
                  if (s && notifs.some(n => !n.read)) {
                    getToken().then(token => {
                      fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
                        method: 'PATCH',
                        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ read: true })
                      }).then(() => setNotifs(n => n.map(x => ({ ...x, read: true }))))
                    })
                  }
                  return !s
                })
              }} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#222', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', color: '#ccc' }}>
                <Bell size={17} strokeWidth={ICON_STROKE} />
                {notifs.some(n => !n.read) && <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifs.filter(n => !n.read).length > 9 ? '9+' : notifs.filter(n => !n.read).length}</span>}
              </button>
              <AnimatePresence>
                {showNotifs && (
                  <motion.div
                    variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
                    style={{ position: 'absolute', top: '110%', right: 0, width: 310, background: dropBg, border: `1px solid ${dropBorder}`, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.35)', zIndex: 1000, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${dropBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: dropTextDim }}>Notifications</span>
                      {notifs.some(n => !n.read) && <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accentTxt, fontWeight: 600 }}>Tout marquer lu</button>}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {notifs.length === 0
                        ? <div style={{ padding: 20, textAlign: 'center', color: dropTextDim, fontSize: 12 }}>Aucune notification</div>
                        : notifs.map(n => (
                          <div key={n.id} onClick={() => { markRead(n.id); if (n.link) navigate(n.link); setShowNotifs(false) }}
                            style={{ padding: '10px 14px', borderBottom: `1px solid ${dropBorder}`, cursor: 'pointer', background: dropSurface, fontSize: 12, color: n.read ? dropTextDim : dropText, opacity: n.read ? 0.6 : 1, display: 'flex', alignItems: 'flex-start', gap: 8, transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = dropHover}
                            onMouseLeave={e => e.currentTarget.style.background = dropSurface}>
                            <span style={{ flex: 1 }}>{n.content}</span>
                            <button onClick={e => { e.stopPropagation(); markRead(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dropTextDim, flexShrink: 0, display: 'flex' }}>
                              <X size={14} strokeWidth={ICON_STROKE} />
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {user && (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <div onClick={() => setShowUserMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: showUserMenu ? 'rgba(200,162,0,.12)' : 'rgba(255,255,255,.05)', borderRadius: 22, border: `1px solid ${showUserMenu ? 'rgba(200,162,0,.5)' : 'rgba(255,255,255,.1)'}`, cursor: 'pointer', transition: 'all .18s' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: profile?.avatar_url ? '#444' : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0, border: ROLE_RING[profile?.role] ? `2px solid ${ROLE_RING[profile?.role]}` : '2px solid #333', boxShadow: ROLE_RING[profile?.role] ? `0 0 6px ${ROLE_RING[profile?.role]}88` : 'none' }}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials}
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo || user.email?.split('@')[0]}</span>
                    {profile && <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center' }}><RoleBadge role={profile.role} /></div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#c8a200', fontWeight: 700 }}>Niv.{level}</span>
                    <div style={{ width: 40, height: 3, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${xpPercent}%`, background: 'linear-gradient(to right,#f0c800,#c8a200)', borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
                <span style={{ display: 'flex', color: '#666', marginLeft: 2 }}>
                  {showUserMenu ? <ChevronUp size={13} strokeWidth={ICON_STROKE} /> : <ChevronDown size={13} strokeWidth={ICON_STROKE} />}
                </span>
              </div>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    variants={dropdownVariants} initial="initial" animate="animate" exit="exit"
                    style={{ position: 'absolute', top: '110%', right: 0, width: 210, background: 'rgba(10,10,10,.97)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 1000, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>@{profile?.pseudo}</div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{user.email}</div>
                    </div>
                    {[
                      { Icon: User,      label: 'Mon profil',      to: '/profile' },
                      { Icon: Trophy,    label: 'Récompenses',     to: '/rewards' },
                      { Icon: BarChart3, label: 'Classements',     to: '/rankings' },
                      { Icon: Settings,  label: 'Paramètres',      to: '/settings' },
                      { Icon: Bug,       label: 'Signaler un bug', to: '/bug-report' },
                    ].map(item => (
                      <div key={item.to} onClick={() => { navigate(item.to); setShowUserMenu(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 12, color: '#ccc', transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#222'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <item.Icon size={15} strokeWidth={ICON_STROKE} style={{ color: '#f0c800' }} />{item.label}
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #2a2a2a' }}>
                      <div onClick={handleSignOut}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 12, color: '#e74c3c', transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#2a1a1a'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <LogOut size={15} strokeWidth={ICON_STROKE} /> Déconnexion
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!user && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login"><button style={{ padding: '0 12px', height: 34, border: '1px solid #333', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: '#ccc', fontSize: 12 }}>Connexion</button></Link>
              <Link to="/register"><button style={{ padding: '0 12px', height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(to bottom,#f0c800,#c8a200)', color: '#3a2e00', fontWeight: 700, fontSize: 12 }}>S'inscrire</button></Link>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}