import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getAdminPartnerDetail,
  updateClientPayment,
  bulkUpdateClientPayment,
  updatePartnerRewardPercentage,
  getGlobalRewardPercentage,
  type AdminPartnerDetail,
  type AdminPartnerClient,
} from '@/api/admin'
import StatsCard from '@/components/StatsCard'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' \u20BD'
}

type ColumnKey = 'name' | 'email' | 'phone' | 'company' | 'source' | 'deal_amount' | 'partner_reward' | 'is_paid' | 'created_at'

interface ColumnDef {
  key: ColumnKey
  label: string
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Имя', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'phone', label: 'Телефон', defaultVisible: true },
  { key: 'company', label: 'Компания', defaultVisible: false },
  { key: 'source', label: 'Источник', defaultVisible: false },
  { key: 'deal_amount', label: 'Сумма сделки', defaultVisible: true },
  { key: 'partner_reward', label: 'Вознаграждение', defaultVisible: true },
  { key: 'is_paid', label: 'Статус оплаты', defaultVisible: true },
  { key: 'created_at', label: 'Дата', defaultVisible: true },
]

export default function AdminPartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<AdminPartnerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingClient, setEditingClient] = useState<AdminPartnerClient | null>(null)
  const [modalData, setModalData] = useState({ deal_amount: '', partner_reward: '', is_paid: false, payment_comment: '' })
  const [saving, setSaving] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkData, setBulkData] = useState({ deal_amount: '', partner_reward: '', is_paid: false, payment_comment: '', apply_deal_amount: false, apply_partner_reward: false, apply_is_paid: false, apply_payment_comment: false })

  // Reward percentage
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [rewardUseGlobal, setRewardUseGlobal] = useState(true)
  const [rewardPctInput, setRewardPctInput] = useState('')
  const [globalPct, setGlobalPct] = useState<number>(10)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  })
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false)

  const loadPartner = () => {
    if (!id) return
    getAdminPartnerDetail(Number(id))
      .then(setPartner)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPartner()
    getGlobalRewardPercentage()
      .then((r) => setGlobalPct(r.default_reward_percentage))
      .catch(() => {})
  }, [id])

  // Single edit
  const openModal = (client: AdminPartnerClient) => {
    setEditingClient(client)
    setModalData({
      deal_amount: client.deal_amount != null ? String(client.deal_amount) : '',
      partner_reward: client.partner_reward != null ? String(client.partner_reward) : '',
      is_paid: client.is_paid ?? false,
      payment_comment: client.payment_comment ?? '',
    })
  }

  const closeModal = () => setEditingClient(null)

  const savePayment = async () => {
    if (!editingClient) return
    setSaving(true)
    try {
      await updateClientPayment(editingClient.id, {
        deal_amount: modalData.deal_amount ? Number(modalData.deal_amount) : null,
        partner_reward: modalData.partner_reward ? Number(modalData.partner_reward) : null,
        is_paid: modalData.is_paid,
        payment_comment: modalData.payment_comment || null,
      })
      closeModal()
      loadPartner()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  // Reward percentage
  const openRewardModal = () => {
    if (!partner) return
    const useGlobal = partner.reward_percentage == null
    setRewardUseGlobal(useGlobal)
    setRewardPctInput(useGlobal ? String(globalPct) : String(partner.reward_percentage))
    setRewardModalOpen(true)
  }

  const saveRewardPercentage = async () => {
    if (!partner) return
    setSaving(true)
    try {
      const pct = rewardUseGlobal ? null : parseFloat(rewardPctInput)
      if (!rewardUseGlobal && (isNaN(pct!) || pct! < 0 || pct! > 100)) return
      await updatePartnerRewardPercentage(partner.id, pct)
      setRewardModalOpen(false)
      loadPartner()
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  // Bulk edit
  const openBulkModal = () => {
    setBulkData({ deal_amount: '', partner_reward: '', is_paid: false, payment_comment: '', apply_deal_amount: false, apply_partner_reward: false, apply_is_paid: false, apply_payment_comment: false })
    setBulkModalOpen(true)
  }

  const bulkSetPaidStatus = async (isPaid: boolean) => {
    if (selectedIds.size === 0) return
    setSaving(true)
    try {
      await bulkUpdateClientPayment({ client_ids: Array.from(selectedIds), is_paid: isPaid })
      setSelectedIds(new Set())
      loadPartner()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const saveBulkPayment = async () => {
    if (selectedIds.size === 0) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { client_ids: Array.from(selectedIds) }
      if (bulkData.apply_deal_amount) payload.deal_amount = bulkData.deal_amount ? Number(bulkData.deal_amount) : null
      if (bulkData.apply_partner_reward) payload.partner_reward = bulkData.partner_reward ? Number(bulkData.partner_reward) : null
      if (bulkData.apply_is_paid) payload.is_paid = bulkData.is_paid
      if (bulkData.apply_payment_comment) payload.payment_comment = bulkData.payment_comment || null
      await bulkUpdateClientPayment(payload as any)
      setBulkModalOpen(false)
      setSelectedIds(new Set())
      loadPartner()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  // Selection handlers
  const toggleSelect = (clientId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!partner) return
    if (selectedIds.size === partner.clients.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(partner.clients.map(c => c.id)))
    }
  }

  // Column toggle
  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeColumns = useMemo(() => ALL_COLUMNS.filter(c => visibleColumns.has(c.key)), [visibleColumns])

  const renderCell = (client: AdminPartnerClient, key: ColumnKey) => {
    switch (key) {
      case 'name': return client.name
      case 'email': return client.email || '—'
      case 'phone': return client.phone || '—'
      case 'company': return client.company || '—'
      case 'source': return client.source
      case 'deal_amount': return formatCurrency(client.deal_amount)
      case 'partner_reward': return formatCurrency(client.partner_reward)
      case 'is_paid':
        return (
          <span style={{
            ...styles.badge,
            background: client.is_paid ? '#e6f4ea' : '#fce8e6',
            color: client.is_paid ? '#137333' : '#d93025',
          }}>
            {client.is_paid ? 'Оплачено' : 'Не оплачено'}
          </span>
        )
      case 'created_at':
        return client.created_at ? new Date(client.created_at).toLocaleDateString('ru-RU') : '—'
      default: return '—'
    }
  }

  if (loading) return <div>Загрузка...</div>
  if (!partner) return <div>Партнёр не найден</div>

  const totalDealAmount = partner.clients.reduce((s, c) => s + (c.deal_amount || 0), 0)
  const totalReward = partner.clients.reduce((s, c) => s + (c.partner_reward || 0), 0)
  const paidAmount = partner.clients.filter(c => c.is_paid).reduce((s, c) => s + (c.partner_reward || 0), 0)
  const unpaidAmount = partner.clients.filter(c => !c.is_paid).reduce((s, c) => s + (c.partner_reward || 0), 0)
  const allSelected = partner.clients.length > 0 && selectedIds.size === partner.clients.length
  // Column count: checkbox + active columns + action
  const totalColSpan = activeColumns.length + 2

  return (
    <div>
      <Link to="/admin/partners" style={styles.backLink}>&larr; Назад к списку</Link>

      <div style={styles.header}>
        <h2 style={styles.name}>{partner.name}</h2>
        <span style={{
          ...styles.badge,
          background: partner.is_active ? '#e6f4ea' : '#fce8e6',
          color: partner.is_active ? '#137333' : '#d93025',
        }}>
          {partner.is_active ? 'Активен' : 'Неактивен'}
        </span>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Email</span>
          <span style={styles.infoValue}>{partner.email}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Компания</span>
          <span style={styles.infoValue}>{partner.company || '—'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Код партнёра</span>
          <span style={{ ...styles.infoValue, fontFamily: 'monospace' }}>{partner.partner_code}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Workflow ID</span>
          <span style={styles.infoValue}>{partner.workflow_id || '—'}</span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>% Вознаграждения</span>
          <span style={styles.infoValue}>
            {partner.reward_percentage != null
              ? `${partner.reward_percentage}% (индивид.)`
              : `${partner.effective_reward_percentage}% (глобальный)`}
            <button style={styles.inlineEditBtn} onClick={openRewardModal}>Изменить</button>
          </span>
        </div>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>Регистрация</span>
          <span style={styles.infoValue}>{new Date(partner.created_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatsCard title="Ссылки" value={partner.links_count} color="#1a73e8" />
        <StatsCard title="Клики" value={partner.clicks_count} color="#34a853" />
        <StatsCard title="Клиенты" value={partner.clients_count} color="#ea4335" />
        <StatsCard title="Лендинги" value={partner.landings_count} color="#9334e6" />
      </div>

      <div style={styles.statsGrid}>
        <StatsCard title="Сумма сделок" value={formatCurrency(totalDealAmount)} color="#1a73e8" />
        <StatsCard title="Вознаграждение" value={formatCurrency(totalReward)} color="#fbbc04" />
        <StatsCard title="Выплачено" value={formatCurrency(paidAmount)} color="#34a853" />
        <StatsCard title="К выплате" value={formatCurrency(unpaidAmount)} color="#ea4335" />
      </div>

      {partner.links.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Ссылки</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Название</th>
                  <th style={styles.th}>Тип</th>
                  <th style={styles.th}>Код</th>
                  <th style={styles.th}>URL</th>
                  <th style={styles.th}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {partner.links.map((link) => (
                  <tr key={link.id}>
                    <td style={styles.td}>{link.title}</td>
                    <td style={styles.td}>{link.link_type}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '13px' }}>{link.link_code}</td>
                    <td style={{ ...styles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.target_url}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: link.is_active ? '#e6f4ea' : '#fce8e6',
                        color: link.is_active ? '#137333' : '#d93025',
                      }}>
                        {link.is_active ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Клиенты / Сделки</h3>
          <div style={styles.sectionActions}>
            {selectedIds.size > 0 && (
              <>
                <button style={styles.paidBtn} onClick={() => bulkSetPaidStatus(true)} disabled={saving}>
                  Оплачено ({selectedIds.size})
                </button>
                <button style={styles.unpaidBtn} onClick={() => bulkSetPaidStatus(false)} disabled={saving}>
                  Не оплачено ({selectedIds.size})
                </button>
                <button style={styles.bulkBtn} onClick={openBulkModal}>
                  Редактировать ({selectedIds.size})
                </button>
              </>
            )}
            <div style={styles.columnsDropdownWrapper}>
              <button
                style={styles.columnsBtn}
                onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
              >
                Столбцы ▾
              </button>
              {columnsDropdownOpen && (
                <>
                  <div style={styles.dropdownBackdrop} onClick={() => setColumnsDropdownOpen(false)} />
                  <div style={styles.columnsDropdown}>
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} style={styles.dropdownItem}>
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                        />
                        <span style={{ marginLeft: '8px' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '36px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  style={styles.checkbox}
                />
              </th>
              {activeColumns.map(col => (
                <th key={col.key} style={styles.th}>{col.label}</th>
              ))}
              <th style={{ ...styles.th, width: '80px' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {partner.clients.map((c) => (
              <tr
                key={c.id}
                style={selectedIds.has(c.id) ? styles.selectedRow : undefined}
              >
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    style={styles.checkbox}
                  />
                </td>
                {activeColumns.map(col => (
                  <td key={col.key} style={styles.td}>{renderCell(c, col.key)}</td>
                ))}
                <td style={styles.td}>
                  <button style={styles.editBtn} onClick={() => openModal(c)}>Изменить</button>
                </td>
              </tr>
            ))}
            {partner.clients.length === 0 && (
              <tr>
                <td colSpan={totalColSpan} style={{ ...styles.td, textAlign: 'center', color: '#5f6368' }}>
                  Нет клиентов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Single edit modal */}
      {editingClient && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Редактирование оплаты — {editingClient.name}</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Сумма сделки</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={modalData.deal_amount}
                onChange={(e) => setModalData({ ...modalData, deal_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Вознаграждение партнёру</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={modalData.partner_reward}
                onChange={(e) => setModalData({ ...modalData, partner_reward: e.target.value })}
                placeholder="0.00"
              />
              {modalData.deal_amount && !modalData.partner_reward && partner && (
                <div style={styles.autoCalcHint}>
                  Авто-расчёт: {(Number(modalData.deal_amount) * partner.effective_reward_percentage / 100).toFixed(2)} ₽ ({partner.effective_reward_percentage}%)
                </div>
              )}
            </div>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={modalData.is_paid}
                  onChange={(e) => setModalData({ ...modalData, is_paid: e.target.checked })}
                />
                <span style={{ marginLeft: '8px' }}>Оплачено</span>
              </label>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Комментарий</label>
              <textarea
                style={styles.textarea}
                value={modalData.payment_comment}
                onChange={(e) => setModalData({ ...modalData, payment_comment: e.target.value })}
                placeholder="Комментарий к оплате..."
                rows={3}
              />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={closeModal}>Отмена</button>
              <button style={styles.saveBtn} onClick={savePayment} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit modal */}
      {bulkModalOpen && (
        <div style={styles.overlay} onClick={() => setBulkModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Массовое редактирование ({selectedIds.size} сделок)</h3>
            <p style={{ fontSize: '13px', color: '#5f6368', margin: '0 0 16px' }}>
              Отметьте поля, которые хотите изменить для всех выбранных сделок.
            </p>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={bulkData.apply_deal_amount}
                  onChange={(e) => setBulkData({ ...bulkData, apply_deal_amount: e.target.checked })}
                />
                <span style={{ marginLeft: '8px', fontWeight: 500 }}>Сумма сделки</span>
              </label>
              {bulkData.apply_deal_amount && (
                <input
                  type="number"
                  step="0.01"
                  style={{ ...styles.input, marginTop: '6px' }}
                  value={bulkData.deal_amount}
                  onChange={(e) => setBulkData({ ...bulkData, deal_amount: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={bulkData.apply_partner_reward}
                  onChange={(e) => setBulkData({ ...bulkData, apply_partner_reward: e.target.checked })}
                />
                <span style={{ marginLeft: '8px', fontWeight: 500 }}>Вознаграждение партнёру</span>
              </label>
              {bulkData.apply_partner_reward && (
                <input
                  type="number"
                  step="0.01"
                  style={{ ...styles.input, marginTop: '6px' }}
                  value={bulkData.partner_reward}
                  onChange={(e) => setBulkData({ ...bulkData, partner_reward: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={bulkData.apply_is_paid}
                  onChange={(e) => setBulkData({ ...bulkData, apply_is_paid: e.target.checked })}
                />
                <span style={{ marginLeft: '8px', fontWeight: 500 }}>Статус оплаты</span>
              </label>
              {bulkData.apply_is_paid && (
                <label style={{ ...styles.checkboxLabel, marginTop: '6px', marginLeft: '24px' }}>
                  <input
                    type="checkbox"
                    checked={bulkData.is_paid}
                    onChange={(e) => setBulkData({ ...bulkData, is_paid: e.target.checked })}
                  />
                  <span style={{ marginLeft: '8px' }}>Оплачено</span>
                </label>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={bulkData.apply_payment_comment}
                  onChange={(e) => setBulkData({ ...bulkData, apply_payment_comment: e.target.checked })}
                />
                <span style={{ marginLeft: '8px', fontWeight: 500 }}>Комментарий</span>
              </label>
              {bulkData.apply_payment_comment && (
                <textarea
                  style={{ ...styles.textarea, marginTop: '6px' }}
                  value={bulkData.payment_comment}
                  onChange={(e) => setBulkData({ ...bulkData, payment_comment: e.target.value })}
                  placeholder="Комментарий к оплате..."
                  rows={3}
                />
              )}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setBulkModalOpen(false)}>Отмена</button>
              <button
                style={styles.saveBtn}
                onClick={saveBulkPayment}
                disabled={saving || !(bulkData.apply_deal_amount || bulkData.apply_partner_reward || bulkData.apply_is_paid || bulkData.apply_payment_comment)}
              >
                {saving ? 'Сохранение...' : 'Применить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward percentage modal */}
      {rewardModalOpen && (
        <div style={styles.overlay} onClick={() => setRewardModalOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Процент вознаграждения — {partner.name}</h3>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rewardUseGlobal}
                  onChange={(e) => setRewardUseGlobal(e.target.checked)}
                />
                <span style={{ marginLeft: '8px' }}>Использовать глобальное значение ({globalPct}%)</span>
              </label>
            </div>
            {!rewardUseGlobal && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Индивидуальный % вознаграждения</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  style={styles.input}
                  value={rewardPctInput}
                  onChange={(e) => setRewardPctInput(e.target.value)}
                  placeholder="10.0"
                  autoFocus
                />
              </div>
            )}
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setRewardModalOpen(false)}>Отмена</button>
              <button style={styles.saveBtn} onClick={saveRewardPercentage} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backLink: {
    color: '#1a73e8',
    textDecoration: 'none',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  name: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#202124',
    margin: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  infoGrid: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    marginBottom: '24px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '20px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#5f6368',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '15px',
    color: '#202124',
  },
  statsGrid: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  section: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '24px',
    marginBottom: '24px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#202124',
    margin: 0,
  },
  sectionActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e8eaed',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '8px 10px',
    fontSize: '13px',
    color: '#202124',
    borderBottom: '1px solid #e8eaed',
  },
  selectedRow: {
    background: '#e8f0fe',
  },
  checkbox: {
    cursor: 'pointer',
    width: '16px',
    height: '16px',
  },
  editBtn: {
    padding: '3px 10px',
    fontSize: '12px',
    color: '#1a73e8',
    background: '#e8f0fe',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  bulkBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    color: '#fff',
    background: '#1a73e8',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  paidBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    color: '#137333',
    background: '#e6f4ea',
    border: '1px solid #ceead6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  unpaidBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    color: '#d93025',
    background: '#fce8e6',
    border: '1px solid #f5c6c2',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  columnsDropdownWrapper: {
    position: 'relative' as const,
  },
  columnsBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    color: '#5f6368',
    background: '#f1f3f4',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
  dropdownBackdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  columnsDropdown: {
    position: 'absolute' as const,
    right: 0,
    top: '100%',
    marginTop: '4px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    padding: '8px 0',
    zIndex: 100,
    minWidth: '200px',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    fontSize: '13px',
    color: '#202124',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#202124',
    margin: '0 0 24px 0',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#5f6368',
    marginBottom: '6px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#202124',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelBtn: {
    padding: '8px 20px',
    fontSize: '14px',
    color: '#5f6368',
    background: '#f1f3f4',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  saveBtn: {
    padding: '8px 20px',
    fontSize: '14px',
    color: '#fff',
    background: '#1a73e8',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  inlineEditBtn: {
    marginLeft: '8px',
    padding: '2px 8px',
    fontSize: '12px',
    color: '#1a73e8',
    background: '#e8f0fe',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  autoCalcHint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#1a73e8',
    fontStyle: 'italic',
  },
}
