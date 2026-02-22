import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getPartnerMessages,
  sendPartnerMessage,
  sendPartnerFile,
  markPartnerMessagesRead,
  type ChatMessage,
} from '@/api/chat'

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getPartnerMessages()
      setMessages(data)
    } catch { /* handled by interceptor */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchMessages()
    markPartnerMessagesRead().catch(() => {})
  }, [fetchMessages])

  // Polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getPartnerMessages()
        setMessages(data)
        markPartnerMessagesRead().catch(() => {})
      } catch { /* ignore */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    const trimmed = text.trim()
    if ((!trimmed && !selectedFile) || sending) return
    setSending(true)
    try {
      let msg: ChatMessage
      if (selectedFile) {
        msg = await sendPartnerFile(selectedFile, trimmed || undefined)
        setSelectedFile(null)
      } else {
        msg = await sendPartnerMessage(trimmed)
      }
      setMessages(prev => [...prev, msg])
      setText('')
    } catch { /* handled by interceptor */ }
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
      <div style={styles.messagesArea} ref={containerRef}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <div style={styles.emptyTitle}>Нет сообщений</div>
            <div style={styles.emptyText}>Напишите сообщение, чтобы начать переписку с поддержкой</div>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...styles.messageRow,
              justifyContent: msg.is_from_admin ? 'flex-start' : 'flex-end',
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(msg.is_from_admin ? styles.adminBubble : styles.partnerBubble),
              }}
            >
              {msg.is_from_admin && (
                <div style={styles.senderName}>{msg.sender_name}</div>
              )}
              {msg.file_url && <FileContent msg={msg} />}
              {msg.message && <div style={styles.messageText}>{msg.message}</div>}
              <div style={{
                ...styles.messageTime,
                color: msg.is_from_admin ? '#5f6368' : 'rgba(255,255,255,0.7)',
              }}>
                {formatTime(msg.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {selectedFile && (
        <div style={styles.filePreview}>
          <span style={styles.filePreviewName}>{selectedFile.name}</span>
          <button style={styles.filePreviewRemove} onClick={() => setSelectedFile(null)}>✕</button>
        </div>
      )}
      <div style={styles.inputArea}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) setSelectedFile(f)
            e.target.value = ''
          }}
        />
        <button style={styles.attachBtn} onClick={() => fileInputRef.current?.click()} disabled={sending}>
          <AttachIcon />
        </button>
        <textarea
          style={styles.input}
          placeholder="Введите сообщение..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: (!text.trim() && !selectedFile || sending) ? 0.5 : 1,
          }}
          onClick={handleSend}
          disabled={(!text.trim() && !selectedFile) || sending}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

function isImageFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTENSIONS.includes(ext)
}

function FileContent({ msg }: { msg: ChatMessage }) {
  if (!msg.file_url || !msg.file_name) return null
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || ''
  const fullUrl = `${apiBase}${msg.file_url}`
  if (isImageFile(msg.file_name)) {
    return (
      <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: msg.message ? 6 : 0 }}>
        <img src={fullUrl} alt={msg.file_name} style={{ maxWidth: 300, maxHeight: 300, borderRadius: 8, display: 'block' }} />
      </a>
    )
  }
  return (
    <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={styles.fileLink}>
      <span style={{ marginRight: 6 }}>📄</span>{msg.file_name}
    </a>
  )
}

function AttachIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
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
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    maxWidth: 800,
    margin: '0 auto',
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
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#5f6368',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' as const },
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
    background: '#f1f3f4',
    color: '#202124',
    borderBottomLeftRadius: 4,
  },
  partnerBubble: {
    background: '#1a73e8',
    color: '#fff',
    borderBottomRightRadius: 4,
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
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#5f6368',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    background: '#e8f0fe',
    borderTop: '1px solid #e0e0e0',
    fontSize: 13,
    color: '#1a73e8',
  },
  filePreviewName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  filePreviewRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#5f6368',
    padding: '0 4px',
  },
  fileLink: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: 'inherit',
    textDecoration: 'underline',
    marginBottom: 4,
  },
}
