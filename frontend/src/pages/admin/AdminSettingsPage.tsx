import { useState, useEffect } from 'react'
import { getSettings, updateTrackingSettings, updateSyncSettings, triggerSync } from '@/api/systemSettings'
import { useToast } from '@/hooks/useToast'

export default function AdminSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [trackingForm, setTrackingForm] = useState({
    lead_field: '',
    deal_field: '',
    value_template: 'C_{id}',
    field_type: 'crm_entity',
  })

  const [syncForm, setSyncForm] = useState({
    enabled: false,
    interval_minutes: 60,
  })

  const [lastRun, setLastRun] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getSettings()
        setTrackingForm({
          lead_field: s.partner_tracking_lead_field || '',
          deal_field: s.partner_tracking_deal_field || '',
          value_template: s.partner_tracking_value_template || 'C_{id}',
          field_type: s.partner_tracking_field_type || 'crm_entity',
        })
        setSyncForm({
          enabled: s.b24_sync_enabled === 'true',
          interval_minutes: parseInt(s.b24_sync_interval_minutes) || 60,
        })
        setLastRun(s.b24_sync_last_run || null)
      } catch {
        showToast('Не удалось загрузить настройки', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveTracking = async () => {
    setSaving(true)
    try {
      await updateTrackingSettings(trackingForm)
      showToast('Настройки отслеживания сохранены', 'success')
    } catch {
      showToast('Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveSync = async () => {
    setSaving(true)
    try {
      await updateSyncSettings(syncForm)
      showToast('Настройки синхронизации сохранены', 'success')
    } catch {
      showToast('Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync()
      showToast('Синхронизация запущена', 'success')
    } catch {
      showToast('Ошибка запуска синхронизации', 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div style={styles.loader}>Загрузка...</div>

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Настройки</h1>

      {/* Tracking field config */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Отслеживание партнёров в Bitrix24</h2>
        <p style={styles.cardDesc}>Укажите пользовательские поля (UF_CRM_...) в лидах и сделках, которые содержат привязку к партнёру.</p>

        <div style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Поле в лидах</label>
            <input style={styles.input} type="text" value={trackingForm.lead_field}
              onChange={e => setTrackingForm({ ...trackingForm, lead_field: e.target.value })}
              placeholder="UF_CRM_1234567890" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Поле в сделках</label>
            <input style={styles.input} type="text" value={trackingForm.deal_field}
              onChange={e => setTrackingForm({ ...trackingForm, deal_field: e.target.value })}
              placeholder="UF_CRM_9876543210" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Шаблон значения</label>
            <input style={styles.input} type="text" value={trackingForm.value_template}
              onChange={e => setTrackingForm({ ...trackingForm, value_template: e.target.value })}
              placeholder="C_{id}" />
            <span style={styles.hint}>Доступные переменные: {'{id}'} (B24 entity ID), {'{partner_id}'} (ID партнёра)</span>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Тип поля</label>
            <select style={styles.select} value={trackingForm.field_type}
              onChange={e => setTrackingForm({ ...trackingForm, field_type: e.target.value })}>
              <option value="crm_entity">Привязка к CRM (C_123, CO_456)</option>
              <option value="string">Строка</option>
              <option value="number">Число</option>
            </select>
          </div>
        </div>

        <button style={styles.btnSave} onClick={saveTracking} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {/* Sync config */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Синхронизация сделок из Bitrix24</h2>
        <p style={styles.cardDesc}>Автоматический импорт сделок партнёров из Bitrix24 в партнёрский кабинет.</p>

        <div style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.toggleLabel}>
              <input type="checkbox" checked={syncForm.enabled}
                onChange={e => setSyncForm({ ...syncForm, enabled: e.target.checked })} />
              <span style={{ marginLeft: '8px' }}>Автоматическая синхронизация {syncForm.enabled ? 'включена' : 'выключена'}</span>
            </label>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Интервал (минут)</label>
            <input style={styles.input} type="number" min={5} max={1440} value={syncForm.interval_minutes}
              onChange={e => setSyncForm({ ...syncForm, interval_minutes: parseInt(e.target.value) || 60 })} />
          </div>
        </div>

        {lastRun && (
          <div style={styles.lastRun}>Последняя синхронизация: {new Date(lastRun).toLocaleString('ru-RU')}</div>
        )}

        <div style={styles.btnRow}>
          <button style={styles.btnSave} onClick={saveSync} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button style={styles.btnSync} onClick={handleSync} disabled={syncing}>
            {syncing ? 'Запуск...' : 'Синхронизировать сейчас'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '800px', margin: '0 auto' },
  pageTitle: { fontSize: '24px', fontWeight: 600, marginBottom: '24px' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  card: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', padding: '24px', marginBottom: '24px' },
  cardTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '8px', margin: 0 },
  cardDesc: { fontSize: '14px', color: '#5f6368', marginBottom: '20px', marginTop: '8px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  input: { padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const },
  select: { padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' as const },
  hint: { fontSize: '12px', color: '#80868b' },
  toggleLabel: { display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', fontWeight: 500, color: '#202124' },
  lastRun: { fontSize: '13px', color: '#5f6368', marginBottom: '16px' },
  btnRow: { display: 'flex', gap: '12px' },
  btnSave: { padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  btnSync: { padding: '10px 24px', background: '#fff', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
}
