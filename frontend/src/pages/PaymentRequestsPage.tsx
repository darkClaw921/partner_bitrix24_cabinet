import { useState, useEffect } from 'react'
import { getClients, type Client } from '@/api/clients'
import {
  getPartnerPaymentRequests,
  createPaymentRequest,
  type PaymentRequestResponse,
} from '@/api/paymentRequests'
import { useToast } from '@/hooks/useToast'

const STATUS_LABELS: Record<string, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрен',
  rejected: 'Отклонён',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef7e0', color: '#f9a825' },
  approved: { bg: '#e6f4ea', color: '#1e8e3e' },
  rejected: { bg: '#fce8e6', color: '#d93025' },
}

export default function PaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequestResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [comment, setComment] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const fetchRequests = async () => {
    try {
      const data = await getPartnerPaymentRequests()
      setRequests(data)
    } catch {
      setError('Не удалось загрузить запросы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const openModal = async () => {
    try {
      // Fetch all clients in pages of 100
      const allClients: Client[] = []
      let skip = 0
      const batchSize = 100
      while (true) {
        const batch = await getClients(skip, batchSize)
        allClients.push(...batch)
        if (batch.length < batchSize) break
        skip += batchSize
      }
      // Filter: has reward, not paid
      const eligible = allClients.filter(c => c.partner_reward !== null && c.partner_reward > 0 && !c.is_paid)
      setClients(eligible)
      setSelectedIds(new Set())
      setComment('')
      setShowModal(true)
    } catch {
      showToast('Не удалось загрузить клиентов', 'error')
    }
  }

  const toggleClient = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalAmount = clients
    .filter(c => selectedIds.has(c.id))
    .reduce((sum, c) => sum + (c.partner_reward || 0), 0)

  const handleCreate = async () => {
    if (selectedIds.size === 0) return
    setCreating(true)
    try {
      await createPaymentRequest({
        client_ids: Array.from(selectedIds),
        comment: comment || undefined,
      })
      showToast('Запрос на выплату создан', 'success')
      setShowModal(false)
      await fetchRequests()
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Ошибка создания запроса'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Запросы на выплату</h1>
        <button style={styles.btnPrimary} onClick={openModal}>
          + Запросить выплату
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {requests.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>У вас ещё нет запросов на выплату.</p>
          <p style={styles.emptyHint}>Создайте первый запрос, выбрав клиентов с рассчитанным вознаграждением.</p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Сумма</th>
                <th style={styles.th}>Клиентов</th>
                <th style={styles.th}>Статус</th>
                <th style={styles.th}>Дата</th>
                <th style={styles.th}>Комментарий админа</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{r.id}</td>
                  <td style={styles.td}><strong>{r.total_amount.toFixed(2)}</strong></td>
                  <td style={styles.td}>{r.client_ids.length}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: STATUS_COLORS[r.status]?.bg,
                      color: STATUS_COLORS[r.status]?.color,
                    }}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={styles.td}>{r.admin_comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Запросить выплату</h3>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>&times;</button>
            </div>

            {clients.length === 0 ? (
              <p style={{ color: '#5f6368', fontSize: '14px' }}>
                Нет клиентов с рассчитанным вознаграждением.
              </p>
            ) : (
              <>
                <div style={styles.clientList}>
                  {clients.map(c => (
                    <label key={c.id} style={styles.clientRow}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleClient(c.id)}
                      />
                      <span style={styles.clientName}>{c.name}</span>
                      <span style={styles.clientReward}>
                        {c.partner_reward?.toFixed(2)} (сделка: {c.deal_amount?.toFixed(2) || '—'})
                      </span>
                    </label>
                  ))}
                </div>

                <div style={styles.totalRow}>
                  <strong>Итого: {totalAmount.toFixed(2)}</strong>
                  <span style={styles.totalHint}>Выбрано: {selectedIds.size}</span>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Комментарий (необязательно)</label>
                  <textarea
                    style={styles.textarea}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Укажите реквизиты или комментарий..."
                    rows={3}
                  />
                </div>

                <button
                  style={styles.btnPrimary}
                  disabled={selectedIds.size === 0 || creating}
                  onClick={handleCreate}
                >
                  {creating ? 'Создание...' : `Запросить выплату (${totalAmount.toFixed(2)})`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1000px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 600 },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  emptyText: { fontSize: '18px', fontWeight: 500, marginBottom: '8px' },
  emptyHint: { fontSize: '14px', color: '#5f6368' },
  btnPrimary: { padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '560px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: { fontSize: '18px', fontWeight: 600 },
  modalClose: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 },
  clientList: { maxHeight: '300px', overflow: 'auto', marginBottom: '16px' },
  clientRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f3f4', cursor: 'pointer', fontSize: '14px' },
  clientName: { flex: 1 },
  clientReward: { color: '#1e8e3e', fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid #e8eaed', marginBottom: '16px', fontSize: '16px' },
  totalHint: { color: '#5f6368', fontSize: '13px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  textarea: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' },
}
