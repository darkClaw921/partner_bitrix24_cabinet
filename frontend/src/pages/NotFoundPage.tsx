import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>404</h1>
      <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)' }}>Страница не найдена</p>
      <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 8 }}>
        На главную
      </Link>
    </div>
  )
}
