import { useState, useEffect } from 'react'
import {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  type RegistrationRequest,
} from '@/api/admin'
import { useToast } from '@/hooks/useToast'

export default function AdminRegistrationsPage() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)
  const [rejectModal, setRejectModal] = useState<RegistrationRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const { showToast } = useToast()

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const data = await getPendingRegistrations()
      setRequests(data)
    } catch {
      showToast('Не удалось загрузить заявки', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleApprove = async (id: number) => {
    setProcessing(id)
    try {
      await approveRegistration(id)
      showToast('Заявка одобрена', 'success')
      await fetchRequests()
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Ошибка при одобрении', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const openRejectModal = (req: RegistrationRequest) => {
    setRejectModal(req)
    setRejectionReason('')
  }

  const handleReject = async () => {
    if (!rejectModal) return
    setProcessing(rejectModal.id)
    try {
      await rejectRegistration(rejectModal.id, rejectionReason || undefined)
      showToast('Заявка отклонена', 'success')
      setRejectModal(null)
      await fetchRequests()
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Ошибка при отклонении', 'error')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Заявки на регистрацию</h1>

      {loading ? (
        <div style={styles.loader}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={styles.empty}>Нет заявок на рассмотрении</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Имя</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Компания</th>
                <th style={styles.th}>Дата регистрации</th>
                <th style={styles.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>{r.email}</td>
                  <td style={styles.td}>{r.company || '—'}</td>
                  <td style={styles.td}>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        style={styles.btnApprove}
                        disabled={processing === r.id}
                        onClick={() => handleApprove(r.id)}
                      >
                        {processing === r.id ? '...' : 'Одобрить'}
                      </button>
                      <button
                        style={styles.btnReject}
                        disabled={processing === r.id}
                        onClick={() => openRejectModal(r)}
                      >
                        Отклонить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal && (
        <div style={styles.modalOverlay} onClick={() => setRejectModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Отклонить заявку</h3>
              <button style={styles.modalClose} onClick={() => setRejectModal(null)}>&times;</button>
            </div>
            <p style={{ fontSize: '14px', color: '#5f6368', marginBottom: '12px' }}>
              Отклонить заявку от <strong>{rejectModal.name}</strong> ({rejectModal.email})?
            </p>
            <div style={styles.field}>
              <label style={styles.label}>Причина отклонения (необязательно)</label>
              <textarea
                style={styles.textarea}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Укажите причину..."
                rows={3}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                style={styles.btnRejectConfirm}
                disabled={processing === rejectModal.id}
                onClick={handleReject}
              >
                {processing === rejectModal.id ? '...' : 'Отклонить'}
              </button>
              <button style={styles.btnCancel} onClick={() => setRejectModal(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  title: { fontSize: '24px', fontWeight: 600, marginBottom: '24px' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', color: '#5f6368', fontSize: '16px' },
  tableWrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  actions: { display: 'flex', gap: '8px' },
  btnApprove: { padding: '6px 14px', background: '#1e8e3e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnReject: { padding: '6px 14px', background: '#fff', color: '#d93025', border: '1px solid #d93025', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalTitle: { fontSize: '18px', fontWeight: 600 },
  modalClose: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 },
  field: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500, color: '#5f6368' },
  textarea: { width: '100%', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' },
  modalActions: { display: 'flex', gap: '10px' },
  btnRejectConfirm: { flex: 1, padding: '10px', background: '#d93025', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  btnCancel: { flex: 1, padding: '10px', background: '#fff', color: '#5f6368', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
}
