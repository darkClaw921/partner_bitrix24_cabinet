import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getLanding,
  updateLanding,
  uploadImage,
  deleteImage,
  type Landing,
  type UpdateLandingData,
} from '@/api/landings'
import { getLinks, type Link } from '@/api/links'
import { useToast } from '@/hooks/useToast'

export default function LandingEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const [landing, setLanding] = useState<Landing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [links, setLinks] = useState<Link[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [themeColor, setThemeColor] = useState('#1a73e8')

  const landingId = Number(id)

  const fetchLanding = async () => {
    try {
      const data = await getLanding(landingId)
      setLanding(data)
      setTitle(data.title)
      setDescription(data.description)
      setHeaderText(data.header_text)
      setButtonText(data.button_text)
      setThemeColor(data.theme_color)
    } catch {
      setError('Не удалось загрузить лендинг')
    } finally {
      setLoading(false)
    }
  }

  const fetchLinks = async () => {
    try {
      const data = await getLinks()
      setLinks(data.filter((l) => l.link_type === 'landing' && l.landing_id === landingId))
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetchLanding()
    fetchLinks()
  }, [landingId])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const data: UpdateLandingData = {
        title,
        description,
        header_text: headerText,
        button_text: buttonText,
        theme_color: themeColor,
      }
      const updated = await updateLanding(landingId, data)
      setLanding(updated)
      showToast('Лендинг сохранён', 'success')
      setSuccess('Сохранено')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadImage(landingId, files[i])
      }
      await fetchLanding()
    } catch {
      setError('Не удалось загрузить изображение')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Удалить изображение?')) return
    try {
      await deleteImage(landingId, imageId)
      await fetchLanding()
    } catch {
      setError('Не удалось удалить изображение')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleUpload(e.dataTransfer.files)
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  if (!landing) {
    return <div style={styles.page}><div style={styles.error}>Лендинг не найден</div></div>
  }

  const previewLink = links.length > 0 ? links[0] : null

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumbs}>
        <span style={styles.breadcrumbLink} onClick={() => navigate('/landings')}>
          Лендинги
        </span>
        <span style={styles.breadcrumbSep}>/</span>
        <span>{landing.title}</span>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbActive}>Редактирование</span>
      </div>

      <div style={styles.headerRow}>
        <h1 style={styles.title}>Редактирование лендинга</h1>
        {previewLink && (
          <a
            href={`/api/public/landing/${previewLink.link_code}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.btnOutline}
          >
            Предпросмотр
          </a>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.sections}>
        {/* Settings Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Настройки</h2>
          <form onSubmit={handleSave}>
            <div style={styles.field}>
              <label style={styles.label}>Заголовок</label>
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Текст шапки</label>
              <input
                style={styles.input}
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Описание</label>
              <textarea
                style={{ ...styles.input, minHeight: '100px', resize: 'vertical' as const }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
              <div style={{ ...styles.field, width: '140px' }}>
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
            <button type="submit" disabled={saving} style={styles.btnPrimary}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </div>

        {/* Images Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Изображения</h2>

          <div
            style={styles.dropZone}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <p style={styles.dropText}>Загрузка...</p>
            ) : (
              <>
                <p style={styles.dropText}>Перетащите изображения сюда</p>
                <p style={styles.dropHint}>или нажмите для выбора файлов</p>
                <p style={styles.dropHint}>JPEG, PNG, WebP, GIF (макс. 5MB)</p>
              </>
            )}
          </div>

          {landing.images.length === 0 ? (
            <p style={styles.noImages}>Нет загруженных изображений</p>
          ) : (
            <div style={styles.imageGrid}>
              {landing.images.map((image) => (
                <div key={image.id} style={styles.imageCard}>
                  <img src={image.url} alt="" style={styles.imagePreview} />
                  <button
                    style={styles.imageDeleteBtn}
                    onClick={() => handleDeleteImage(image.id)}
                    title="Удалить"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button style={styles.btnBack} onClick={() => navigate('/landings')}>
        &larr; Назад к списку
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '900px', margin: '0 auto' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  success: { background: '#e6f4ea', color: '#1e8e3e', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  breadcrumbs: { fontSize: '14px', color: '#5f6368', marginBottom: '16px' },
  breadcrumbLink: { color: '#1a73e8', cursor: 'pointer' },
  breadcrumbSep: { margin: '0 8px' },
  breadcrumbActive: { color: '#202124' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 600 },
  btnOutline: { padding: '8px 16px', border: '1px solid #1a73e8', color: '#1a73e8', borderRadius: '6px', fontSize: '14px', textDecoration: 'none', fontWeight: 500 },
  sections: { display: 'flex', flexDirection: 'column', gap: '24px' },
  section: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '16px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '16px', outline: 'none', fontFamily: 'inherit' },
  row: { display: 'flex', gap: '16px' },
  colorWrap: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', border: '1px solid #dadce0', borderRadius: '6px' },
  colorInput: { width: '32px', height: '32px', border: 'none', padding: 0, cursor: 'pointer', background: 'none' },
  colorLabel: { fontSize: '13px', fontFamily: 'monospace', color: '#5f6368' },
  btnPrimary: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  dropZone: { border: '2px dashed #dadce0', borderRadius: '8px', padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', transition: 'border-color 0.2s' },
  dropText: { fontSize: '15px', fontWeight: 500, color: '#5f6368', marginBottom: '4px' },
  dropHint: { fontSize: '13px', color: '#9aa0a6' },
  noImages: { textAlign: 'center', color: '#9aa0a6', fontSize: '14px', padding: '16px 0' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' },
  imageCard: { position: 'relative', borderRadius: '6px', overflow: 'hidden', background: '#f1f3f4', aspectRatio: '1' },
  imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
  imageDeleteBtn: { position: 'absolute', top: '4px', right: '4px', width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  btnBack: { marginTop: '24px', padding: '8px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', color: '#5f6368', cursor: 'pointer' },
}
