import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAdminConversations,
  getAdminConversationMessages,
  sendAdminMessage,
  markAdminMessagesRead,
  type ChatConversationPreview,
  type ChatMessage,
} from '@/api/chat'

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<ChatConversationPreview[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getAdminConversations()
      setConversations(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Polling conversations + messages every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const convs = await getAdminConversations()
        setConversations(convs)
        if (selectedId) {
          const msgs = await getAdminConversationMessages(selectedId)
          setMessages(msgs)
        }
      } catch { /* ignore */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [selectedId])

  const selectConversation = useCallback(async (partnerId: number) => {
    setSelectedId(partnerId)
    setMsgsLoading(true)
    setMessages([])
    try {
      const msgs = await getAdminConversationMessages(partnerId)
      setMessages(msgs)
      markAdminMessagesRead(partnerId).catch(() => {})
      // Update unread count locally
      setConversations(prev =>
        prev.map(c => c.partner_id === partnerId ? { ...c, unread_count: 0 } : c)
      )
    } catch { /* ignore */ }
    finally { setMsgsLoading(false) }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    if (!selectedId || !text.trim() || sending) return
    setSending(true)
    try {
      const msg = await sendAdminMessage(selectedId, text.trim())
      setMessages(prev => [...prev, msg])
      setText('')
      // Update last message in conversation list
      setConversations(prev =>
        prev.map(c =>
          c.partner_id === selectedId
            ? { ...c, last_message: msg.message, last_message_at: msg.created_at }
            : c
        )
      )
    } catch { /* ignore */ }
    finally { setSending(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return <div style={styles.loading}>Загрузка...</div>
  }

  return (
    <div style={styles.container}>
      {/* Conversations list */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>Переписки</div>
        {conversations.length === 0 && (
          <div style={styles.emptyConvs}>Нет переписок</div>
        )}
        {conversations.map(conv => (
          <div
            key={conv.partner_id}
            style={{
              ...styles.convItem,
              background: selectedId === conv.partner_id ? '#e8f0fe' : 'transparent',
            }}
            onClick={() => selectConversation(conv.partner_id)}
          >
            <div style={styles.convTop}>
              <div style={styles.convName}>{conv.partner_name}</div>
              {conv.unread_count > 0 && (
                <span style={styles.badge}>{conv.unread_count}</span>
              )}
            </div>
            <div style={styles.convEmail}>{conv.partner_email}</div>
            <div style={styles.convPreview}>{conv.last_message}</div>
            <div style={styles.convTime}>{formatTime(conv.last_message_at)}</div>
          </div>
        ))}
      </div>

      {/* Messages area */}
      <div style={styles.chatArea}>
        {!selectedId ? (
          <div style={styles.noChat}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div>Выберите переписку слева</div>
          </div>
        ) : msgsLoading ? (
          <div style={styles.noChat}>Загрузка сообщений...</div>
        ) : (
          <>
            <div style={styles.chatHeader}>
              {conversations.find(c => c.partner_id === selectedId)?.partner_name || 'Чат'}
            </div>
            <div style={styles.messagesArea}>
              {messages.length === 0 && (
                <div style={styles.noChat}>Нет сообщений в этой переписке</div>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: msg.is_from_admin ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      ...(msg.is_from_admin ? styles.adminBubble : styles.partnerBubble),
                    }}
                  >
                    {!msg.is_from_admin && (
                      <div style={styles.senderName}>{msg.sender_name}</div>
                    )}
                    <div style={styles.messageText}>{msg.message}</div>
                    <div style={{
                      ...styles.messageTime,
                      color: msg.is_from_admin ? 'rgba(255,255,255,0.7)' : '#5f6368',
                    }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={styles.inputArea}>
              <textarea
                style={styles.input}
                placeholder="Введите ответ..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                style={{
                  ...styles.sendBtn,
                  opacity: (!text.trim() || sending) ? 0.5 : 1,
                }}
                onClick={handleSend}
                disabled={!text.trim() || sending}
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 80px)',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
    color: '#5f6368',
  },
  // Sidebar (conversations list)
  sidebar: {
    width: 320,
    minWidth: 280,
    borderRight: '1px solid #e0e0e0',
    overflowY: 'auto',
    background: '#fafafa',
  },
  sidebarHeader: {
    padding: '16px 20px',
    fontSize: 16,
    fontWeight: 600,
    borderBottom: '1px solid #e0e0e0',
    color: '#202124',
  },
  emptyConvs: {
    padding: 20,
    textAlign: 'center' as const,
    color: '#5f6368',
    fontSize: 14,
  },
  convItem: {
    padding: '12px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.15s',
  },
  convTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  convName: {
    fontWeight: 600,
    fontSize: 14,
    color: '#202124',
  },
  badge: {
    background: '#d93025',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
  },
  convEmail: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 4,
  },
  convPreview: {
    fontSize: 13,
    color: '#5f6368',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  convTime: {
    fontSize: 11,
    color: '#9aa0a6',
    marginTop: 4,
  },
  // Chat area
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  noChat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#5f6368',
    fontSize: 15,
  },
  chatHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid #e0e0e0',
    fontWeight: 600,
    fontSize: 15,
    color: '#202124',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    borderRadius: 16,
    wordBreak: 'break-word' as const,
  },
  adminBubble: {
    background: '#1a73e8',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  partnerBubble: {
    background: '#f1f3f4',
    color: '#202124',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1a73e8',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right' as const,
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  input: {
    flex: 1,
    border: '1px solid #dadce0',
    borderRadius: 20,
    padding: '10px 16px',
    fontSize: 14,
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'inherit',
    lineHeight: '1.4',
    maxHeight: 120,
    overflowY: 'auto' as const,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: '#1a73e8',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}
