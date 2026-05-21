export function SkeletonLine({ width = '100%', height = 14, mb = 8 }) {
  return <div className="skeleton" style={{ width, height, marginBottom: mb }} />
}

export function SkeletonAvatar({ size = 40 }) {
  return <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <SkeletonAvatar size={36} />
        <div style={{ flex: 1 }}>
          <SkeletonLine width="60%" height={13} mb={6} />
          <SkeletonLine width="40%" height={11} mb={0} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} mb={6} />
      ))}
    </div>
  )
}