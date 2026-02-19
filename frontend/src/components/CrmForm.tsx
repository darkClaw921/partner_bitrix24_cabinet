import { useState, useEffect, type FormEvent } from 'react'
import { createClient, type CreateClientData } from '@/api/clients'
import { getLinks, type Link } from '@/api/links'
import { useToast } from '@/hooks/useToast'

interface CrmFormProps {
  onCreated: () => void
}

export default function CrmForm({ onCreated }: CrmFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [comment, setComment] = useState('')
  const [linkId, setLinkId] = useState('')
  const [links, setLinks] = useState<Link[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    getLinks().then(setLinks).catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!phone && !email) {
      setError('Укажите телефон или email')
      return
    }

    setSubmitting(true)
    try {
      const data: CreateClientData = { name }
      if (phone) data.phone = phone
      if (email) data.email = email
      if (company) data.company = company
      if (comment) data.comment = comment
      if (linkId) data.link_id = Number(linkId)

      await createClient(data)
      setName('')
      setPhone('')
      setEmail('')
      setCompany('')
      setComment('')
      setLinkId('')
      setSuccess('Клиент успешно добавлен')
      showToast('Клиент добавлен', 'success')
      onCreated()
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Не удалось добавить клиента')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Добавить клиента вручную</h3>
      <form onSubmit={handleSubmit}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Имя *</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Иван Иванов"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Телефон</label>
            <input
              style={styles.input}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 900 123-45-67"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Компания</label>
            <input
              style={styles.input}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="ООО Компания"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Привязка к ссылке</label>
            <select
              style={styles.input}
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
            >
              <option value="">— Без привязки —</option>
              {links.filter((l) => l.is_active).map((l) => (
                <option key={l.id} value={l.id}>{l.title} ({l.link_code})</option>
              ))}
            </select>
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Комментарий</label>
          <textarea
            style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Дополнительная информация"
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <button type="submit" disabled={submitting} style={styles.btn}>
          {submitting ? 'Добавление...' : 'Добавить клиента'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '24px' },
  title: { marginBottom: '16px', fontSize: '18px', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' },
  field: { marginBottom: '0' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' },
  btn: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  error: { background: '#fce8e6', color: '#d93025', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' },
  success: { background: '#e6f4ea', color: '#1e8e3e', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' },
}
