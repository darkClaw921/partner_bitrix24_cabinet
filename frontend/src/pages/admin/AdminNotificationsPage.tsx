import { useEffect, useState, useRef, type FormEvent } from 'react'
import { createNotification, getAdminNotifications, deleteNotification, type AdminNotification } from '@/api/admin'

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(name)
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      await createNotification({
        title: title.trim(),
        message: message.trim(),
        file: file || undefined,
      })
      setTitle('')
      setMessage('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
          <div style={styles.field}>
            <label style={styles.label}>Файл (необязательно)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={styles.fileInput}
            />
            {file && (
              <div style={styles.filePreview}>
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    style={styles.previewImage}
                  />
                ) : (
                  <span style={styles.fileName}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                )}
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  style={styles.removeFileButton}
                >
                  Удалить файл
                </button>
              </div>
            )}
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
                  <div style={styles.notificationTitle}>
                    {n.title}
                    {n.file_url && <span style={styles.fileIndicator}> 📎</span>}
                  </div>
                  <div style={styles.notificationMessage}>{n.message}</div>
                  {n.file_url && n.file_name && (
                    <div style={styles.notificationFile}>
                      {isImageFile(n.file_name) ? (
                        <img src={n.file_url} alt={n.file_name} style={styles.thumbnailSmall} />
                      ) : (
                        <a href={n.file_url} target="_blank" rel="noopener noreferrer" style={styles.fileLink}>
                          📎 {n.file_name}
                        </a>
                      )}
                    </div>
                  )}
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
  fileInput: {
    fontSize: '14px',
  },
  filePreview: {
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  previewImage: {
    maxHeight: '80px',
    maxWidth: '120px',
    borderRadius: '4px',
    objectFit: 'cover' as const,
  },
  fileName: {
    fontSize: '13px',
    color: '#5f6368',
  },
  removeFileButton: {
    background: 'none',
    border: '1px solid #dadce0',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#d93025',
    cursor: 'pointer',
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
  notificationFile: {
    marginBottom: '8px',
  },
  thumbnailSmall: {
    maxHeight: '60px',
    maxWidth: '100px',
    borderRadius: '4px',
    objectFit: 'cover' as const,
  },
  fileLink: {
    fontSize: '13px',
    color: '#1a73e8',
    textDecoration: 'none',
  },
  fileIndicator: {
    fontSize: '14px',
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
