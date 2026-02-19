import { useEffect, useState, type FormEvent } from 'react'
import { createNotification, getAdminNotifications, deleteNotification, type AdminNotification } from '@/api/admin'

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const loadNotifications = () => {
    getAdminNotifications()
      .then((data) => setNotifications(data.notifications))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setSending(true)
    try {
      await createNotification({ title: title.trim(), message: message.trim() })
      setTitle('')
      setMessage('')
      loadNotifications()
    } catch {
      // error handled by interceptor
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить уведомление?')) return
    try {
      await deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      // error handled by interceptor
    }
  }

  return (
    <div>
      <div style={styles.card}>
        <h2 style={styles.title}>Новое уведомление</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Заголовок</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={styles.input}
              placeholder="Заголовок уведомления"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              style={styles.textarea}
              placeholder="Текст уведомления для всех партнёров..."
              rows={4}
            />
          </div>
          <button type="submit" disabled={sending} style={styles.button}>
            {sending ? 'Отправка...' : 'Создать уведомление'}
          </button>
        </form>
      </div>

      <div style={{ ...styles.card, marginTop: '24px' }}>
        <h2 style={styles.title}>Все уведомления ({notifications.length})</h2>
        {loading ? (
          <div>Загрузка...</div>
        ) : notifications.length === 0 ? (
          <div style={styles.empty}>Нет уведомлений</div>
        ) : (
          <div style={styles.list}>
            {notifications.map((n) => (
              <div key={n.id} style={styles.notificationItem}>
                <div style={styles.notificationContent}>
                  <div style={styles.notificationTitle}>{n.title}</div>
                  <div style={styles.notificationMessage}>{n.message}</div>
                  <div style={styles.notificationDate}>
                    {new Date(n.created_at).toLocaleString('ru-RU')}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  style={styles.deleteButton}
                  title="Удалить"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '24px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#202124',
    margin: '0 0 16px 0',
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
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  button: {
    padding: '10px 24px',
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  empty: {
    color: '#5f6368',
    fontSize: '14px',
    textAlign: 'center' as const,
    padding: '20px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  notificationItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '16px',
    border: '1px solid #e8eaed',
    borderRadius: '8px',
    gap: '12px',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#202124',
    marginBottom: '4px',
  },
  notificationMessage: {
    fontSize: '14px',
    color: '#5f6368',
    marginBottom: '8px',
    whiteSpace: 'pre-wrap' as const,
  },
  notificationDate: {
    fontSize: '12px',
    color: '#80868b',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: '#d93025',
    cursor: 'pointer',
    padding: '4px',
    flexShrink: 0,
  },
}
