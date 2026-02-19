import { useEffect, useState, useRef, useCallback } from 'react'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type PartnerNotification } from '@/api/notifications'

const POLL_INTERVAL = 30000

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<PartnerNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(() => {
    getUnreadCount().then((data) => setUnreadCount(data.count)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = async () => {
    if (!isOpen) {
      setLoading(true)
      try {
        const data = await getNotifications()
        setNotifications(data.notifications)
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false)
      }
    }
    setIsOpen(!isOpen)
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // handled by interceptor
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // handled by interceptor
    }
  }

  return (
    <div ref={dropdownRef} style={styles.container}>
      <button onClick={toggleOpen} style={styles.bellButton} title="Уведомления">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Уведомления</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} style={styles.markAllButton}>
                Прочитать все
              </button>
            )}
          </div>
          <div style={styles.dropdownList}>
            {loading ? (
              <div style={styles.emptyState}>Загрузка...</div>
            ) : notifications.length === 0 ? (
              <div style={styles.emptyState}>Нет уведомлений</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    ...styles.notificationItem,
                    background: n.is_read ? '#fff' : '#e8f0fe',
                  }}
                  onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                >
                  {!n.is_read && <div style={styles.unreadDot} />}
                  <div style={styles.notificationContent}>
                    <div style={styles.notificationTitle}>{n.title}</div>
                    <div style={styles.notificationMessage}>{n.message}</div>
                    <div style={styles.notificationDate}>
                      {new Date(n.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    color: '#5f6368',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: '#d93025',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    lineHeight: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '360px',
    maxHeight: '480px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: 1000,
    overflow: 'hidden',
    marginTop: '8px',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #e8eaed',
  },
  dropdownTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#202124',
  },
  markAllButton: {
    background: 'none',
    border: 'none',
    color: '#1a73e8',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  dropdownList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center' as const,
    color: '#5f6368',
    fontSize: '14px',
  },
  notificationItem: {
    display: 'flex',
    gap: '10px',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f3f4',
    cursor: 'pointer',
    transition: 'background 0.15s',
    alignItems: 'flex-start',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#1a73e8',
    flexShrink: 0,
    marginTop: '6px',
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#202124',
    marginBottom: '2px',
  },
  notificationMessage: {
    fontSize: '13px',
    color: '#5f6368',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical' as const,
    whiteSpace: 'pre-line' as const,
  },
  notificationDate: {
    fontSize: '11px',
    color: '#80868b',
  },
}
