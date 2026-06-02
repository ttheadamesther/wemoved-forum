import { LOGO_B64 } from '../lib/constants'

export const Logo = ({ height = 80 }) => (
  <img
    src={`data:image/png;base64,${LOGO_B64}`}
    alt="wemoved"
    style={{ height, display: 'block', cursor: 'pointer', objectFit: 'contain', imageRendering: 'auto' }}
  />
)
