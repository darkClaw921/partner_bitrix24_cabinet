import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLink, getEmbedCode, updateLink, type Link, type EmbedCode, type UpdateLinkData } from '@/api/links'
import LinkGenerator from '@/components/LinkGenerator'
import QRCodeBlock from '@/components/QRCodeBlock'
import { useToast } from '@/hooks/useToast'

const LINK_TYPE_LABELS: Record<string, string> = {
  direct: 'Прямая ссылка',
  iframe: 'iFrame (CRM-форма)',
  landing: 'Лендинг',
}

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [link, setLink] = useState<Link | null>(null)
  const [embedCode, setEmbedCode] = useState<EmbedCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editTargetUrl, setEditTargetUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [editUtmSource, setEditUtmSource] = useState('')
  const [editUtmMedium, setEditUtmMedium] = useState('')
  const [editUtmCampaign, setEditUtmCampaign] = useState('')
  const [editUtmContent, setEditUtmContent] = useState('')
  const [editUtmTerm, setEditUtmTerm] = useState('')

  const linkId = Number(id)

  const fetchData = async () => {
    try {
      const [linkData, embedData] = await Promise.all([
        getLink(linkId),
        getEmbedCode(linkId),
      ])
      setLink(linkData)
      setEmbedCode(embedData)
      setEditTitle(linkData.title)
      setEditTargetUrl(linkData.target_url || '')
      setEditUtmSource(linkData.utm_source || '')
      setEditUtmMedium(linkData.utm_medium || '')
      setEditUtmCampaign(linkData.utm_campaign || '')
      setEditUtmContent(linkData.utm_content || '')
      setEditUtmTerm(linkData.utm_term || '')
    } catch {
      setError('Не удалось загрузить данные ссылки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [linkId])

  const handleSave = async () => {
    if (!link) return
    setSaving(true)
    setError('')
    try {
      const data: UpdateLinkData = {}
      if (editTitle !== link.title) data.title = editTitle
      if (link.link_type === 'direct' && editTargetUrl !== link.target_url)
        data.target_url = editTargetUrl
      if (editUtmSource !== (link.utm_source || '')) data.utm_source = editUtmSource || undefined
      if (editUtmMedium !== (link.utm_medium || '')) data.utm_medium = editUtmMedium || undefined
      if (editUtmCampaign !== (link.utm_campaign || '')) data.utm_campaign = editUtmCampaign || undefined
      if (editUtmContent !== (link.utm_content || '')) data.utm_content = editUtmContent || undefined
      if (editUtmTerm !== (link.utm_term || '')) data.utm_term = editUtmTerm || undefined
      await updateLink(linkId, data)
      showToast('Ссылка обновлена', 'success')
      setEditing(false)
      await fetchData()
    } catch {
      setError('Не удалось сохранить изменения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  if (!link) {
    return <div style={styles.page}><div style={styles.error}>Ссылка не найдена</div></div>
  }

  const conversion = link.clicks_count > 0
    ? ((link.clients_count / link.clicks_count) * 100).toFixed(1)
    : '0.0'

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={() => navigate('/links')}>
        &larr; Назад к ссылкам
      </button>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            {editing ? (
              <input
                style={styles.editInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            ) : (
              <h1 style={styles.title}>{link.title}</h1>
            )}
            <div style={styles.meta}>
              <span style={styles.typeBadge}>{LINK_TYPE_LABELS[link.link_type]}</span>
              <span style={{
                ...styles.statusBadge,
                background: link.is_active ? '#e6f4ea' : '#fce8e6',
                color: link.is_active ? '#1e8e3e' : '#d93025',
              }}>
                {link.is_active ? 'Активна' : 'Неактивна'}
              </span>
              <span style={styles.date}>
                Создана: {new Date(link.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
          <div>
            {editing ? (
              <div style={styles.editActions}>
                <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button style={styles.btnSecondary} onClick={() => setEditing(false)}>
                  Отмена
                </button>
              </div>
            ) : (
              <button style={styles.btnSecondary} onClick={() => setEditing(true)}>
                Редактировать
              </button>
            )}
          </div>
        </div>

        {editing && link.link_type === 'direct' && (
          <div style={styles.field}>
            <label style={styles.label}>Целевой URL</label>
            <input
              style={styles.input}
              type="url"
              value={editTargetUrl}
              onChange={(e) => setEditTargetUrl(e.target.value)}
            />
          </div>
        )}

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{link.clicks_count}</div>
            <div style={styles.statLabel}>Кликов</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{link.clients_count}</div>
            <div style={styles.statLabel}>Клиентов</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{conversion}%</div>
            <div style={styles.statLabel}>Конверсия</div>
          </div>
        </div>

        {link.target_url && !editing && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Целевой URL:</span>
            <a href={link.target_url} target="_blank" rel="noopener noreferrer" style={styles.infoLink}>
              {link.target_url}
            </a>
          </div>
        )}

        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Код ссылки:</span>
          <code style={styles.code}>{link.link_code}</code>
        </div>

        {editing ? (
          <div style={styles.utmSection}>
            <h3 style={styles.utmTitle}>UTM-метки</h3>
            <div style={styles.utmGrid}>
              {[
                ['utm_source', editUtmSource, setEditUtmSource],
                ['utm_medium', editUtmMedium, setEditUtmMedium],
                ['utm_campaign', editUtmCampaign, setEditUtmCampaign],
                ['utm_content', editUtmContent, setEditUtmContent],
                ['utm_term', editUtmTerm, setEditUtmTerm],
              ].map(([name, val, setter]) => (
                <div key={name as string} style={styles.field}>
                  <label style={styles.label}>{name as string}</label>
                  <input
                    style={styles.input}
                    value={val as string}
                    onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    placeholder={name as string}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (link.utm_source || link.utm_medium || link.utm_campaign || link.utm_content || link.utm_term) ? (
          <div style={styles.utmSection}>
            <h3 style={styles.utmTitle}>UTM-метки</h3>
            {link.utm_source && <div style={styles.infoRow}><span style={styles.infoLabel}>utm_source:</span> {link.utm_source}</div>}
            {link.utm_medium && <div style={styles.infoRow}><span style={styles.infoLabel}>utm_medium:</span> {link.utm_medium}</div>}
            {link.utm_campaign && <div style={styles.infoRow}><span style={styles.infoLabel}>utm_campaign:</span> {link.utm_campaign}</div>}
            {link.utm_content && <div style={styles.infoRow}><span style={styles.infoLabel}>utm_content:</span> {link.utm_content}</div>}
            {link.utm_term && <div style={styles.infoRow}><span style={styles.infoLabel}>utm_term:</span> {link.utm_term}</div>}
          </div>
        ) : null}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>QR-код</h2>
        <QRCodeBlock url={`${window.location.origin}/api/public/r/${link.link_code}`} />
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Embed-код</h2>
        {embedCode && <LinkGenerator embedCode={embedCode} />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '900px', margin: '0 auto' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  backBtn: { background: 'none', border: 'none', color: '#1a73e8', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', padding: 0 },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 600, marginBottom: '8px' },
  editInput: { fontSize: '22px', fontWeight: 600, border: '1px solid #dadce0', borderRadius: '6px', padding: '4px 8px', width: '100%', marginBottom: '8px' },
  meta: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  typeBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, background: '#e8f0fe', color: '#1a73e8' },
  statusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  date: { fontSize: '13px', color: '#5f6368' },
  editActions: { display: 'flex', gap: '8px' },
  btnPrimary: { padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#1a73e8', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '16px', outline: 'none' },
  statsRow: { display: 'flex', gap: '16px', marginBottom: '20px' },
  statCard: { flex: 1, background: '#f8f9fa', borderRadius: '8px', padding: '16px', textAlign: 'center' },
  statValue: { fontSize: '28px', fontWeight: 700, color: '#202124' },
  statLabel: { fontSize: '13px', color: '#5f6368', marginTop: '4px' },
  infoRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '14px' },
  infoLabel: { color: '#5f6368', fontWeight: 500, whiteSpace: 'nowrap' },
  infoLink: { color: '#1a73e8', wordBreak: 'break-all' },
  code: { background: '#f1f3f4', padding: '2px 8px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '4px' },
  utmSection: { marginTop: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' },
  utmTitle: { fontSize: '15px', fontWeight: 600, marginBottom: '12px' },
  utmGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
}
