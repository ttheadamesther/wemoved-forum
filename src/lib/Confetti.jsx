import { useEffect } from 'react'

const COLORS = ['#f0c800','#c8a200','#2ecc71','#3498db','#e74c3c','#9b59b6','#e67e22','#1abc9c']

export function triggerConfetti() {
  const count = 60
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.left = Math.random() * 100 + 'vw'
    el.style.top = '-20px'
    el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)]
    el.style.width  = (Math.random() * 8 + 6) + 'px'
    el.style.height = (Math.random() * 8 + 6) + 'px'
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
    el.style.animationDuration = (Math.random() * 2 + 2) + 's'
    el.style.animationDelay = (Math.random() * 0.5) + 's'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }
}