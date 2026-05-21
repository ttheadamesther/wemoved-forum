import { useEffect, useState } from 'react'

let addToast = () => {}

export function toast(message, type = 'info', duration = 3500) {
  addToast({ message, type, duration, id: Date.now() })
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    addToast = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.map(x => x.id === t.id ? { ...x, out: true } : x))
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 350)
      }, t.duration)
    }
  }, [])

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }

  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}${t.out ? ' out' : ''}`}>
          <span style={{ fontSize: 16 }}>{icons[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}