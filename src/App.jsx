import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import Profile       from './pages/Profile'
import Settings      from './pages/Settings'
import React         from 'react'
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#d8d8d8', color: '#888', fontSize: 13 }}>
      Chargement…
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

// Rideau doré + blur sur le contenu
const curtainVariants = {
  initial: { scaleY: 0, originY: '0%' },
  animate: {
    scaleY: 1,
    transition: { duration: 0.32, ease: [0.76, 0, 0.24, 1] }
  },
  exit: {
    scaleY: 0,
    originY: '100%',
    transition: { duration: 0.32, ease: [0.76, 0, 0.24, 1], delay: 0.08 }
  },
}

const pageVariants = {
  initial: { opacity: 0, filter: 'blur(5px)', y: 8 },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.28 }
  },
  exit: {
    opacity: 0,
    filter: 'blur(3px)',
    y: -6,
    transition: { duration: 0.18, ease: 'easeIn' }
  },
}

function PageTransition({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

function Layout({ children }) {
  const isMobile = window.innerWidth < 768
  return (
    <>
      <Navbar />
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
    </>
  )
}

// Rideau global monté une seule fois, piloté par le pathname
function CurtainOverlay() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={curtainVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--gold, #D4A017)',
          zIndex: 9999,
          pointerEvents: 'none',
          transformOrigin: 'top',
        }}
      />
    </AnimatePresence>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <>
      <CurtainOverlay />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login"    element={<PublicOnlyRoute><PageTransition><Login /></PageTransition></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><PageTransition><Register /></PageTransition></PublicOnlyRoute>} />
          <Route path="/"         element={<Layout><PageTransition><Home /></PageTransition></Layout>} />
          <Route path="/forum"           element={<Layout><PageTransition><Forum /></PageTransition></Layout>} />
          <Route path="/forum/:threadId" element={<Layout><PageTransition><Forum /></PageTransition></Layout>} />
          <Route path="/members"  element={<Layout><PageTransition><Members /></PageTransition></Layout>} />
          <Route path="/members/:id" element={<Layout><PageTransition><MemberProfile /></PageTransition></Layout>} />
          <Route path="/legal"    element={<Layout><PageTransition><Legal /></PageTransition></Layout>} />
          <Route path="/rewards"  element={<Layout><PageTransition><Rewards /></PageTransition></Layout>} />
          <Route path="/rankings" element={<Layout><PageTransition><Rankings /></PageTransition></Layout>} />
          <Route path="/chat"     element={<Layout><PageTransition><Chatroom /></PageTransition></Layout>} />
          <Route path="/messages"      element={<PrivateRoute><Layout><PageTransition><Messages /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/bug-report"    element={<PrivateRoute><Layout><PageTransition><BugReport /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/moderation"    element={<PrivateRoute><Layout><PageTransition><Moderation /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Layout><PageTransition><Notifications /></PageTransition></Layout></PrivateRoute>} />
          <Route path="/profile"       element={<PrivateRoute><Layout><PageTransition><ErrorBoundary><Profile /></ErrorBoundary></PageTransition></Layout></PrivateRoute>} />
          <Route path="/settings"      element={<PrivateRoute><Layout><PageTransition><Settings /></PageTransition></Layout></PrivateRoute>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
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