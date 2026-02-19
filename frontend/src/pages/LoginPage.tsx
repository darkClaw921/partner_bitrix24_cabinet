import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const me = await login(email, password)
      navigate(me.role === 'admin' ? '/admin' : '/dashboard')
    } catch {
      setError('Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Вход</h1>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="email@example.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="Введите пароль"
            />
          </div>
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <p style={styles.link}>
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    marginBottom: '24px',
    fontSize: '24px',
    textAlign: 'center' as const,
  },
  error: {
    background: '#fce8e6',
    color: '#d93025',
    padding: '10px 14px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#5f6368',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    marginTop: '8px',
  },
  link: {
    marginTop: '16px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#5f6368',
  },
}
