import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import {
  getBitrixSettings,
  updateBitrixSettings,
  getBitrixFunnels,
  getBitrixStages,
  getBitrixLeadStatuses,
  type BitrixSettings,
  type Funnel,
  type Stage,
  type LeadStatus,
} from '@/api/bitrix'

export default function BitrixSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BitrixSettings | null>(null)

  // Settings form
  const [entityType, setEntityType] = useState('lead')
  const [dealCategoryId, setDealCategoryId] = useState(0)
  const [dealStageId, setDealStageId] = useState('')
  const [leadStatusId, setLeadStatusId] = useState('')

  // Bitrix24 data
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([])

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getBitrixSettings()
      setSettings(data)
      if (data.configured) {
        setEntityType(data.entity_type || 'lead')
        setDealCategoryId(data.deal_category_id ?? 0)
        setDealStageId(data.deal_stage_id || '')
        setLeadStatusId(data.lead_status_id || '')
      }
    } catch {
      // Error handled by axios interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Load funnels/stages/statuses when configured
  useEffect(() => {
    if (!settings?.configured) return

    if (entityType === 'deal') {
      getBitrixFunnels().then(setFunnels).catch(() => {})
      getBitrixStages(dealCategoryId).then(setStages).catch(() => {})
    } else {
      getBitrixLeadStatuses().then(setLeadStatuses).catch(() => {})
    }
  }, [settings?.configured, entityType, dealCategoryId])

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      await updateBitrixSettings({
        entity_type: entityType,
        deal_category_id: entityType === 'deal' ? dealCategoryId : undefined,
        deal_stage_id: entityType === 'deal' ? dealStageId : undefined,
        lead_status_id: entityType === 'lead' ? leadStatusId : undefined,
      })
      showToast('Настройки сохранены', 'success')
    } catch {
      // Error handled by axios interceptor
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={styles.container}><p>Загрузка...</p></div>
  }

  if (!settings?.configured) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Настройки Bitrix24</h2>
          <p style={styles.description}>
            Интеграция с Bitrix24 настраивается автоматически. Если вы видите это сообщение, обратитесь к администратору.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Настройки Bitrix24</h2>

        <div style={styles.infoBlock}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>API Token:</span>
            <code style={styles.code}>{settings.api_token}</code>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Webhook URL:</span>
            <code style={styles.code}>{`${window.location.origin}/api/public/webhook/b24`}</code>
            <button
              style={styles.copyBtn}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/public/webhook/b24`)
                showToast('URL скопирован', 'success')
              }}
              title="Копировать"
            >
              Копировать
            </button>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.formGroup}>
          <label style={styles.label}>Тип сущности</label>
          <select
            style={styles.select}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="lead">Лид</option>
            <option value="deal">Сделка</option>
          </select>
        </div>

        {entityType === 'deal' && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Воронка</label>
              <select
                style={styles.select}
                value={dealCategoryId}
                onChange={(e) => setDealCategoryId(Number(e.target.value))}
              >
                {funnels.length === 0 && <option value={0}>Загрузка...</option>}
                {funnels.map((f) => (
                  <option key={f.ID} value={f.ID}>{f.TITLE}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Начальный этап</label>
              <select
                style={styles.select}
                value={dealStageId}
                onChange={(e) => setDealStageId(e.target.value)}
              >
                <option value="">По умолчанию</option>
                {stages.map((s) => (
                  <option key={s.STATUS_ID} value={s.STATUS_ID}>{s.NAME}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {entityType === 'lead' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Начальный статус лида</label>
            <select
              style={styles.select}
              value={leadStatusId}
              onChange={(e) => setLeadStatusId(e.target.value)}
            >
              <option value="">По умолчанию (NEW)</option>
              {leadStatuses.map((s) => (
                <option key={s.STATUS_ID} value={s.STATUS_ID}>{s.NAME}</option>
              ))}
            </select>
          </div>
        )}

        <button
          style={styles.primaryBtn}
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 700, margin: '0 auto' },
  card: { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#202124', margin: '0 0 12px' },
  description: { fontSize: 14, color: '#5f6368', lineHeight: 1.6, marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#5f6368', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  select: { width: '100%', padding: '10px 14px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' as const },
  primaryBtn: { padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  infoBlock: { background: '#f8f9fa', borderRadius: 8, padding: 16, marginBottom: 16 },
  infoRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const },
  infoLabel: { fontSize: 13, fontWeight: 600, color: '#5f6368', minWidth: 100 },
  code: { background: '#e8eaed', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' as const },
  copyBtn: { padding: '3px 10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' },
  divider: { height: 1, background: '#e8eaed', margin: '20px 0' },
}
