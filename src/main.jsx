import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { ToastContainer } from './components/Toast.jsx'
import { ThemeProvider } from './hooks/ThemeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
    <ToastContainer />
  </ThemeProvider>
)