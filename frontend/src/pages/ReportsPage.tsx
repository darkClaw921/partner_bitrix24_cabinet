import { useState, useEffect } from 'react'
import StatsCard from '@/components/StatsCard'
import DateRangePicker from '@/components/DateRangePicker'
import {
  getPartnerReport,
  downloadPartnerReportPDF,
  type PartnerReportResponse,
} from '@/api/reports'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [report, setReport] = useState<PartnerReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = async (from: string, to: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await getPartnerReport({
        date_from: from || undefined,
        date_to: to || undefined,
      })
      setReport(data)
    } catch {
      setError('Не удалось загрузить отчёт')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(dateFrom, dateTo)
  }, [dateFrom, dateTo])

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      await downloadPartnerReportPDF({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
    } catch {
      setError('Не удалось скачать PDF')
    } finally {
      setDownloading(false)
    }
  }

  const m = report?.metrics

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Отчёты</h1>
        <button
          style={styles.btnPrimary}
          onClick={handleDownloadPDF}
          disabled={downloading || loading}
        >
          {downloading ? 'Скачивание...' : 'Скачать PDF'}
        </button>
      </div>

      <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.loader}>Загрузка...</div>
      ) : m ? (
        <>
          <div style={styles.statsGrid}>
            <StatsCard title="Лиды" value={m.total_leads} color="#1a73e8" />
            <StatsCard title="Продажи" value={m.total_sales} color="#1e8e3e" />
            <StatsCard title="Комиссия" value={`${m.total_commission.toLocaleString()} ₽`} color="#e65100" />
            <StatsCard title="Выплачено" value={`${m.paid_commission.toLocaleString()} ₽`} color="#1e8e3e" />
            <StatsCard title="Не выплачено" value={`${m.unpaid_commission.toLocaleString()} ₽`} color="#d93025" />
            <StatsCard title="В работе" value={m.leads_in_progress} color="#7b1fa2" />
            <StatsCard title="Клики" value={m.total_clicks} color="#4285f4" />
          </div>

          {report!.clients.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Клиенты</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Имя</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Телефон</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Сумма</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Комиссия</th>
                      <th style={styles.th}>Оплата</th>
                      <th style={styles.th}>Статус</th>
                      <th style={styles.th}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report!.clients.map((c, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{c.name || '—'}</td>
                        <td style={styles.td}>{c.email || '—'}</td>
                        <td style={styles.td}>{c.phone || '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {c.deal_amount != null ? c.deal_amount.toLocaleString() : '—'}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {c.partner_reward != null ? c.partner_reward.toLocaleString() : '—'}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            background: c.is_paid ? '#e6f4ea' : '#fce8e6',
                            color: c.is_paid ? '#1e8e3e' : '#d93025',
                          }}>
                            {c.is_paid ? 'Да' : 'Нет'}
                          </span>
                        </td>
                        <td style={styles.td}>{c.deal_status || '—'}</td>
                        <td style={styles.td}>{c.created_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report!.clients.length === 0 && (
            <div style={styles.emptyState}>Нет клиентов за выбранный период</div>
          )}
        </>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  pageTitle: { fontSize: '24px', fontWeight: 700, color: '#202124', margin: 0 },
  btnPrimary: { padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  statsGrid: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#202124' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '2px solid #e8eaed' },
  td: { padding: '12px', borderBottom: '1px solid #f1f3f4', fontSize: '14px', color: '#202124' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', color: '#5f6368', fontSize: '15px' },
}
