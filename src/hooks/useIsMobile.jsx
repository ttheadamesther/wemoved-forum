import { useState, useEffect } from 'react'

// Un téléphone reste un téléphone en paysage.
// On détecte l'APPAREIL (pointeur tactile, pas de survol) et pas la largeur,
// sinon un S25 Ultra à l'horizontal (~900px de large) bascule en layout desktop.
const MOBILE_QUERY = '(pointer: coarse) and (hover: none)'

function detect() {
  if (typeof window === 'undefined') return false
  const touch = window.matchMedia?.(MOBILE_QUERY)?.matches
  if (touch) return true
  // Fallback : vraie petite fenêtre (desktop redimensionné, anciens navigateurs)
  return Math.min(window.innerWidth, window.innerHeight) < 768
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detect)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(detect())
    mq.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      mq.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return isMobile
}

// Vrai quand on est sur un mobile tenu à l'horizontal (hauteur très réduite).
export function useIsLandscape() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerHeight < 500 && window.innerWidth > window.innerHeight
  )
  useEffect(() => {
    const update = () => setLandscape(window.innerHeight < 500 && window.innerWidth > window.innerHeight)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return landscape
}

export default useIsMobile