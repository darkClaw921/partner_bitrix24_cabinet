import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLandings,
  createLanding,
  deleteLanding,
  type Landing,
  type CreateLandingData,
} from '@/api/landings'
import { useToast } from '@/hooks/useToast'

export default function LandingsPage() {
  const [landings, setLandings] = useState<Landing[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [buttonText, setButtonText] = useState('Оставить заявку')
  const [themeColor, setThemeColor] = useState('#1a73e8')

  const navigate = useNavigate()
  const { showToast } = useToast()

  const fetchLandings = async () => {
    try {
      const data = await getLandings()
      setLandings(data)
    } catch {
      setError('Не удалось загрузить лендинги')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLandings()
  }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const data: CreateLandingData = {
        title,
        description,
        header_text: headerText,
        button_text: buttonText,
        theme_color: themeColor,
      }
      const landing = await createLanding(data)
      showToast('Лендинг создан', 'success')
      setShowForm(false)
      setTitle('')
      setDescription('')
      setHeaderText('')
      setButtonText('Оставить заявку')
      setThemeColor('#1a73e8')
      navigate(`/landings/${landing.id}/edit`)
    } catch {
      setError('Не удалось создать лендинг')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Деактивировать лендинг?')) return
    try {
      await deleteLanding(id)
      showToast('Лендинг деактивирован', 'success')
      await fetchLandings()
    } catch {
      setError('Не удалось деактивировать лендинг')
    }
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Лендинги</h1>
        <button style={styles.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Создать лендинг'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Новый лендинг</h3>
          <form onSubmit={handleCreate}>
            <div style={styles.field}>
              <label style={styles.label}>Заголовок</label>
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Название лендинга"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Текст шапки</label>
              <input
                style={styles.input}
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                required
                placeholder="Заголовок на странице"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Описание</label>
              <textarea
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' as const }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Описание лендинга"
              />
            </div>
            <div style={styles.row}>
              <div style={{ ...styles.field, flex: 1 }}>
                <label style={styles.label}>Текст кнопки</label>
                <input
                  style={styles.input}
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                />
              </div>
              <div style={{ ...styles.field, width: '120px' }}>
                <label style={styles.label}>Цвет темы</label>
                <div style={styles.colorWrap}>
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    style={styles.colorInput}
                  />
                  <span style={styles.colorLabel}>{themeColor}</span>
                </div>
              </div>
            </div>
            <button type="submit" disabled={creating} style={styles.btnPrimary}>
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </form>
        </div>
      )}

      {landings.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>У вас ещё нет лендингов.</p>
          <p style={styles.emptyHint}>Создайте свой первый лендинг!</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {landings.map((landing) => (
            <div key={landing.id} style={styles.card}>
              <div style={styles.cardImage}>
                {landing.images.length > 0 ? (
                  <img
                    src={landing.images[0].url}
                    alt={landing.title}
                    style={styles.cardImg}
                  />
                ) : (
                  <div style={styles.cardPlaceholder}>Нет изображений</div>
                )}
              </div>
              <div style={styles.cardBody}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{landing.title}</h3>
                  <div
                    style={{
                      ...styles.colorDot,
                      background: landing.theme_color,
                    }}
                    title={landing.theme_color}
                  />
                </div>
                <div style={styles.cardMeta}>
                  <span style={styles.cardMetaItem}>
                    {landing.images.length} изобр.
                  </span>
                  <span
                    style={{
                      ...styles.badge,
                      background: landing.is_active ? '#e6f4ea' : '#fce8e6',
                      color: landing.is_active ? '#1e8e3e' : '#d93025',
                    }}
                  >
                    {landing.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
                <div style={styles.cardActions}>
                  <button
                    style={styles.btnSmall}
                    onClick={() => navigate(`/landings/${landing.id}/edit`)}
                  >
                    Редактировать
                  </button>
                  {landing.is_active && (
                    <button
                      style={styles.btnSmallDanger}
                      onClick={() => handleDelete(landing.id)}
                    >
                      Деактивировать
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '16px', outline: 'none', fontFamily: 'inherit' },
  row: { display: 'flex', gap: '16px', marginBottom: '16px' },
  colorWrap: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', border: '1px solid #dadce0', borderRadius: '6px' },
  colorInput: { width: '32px', height: '32px', border: 'none', padding: 0, cursor: 'pointer', background: 'none' },
  colorLabel: { fontSize: '13px', fontFamily: 'monospace', color: '#5f6368' },
  btnPrimary: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  emptyText: { fontSize: '18px', fontWeight: 500, marginBottom: '8px' },
  emptyHint: { fontSize: '14px', color: '#5f6368' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  card: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden' },
  cardImage: { height: '180px', background: '#f1f3f4', overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardPlaceholder: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', fontSize: '14px' },
  cardBody: { padding: '16px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  cardTitle: { fontSize: '16px', fontWeight: 600 },
  colorDot: { width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  cardMetaItem: { fontSize: '13px', color: '#5f6368' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 500 },
  cardActions: { display: 'flex', gap: '8px' },
  btnSmall: { padding: '6px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSmallDanger: { padding: '6px 12px', background: '#fff', color: '#d93025', border: '1px solid #d93025', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
}
