import { LOGO_B64 } from '../lib/constants'
import { useTheme } from '../hooks/ThemeContext'

export const Logo = ({ height = 200 }) => {
  const { dark } = useTheme()
  return (
    <img
      src={`data:image/png;base64,${LOGO_B64}`}
      alt="wemoved"
      style={{
        height,
        display: 'block',
        cursor: 'pointer',
        objectFit: 'contain',
        imageRendering: 'auto',
        mixBlendMode: dark ? 'normal' : 'multiply',
      }}
    />
  )
}