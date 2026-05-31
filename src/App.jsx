import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/"         element={<Layout><Home /></Layout>} />
            <Route path="/forum"    element={<Layout><Forum /></Layout>} />
            <Route path="/members"  element={<Layout><Members /></Layout>} />
            <Route path="/members/:id" element={<Layout><MemberProfile /></Layout>} />
            <Route path="/legal"    element={<Layout><Legal /></Layout>} />
            <Route path="/rewards"  element={<Layout><Rewards /></Layout>} />
            <Route path="/rankings" element={<Layout><Rankings /></Layout>} />
            <Route path="/chat"     element={<Layout><Chatroom /></Layout>} />
            <Route path="/messages"      element={<PrivateRoute><Layout><Messages /></Layout></PrivateRoute>} />
            <Route path="/bug-report"    element={<PrivateRoute><Layout><BugReport /></Layout></PrivateRoute>} />
            <Route path="/moderation"    element={<PrivateRoute><Layout><Moderation /></Layout></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Layout><Notifications /></Layout></PrivateRoute>} />
            <Route path="/profile"       element={<PrivateRoute><Layout><ErrorBoundary><Profile /></ErrorBoundary></Layout></PrivateRoute>} />
            <Route path="/settings"      element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}