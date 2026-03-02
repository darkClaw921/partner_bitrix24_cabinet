import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { changePassword } from '@/api/auth'

export default function ProfilePage() {
  const { partner } = useAuth()
  const { showToast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    try {
      setSaving(true)
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      showToast('Пароль успешно изменён', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(detail || 'Ошибка при смене пароля')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Profile info card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Профиль</h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{partner?.email}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Имя</span>
            <span style={styles.infoValue}>{partner?.name}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Компания</span>
            <span style={styles.infoValue}>{partner?.company || '—'}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Партнёрский код</span>
            <span style={styles.code}>{partner?.partner_code}</span>
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div style={{ ...styles.card, marginTop: 20 }}>
        <h2 style={styles.cardTitle}>Изменить пароль</h2>
        <form onSubmit={handleChangePassword}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Текущий пароль</label>
            <div style={styles.passwordWrap}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={styles.input}
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={styles.toggleBtn}>
                {showCurrent ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Новый пароль</label>
            <div style={styles.passwordWrap}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={styles.input}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} style={styles.toggleBtn}>
                {showNew ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Подтверждение пароля</label>
            <div style={styles.passwordWrap}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={styles.toggleBtn}>
                {showConfirm ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={saving} style={styles.primaryBtn}>
            {saving ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 700, margin: '0 auto' },
  card: { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#202124', margin: '0 0 20px' },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 14 },
  infoItem: { display: 'flex', alignItems: 'center', gap: 12 },
  infoLabel: { fontSize: 13, fontWeight: 600, color: '#5f6368', minWidth: 140, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  infoValue: { fontSize: 15, color: '#202124' },
  code: { background: '#e8eaed', padding: '3px 8px', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#5f6368', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  passwordWrap: { display: 'flex', gap: 8 },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  toggleBtn: { padding: '10px 14px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const, color: '#5f6368' },
  primaryBtn: { padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  error: { background: '#fce8e6', color: '#c5221f', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 },
}
