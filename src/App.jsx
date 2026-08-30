import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import logoImg from './assets/logo.png'
import { AuthProvider } from './hooks/AuthContext'
import { useAuth } from './hooks/useAuth'
import Navbar        from './components/Navbar'
import Footer        from './components/Footer'
import Home          from './pages/Home'
import Forum         from './pages/Forum'
import Members       from './pages/Members'
import Messages      from './pages/Messages'
import Login         from './pages/Login'
import Register      from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Profile       from './pages/Profile'
import Settings      from './pages/Settings'
import React, { useRef, useEffect } from 'react'
import MemberProfile from './pages/MemberProfile'
import Notifications from './pages/Notifications'
import BugReport     from './pages/BugReport'
import Moderation    from './pages/Moderation'
import Legal         from './pages/Legal'
import Rewards       from './pages/Rewards'
import Rankings      from './pages/Rankings'
import Chatroom      from './pages/Chatroom'
import NotFound      from './pages/NotFound'
import { motion, AnimatePresence } from 'framer-motion'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 13, color: 'red' }}>
          <h2>💥 ERREUR CAPTURÉE</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.toString()}{'\n\n'}{this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#000000', gap: 4,
    }}>
      <img src={logoImg} alt="wemoved" style={{
        height: 100,
        animation: 'wm-pulse 2s ease-in-out infinite',
      }} />
      <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(to right, #f0c800, #c8a200)',
          animation: 'wm-bar 1.4s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes wm-pulse {
          0%,100% { filter: drop-shadow(0 0 8px rgba(200,162,0,.3)); }
          50% { filter: drop-shadow(0 0 20px rgba(200,162,0,.7)); }
        }
        @keyframes wm-bar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading || user === undefined) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading || user === undefined) return null
  if (user) return <Navigate to="/" replace />
  return children
}

function Layout({ children }) {
  const isMobile = window.innerWidth < 768
  return (
    <div style={{
      paddingTop: isMobile ? 56 : 80,
      paddingBottom: isMobile ? 72 : 0,
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ flex: 1 }}>{children}</div>
      {!isMobile && <Footer />}
    </div>
  )
}

// Routes qui n'affichent pas la navbar/footer (écrans d'auth).
const NO_CHROME_PATHS = ['/login', '/register', '/reset-password']

// ── Transition directionnelle (style bottom nav Facebook) ──
// Ordre des onglets dans la bottom nav mobile : sert à savoir si on va
// "vers la droite" (direction 1) ou "vers la gauche" (direction -1).
const TAB_ORDER = ['/', '/forum', '/profile', '/messages', '/members', '/chat']

function getTabIndex(pathname) {
  return TAB_ORDER.indexOf(pathname)
}

const isMobileUA = () => window.innerWidth < 768
const SLIDE_DISTANCE = 30

// Slide + fade rapide façon Facebook : pas de spring/rebond, juste un ease-out net.
const enterTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
const exitTransition   = { duration: 0.22, ease: [0.4, 0, 0.2, 1] }

const pageVariants = {
  initial: (direction) => ({
    opacity: 0,
    x: direction && isMobileUA() ? direction * SLIDE_DISTANCE : 0,
  }),
  animate: {
    opacity: 1, x: 0,
    transition: enterTransition,
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction && isMobileUA() ? direction * -SLIDE_DISTANCE : 0,
    transition: exitTransition,
  }),
}

function PageTransition({ children, direction }) {
  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const { loading } = useAuth()
  const location = useLocation()
  const prevIndexRef = useRef(getTabIndex(location.pathname))

  // Comme Facebook : on remonte en haut à chaque changement de page,
  // sinon le scroll résiduel force le navigateur mobile à réajuster la
  // vue (barre d'adresse qui se cache/réapparaît) et la navbar fixe "saute".
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (loading) return <Loader />

  const currentIndex = getTabIndex(location.pathname)
  const prevIndex = prevIndexRef.current
  const direction = (currentIndex === -1 || prevIndex === -1 || currentIndex === prevIndex)
    ? 0
    : (currentIndex > prevIndex ? 1 : -1)
  prevIndexRef.current = currentIndex

  const showChrome = !NO_CHROME_PATHS.includes(location.pathname)

  // Navbar rendue une seule fois ici, en dehors des routes animées :
  // avant, elle était recréée par <Layout> à chaque changement de page,
  // ce qui la faisait "sauter" pendant la transition.
  return (
    <>
      {showChrome && <Navbar />}
      {/* popLayout : la page qui sort est retirée du flux immédiatement, donc la
          page qui entre ne "l'attend" pas — les deux animations tournent en même
          temps (crossfade fluide) au lieu de s'enchaîner (mode="wait" = saccadé). */}
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login"          element={<PublicOnlyRoute><PageTransition direction={direction}><Login /></PageTransition></PublicOnlyRoute>} />
          <Route path="/register"       element={<PublicOnlyRoute><PageTransition direction={direction}><Register /></PageTransition></PublicOnlyRoute>} />
          <Route path="/reset-password" element={<PageTransition direction={direction}><ResetPassword /></PageTransition>} />
          <Route path="/"         element={<Layout><PageTransition direction={direction}><Home /></PageTransition></Layout>} />
          <Route path="/forum"           element={<Layout><PageTransition direction={direction}><Forum /></PageTransition></Layout>} />
          <Route path="/forum/:threadId" element={<Layout><PageTransition direction={direction}><Forum /></PageTransition></Layout>} />
          <Route path="/members"  element={<Layout><PageTransition direction={direction}><Members /></PageTransition></Layout>} />
          <Route path="/members/:id" element={<Layout><PageTransition direction={direction}><MemberProfile /></PageTransition></Layout>} />
          <Route path="/legal"    element={<Layout><PageTransition direction={direction}><Legal /></PageTransition></Layout>} />
          <Route path="/rewards"  element={<Layout><PageTransition direction={direction}><Rewards /></PageTransition></Layout>} />
          <Route path="/rankings" element={<Layout><PageTransition direction={direction}><Rankings /></PageTransition></Layout>} />
          <Route path="/chat"     element={<Layout><PageTransition direction={direction}><Chatroom /></PageTransition></Layout>} />
          <Route path="/messages"      element={<PrivateRoute><Layout><PageTransition direction={direction}><Messages /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/bug-report"    element={<PrivateRoute><Layout><PageTransition direction={direction}><BugReport /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/moderation"    element={<PrivateRoute><Layout><PageTransition direction={direction}><Moderation /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Layout><PageTransition direction={direction}><Notifications /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/profile"       element={<PrivateRoute><Layout><PageTransition direction={direction}><ErrorBoundary><Profile /></ErrorBoundary></PageTransition></Layout></PrivateRoute>} />
          <Route path="/settings"      element={<PrivateRoute><Layout><PageTransition direction={direction}><Settings /></PageTransition></Layout></PrivateRoute>} />
          <Route path="*" element={<PageTransition direction={direction}><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}