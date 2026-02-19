interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: string
}

export default function StatsCard({ title, value, subtitle, color = '#1a73e8' }: StatsCardProps) {
  const displayValue = String(value)
  const isLong = displayValue.length > 6

  return (
    <div style={styles.card}>
      <div style={{ ...styles.topBorder, background: color }} />
      <div style={styles.content}>
        <div style={styles.title}>{title}</div>
        <div style={{
          ...styles.value,
          fontSize: isLong ? '22px' : '32px',
        }}>{displayValue}</div>
        {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    overflow: 'hidden',
    flex: 1,
    minWidth: '160px',
  },
  topBorder: {
    height: '4px',
    width: '100%',
  },
  content: {
    padding: '20px',
  },
  title: {
    fontSize: '13px',
    color: '#5f6368',
    fontWeight: 500,
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  value: {
    fontWeight: 700,
    color: '#202124',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '12px',
    color: '#5f6368',
    marginTop: '6px',
  },
}
