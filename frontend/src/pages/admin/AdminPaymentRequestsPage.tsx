import { useState, useEffect } from 'react'
import {
  getAdminPaymentRequests,
  getAdminPaymentRequest,
  processPaymentRequest,
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

export default function AdminPaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequestResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [detail, setDetail] = useState<PaymentRequestResponse | null>(null)
  const [adminComment, setAdminComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const { showToast } = useToast()

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const data = await getAdminPaymentRequests(statusFilter || undefined)
      setRequests(data)
    } catch {
      showToast('Не удалось загрузить запросы', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [statusFilter])

  const openDetail = async (id: number) => {
    try {
      const data = await getAdminPaymentRequest(id)
      setDetail(data)
      setAdminComment('')
    } catch {
      showToast('Не удалось загрузить детали', 'error')
    }
  }

  const handleProcess = async (status: 'approved' | 'rejected') => {
    if (!detail) return
    setProcessing(true)
    try {
      await processPaymentRequest(detail.id, {
        status,
        admin_comment: adminComment || undefined,
      })
      showToast(status === 'approved' ? 'Запрос одобрен' : 'Запрос отклонён', 'success')
      setDetail(null)
      await fetchRequests()
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Запросы на выплату</h1>
        <div style={styles.filters}>
          {['', 'pending', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              style={{
                ...styles.filterBtn,
                ...(statusFilter === f ? styles.filterBtnActive : {}),
              }}
              onClick={() => setStatusFilter(f)}
            >
              {f === '' ? 'Все' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loader}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={styles.empty}>Запросов не найдено</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Партнёр</th>
                <th style={styles.th}>Сумма</th>
                <th style={styles.th}>Клиентов</th>
                <th style={styles.th}>Статус</th>
                <th style={styles.th}>Дата</th>
                <th style={styles.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{r.id}</td>
                  <td style={styles.td}>{r.partner_name || `Partner #${r.partner_id}`}</td>
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
                  <td style={styles.td}>
                    <button style={styles.btnSmall} onClick={() => openDetail(r.id)}>
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div style={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Запрос #{detail.id}</h3>
              <button style={styles.modalClose} onClick={() => setDetail(null)}>&times;</button>
            </div>

            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Партнёр:</span>
              <span>{detail.partner_name || `#${detail.partner_id}`}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Статус:</span>
              <span style={{
                ...styles.badge,
                background: STATUS_COLORS[detail.status]?.bg,
                color: STATUS_COLORS[detail.status]?.color,
              }}>
                {STATUS_LABELS[detail.status]}
              </span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Сумма:</span>
              <strong>{detail.total_amount.toFixed(2)}</strong>
            </div>
            {detail.payment_details && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Реквизиты для выплаты:</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{detail.payment_details}</span>
              </div>
            )}
            {detail.comment && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Комментарий партнёра:</span>
                <span>{detail.comment}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Дата:</span>
              <span>{new Date(detail.created_at).toLocaleString('ru-RU')}</span>
            </div>

            <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Клиенты:</h4>
            <div style={styles.clientList}>
              {detail.clients_summary.map(c => (
                <div key={c.id} style={styles.clientItem}>
                  <span>{c.name}</span>
                  <span style={{ color: '#5f6368', fontSize: '13px' }}>
                    {c.email || c.phone || '—'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#1e8e3e', fontWeight: 500, fontSize: '13px' }}>
                      {c.partner_reward?.toFixed(2)} (сделка: {c.deal_amount?.toFixed(2) || '—'})
                    </span>
                    {c.deal_url && (
                      <a
                        href={c.deal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1a73e8', fontSize: '12px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {c.deal_status_name || 'B24'} &#8599;
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {detail.status === 'pending' && (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Комментарий администратора</label>
                  <textarea
                    style={styles.textarea}
                    value={adminComment}
                    onChange={e => setAdminComment(e.target.value)}
                    placeholder="Комментарий (необязательно)..."
                    rows={2}
                  />
                </div>
                <div style={styles.actionButtons}>
                  <button
                    style={styles.btnApprove}
                    disabled={processing}
                    onClick={() => handleProcess('approved')}
                  >
                    {processing ? '...' : 'Одобрить'}
                  </button>
                  <button
                    style={styles.btnReject}
                    disabled={processing}
                    onClick={() => handleProcess('rejected')}
                  >
                    {processing ? '...' : 'Отклонить'}
                  </button>
                </div>
              </>
            )}

            {detail.admin_comment && detail.status !== 'pending' && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Комментарий админа:</span>
                <span>{detail.admin_comment}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '24px', fontWeight: 600 },
  filters: { display: 'flex', gap: '6px' },
  filterBtn: { padding: '6px 14px', background: '#fff', color: '#5f6368', border: '1px solid #dadce0', borderRadius: '16px', fontSize: '13px', cursor: 'pointer' },
  filterBtnActive: { background: '#1a73e8', color: '#fff', borderColor: '#1a73e8' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', color: '#5f6368', fontSize: '16px' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  btnSmall: { padding: '6px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: { fontSize: '18px', fontWeight: 600 },
  modalClose: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 },
  detailRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '14px' },
  detailLabel: { color: '#5f6368', fontWeight: 500, whiteSpace: 'nowrap' },
  clientList: { marginBottom: '16px' },
  clientItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f3f4', gap: '8px', fontSize: '14px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  textarea: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' },
  actionButtons: { display: 'flex', gap: '10px' },
  btnApprove: { flex: 1, padding: '10px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  btnReject: { flex: 1, padding: '10px', background: '#fff', color: '#d93025', border: '1px solid #d93025', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
}
