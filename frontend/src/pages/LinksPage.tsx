import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLinks,
  createLink,
  deleteLink,
  type Link,
  type LinkType,
  type CreateLinkData,
} from '@/api/links'
import { getLandings, type Landing } from '@/api/landings'
import { useToast } from '@/hooks/useToast'
import QRCodeBlock from '@/components/QRCodeBlock'

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  direct: 'Прямая',
  iframe: 'iFrame',
  landing: 'Лендинг',
}

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  direct: '#1a73e8',
  iframe: '#e8710a',
  landing: '#1e8e3e',
}

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('direct')
  const [targetUrl, setTargetUrl] = useState('')
  const [landingId, setLandingId] = useState('')
  const [landings, setLandings] = useState<Landing[]>([])
  const [landingsLoading, setLandingsLoading] = useState(false)
  const [qrLink, setQrLink] = useState<Link | null>(null)
  const [showUtm, setShowUtm] = useState(false)
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [utmContent, setUtmContent] = useState('')
  const [utmTerm, setUtmTerm] = useState('')

  const navigate = useNavigate()
  const { showToast } = useToast()

  const fetchLinks = async () => {
    try {
      const data = await getLinks()
      setLinks(data)
    } catch {
      setError('Не удалось загрузить ссылки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLinks()
  }, [])

  useEffect(() => {
    if (linkType === 'landing' && landings.length === 0) {
      setLandingsLoading(true)
      getLandings()
        .then((data) => setLandings(data.filter((l) => l.is_active)))
        .catch(() => {})
        .finally(() => setLandingsLoading(false))
    }
  }, [linkType])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const data: CreateLinkData = { title, link_type: linkType }
      if (linkType === 'direct') data.target_url = targetUrl
      if (linkType === 'landing') data.landing_id = Number(landingId)
      if (utmSource) data.utm_source = utmSource
      if (utmMedium) data.utm_medium = utmMedium
      if (utmCampaign) data.utm_campaign = utmCampaign
      if (utmContent) data.utm_content = utmContent
      if (utmTerm) data.utm_term = utmTerm
      await createLink(data)
      showToast('Ссылка создана', 'success')
      setShowForm(false)
      setTitle('')
      setTargetUrl('')
      setLandingId('')
      setLinkType('direct')
      setUtmSource(''); setUtmMedium(''); setUtmCampaign(''); setUtmContent(''); setUtmTerm('')
      setShowUtm(false)
      await fetchLinks()
    } catch {
      setError('Не удалось создать ссылку')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Деактивировать ссылку?')) return
    try {
      await deleteLink(id)
      showToast('Ссылка деактивирована', 'success')
      await fetchLinks()
    } catch {
      setError('Не удалось деактивировать ссылку')
    }
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Партнёрские ссылки</h1>
        <button style={styles.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Создать ссылку'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Новая ссылка</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.field}>
              <label style={styles.label}>Название</label>
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Например: Ссылка для Instagram"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Тип ссылки</label>
              <select
                style={styles.input}
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as LinkType)}
              >
                <option value="direct">Прямая ссылка</option>
                <option value="iframe">iFrame (CRM-форма)</option>
                <option value="landing">Лендинг</option>
              </select>
            </div>
            {linkType === 'direct' && (
              <div style={styles.field}>
                <label style={styles.label}>Целевой URL</label>
                <input
                  style={styles.input}
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                  placeholder="https://example.com"
                />
              </div>
            )}
            {linkType === 'landing' && (
              <div style={styles.field}>
                <label style={styles.label}>Лендинг</label>
                {landingsLoading ? (
                  <div style={styles.hint}>Загрузка лендингов...</div>
                ) : landings.length === 0 ? (
                  <div style={styles.hint}>Нет активных лендингов. Создайте лендинг в разделе «Лендинги».</div>
                ) : (
                  <select
                    style={styles.input}
                    value={landingId}
                    onChange={(e) => setLandingId(e.target.value)}
                    required
                  >
                    <option value="">Выберите лендинг</option>
                    {landings.map((l) => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {linkType === 'iframe' && (
              <div style={styles.hint}>
                Для iframe-ссылки будет сгенерирована встраиваемая CRM-форма.
              </div>
            )}
            <div style={styles.utmToggle}>
              <button
                type="button"
                style={styles.btnToggle}
                onClick={() => setShowUtm(!showUtm)}
              >
                {showUtm ? '▾ UTM-метки' : '▸ UTM-метки'}
              </button>
            </div>
            {showUtm && (
              <div style={styles.utmSection}>
                <div style={styles.field}>
                  <label style={styles.label}>utm_source</label>
                  <input style={styles.input} value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="google" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>utm_medium</label>
                  <input style={styles.input} value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="cpc" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>utm_campaign</label>
                  <input style={styles.input} value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="spring_sale" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>utm_content</label>
                  <input style={styles.input} value={utmContent} onChange={(e) => setUtmContent(e.target.value)} placeholder="banner_1" />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>utm_term</label>
                  <input style={styles.input} value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} placeholder="keyword" />
                </div>
              </div>
            )}
            <button type="submit" disabled={creating} style={styles.btnPrimary}>
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </form>
        </div>
      )}

      {links.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>У вас ещё нет ссылок.</p>
          <p style={styles.emptyHint}>Создайте первую партнёрскую ссылку!</p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Название</th>
                <th style={styles.th}>Тип</th>
                <th style={styles.th}>Код</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Клики</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Клиенты</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Статус</th>
                <th style={styles.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} style={styles.tr}>
                  <td style={styles.td}>{link.title}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background: LINK_TYPE_COLORS[link.link_type] + '18',
                        color: LINK_TYPE_COLORS[link.link_type],
                      }}
                    >
                      {LINK_TYPE_LABELS[link.link_type]}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <code style={styles.code}>{link.link_code}</code>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{link.clicks_count}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{link.clients_count}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span
                      style={{
                        ...styles.badge,
                        background: link.is_active ? '#e6f4ea' : '#fce8e6',
                        color: link.is_active ? '#1e8e3e' : '#d93025',
                      }}
                    >
                      {link.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        style={styles.btnSmall}
                        onClick={() => navigate(`/links/${link.id}`)}
                      >
                        Подробнее
                      </button>
                      <button
                        style={styles.btnSmallSecondary}
                        onClick={() => setQrLink(link)}
                      >
                        QR
                      </button>
                      {link.is_active && (
                        <button
                          style={styles.btnSmallDanger}
                          onClick={() => handleDelete(link.id)}
                        >
                          Деактивировать
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrLink && (
        <div style={styles.modalOverlay} onClick={() => setQrLink(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>QR-код: {qrLink.title}</h3>
              <button style={styles.modalClose} onClick={() => setQrLink(null)}>&times;</button>
            </div>
            <QRCodeBlock url={`${window.location.origin}/api/public/r/${qrLink.link_code}`} />
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 600 },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  formCard: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '24px' },
  formTitle: { marginBottom: '16px', fontSize: '18px', fontWeight: 600 },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '16px', outline: 'none' },
  hint: { marginBottom: '16px', fontSize: '14px', color: '#5f6368', fontStyle: 'italic' },
  btnPrimary: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  emptyText: { fontSize: '18px', fontWeight: 500, marginBottom: '8px' },
  emptyHint: { fontSize: '14px', color: '#5f6368' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  code: { background: '#f1f3f4', padding: '2px 8px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' },
  actions: { display: 'flex', gap: '8px' },
  btnSmall: { padding: '6px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  utmToggle: { marginBottom: '12px' },
  btnToggle: { background: 'none', border: 'none', color: '#1a73e8', fontSize: '14px', cursor: 'pointer', padding: 0, fontWeight: 500 },
  utmSection: { background: '#f8f9fa', padding: '16px', borderRadius: '6px', marginBottom: '16px' },
  btnSmallSecondary: { padding: '6px 12px', background: '#fff', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSmallDanger: { padding: '6px 12px', background: '#fff', color: '#d93025', border: '1px solid #d93025', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: { fontSize: '16px', fontWeight: 600 },
  modalClose: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 },
}
