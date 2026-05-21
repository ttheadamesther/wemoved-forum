import { useState, useEffect } from 'react'

export function useCountdown() {
  const [t, setT] = useState('')
  useEffect(() => {
    const calc = () => {
      const now = new Date(), end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const d = end - now
      setT(`${Math.floor(d / 86400000)}j ${Math.floor((d % 86400000) / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`)
    }
    calc()
    const id = setInterval(calc, 60000)
    return () => clearInterval(id)
  }, [])
  return t
}
