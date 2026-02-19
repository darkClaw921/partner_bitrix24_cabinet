import { useState, useEffect } from 'react'
import StatsCard from '@/components/StatsCard'
import DateRangePicker from '@/components/DateRangePicker'
import { getAdminPartners, type PartnerStats } from '@/api/admin'
import {
  getAdminReport,
  downloadAdminReportPDF,
  type AllPartnersReportResponse,
} from '@/api/reports'

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>(undefined)
  const [partners, setPartners] = useState<PartnerStats[]>([])
  const [report, setReport] = useState<AllPartnersReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminPartners().then(setPartners).catch(() => {})
  }, [])

  const fetchReport = async (from: string, to: string, partnerId?: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminReport({
        date_from: from || undefined,
        date_to: to || undefined,
        partner_id: partnerId,
      })
      setReport(data)
    } catch {
      setError('Не удалось загрузить отчёт')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(dateFrom, dateTo, selectedPartnerId)
  }, [dateFrom, dateTo, selectedPartnerId])

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      await downloadAdminReportPDF({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        partner_id: selectedPartnerId,
      })
    } catch {
      setError('Не удалось скачать PDF')
    } finally {
      setDownloading(false)
    }
  }

  const m = report?.totals

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

      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>
          Партнёр:
          <select
            style={styles.select}
            value={selectedPartnerId ?? ''}
            onChange={(e) => setSelectedPartnerId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Все партнёры</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.loader}>Загрузка...</div>
      ) : m ? (
        <>
          <div style={styles.statsGrid}>
            <StatsCard title="Лиды" value={m.total_leads} color="#1a73e8" />
            <StatsCard title="Сделки" value={m.total_deals} color="#f9a825" />
            <StatsCard title="Успешные сделки" value={m.total_successful_deals} color="#1e8e3e" />
            <StatsCard title="Проигранные" value={m.total_lost_deals} color="#d93025" />
            <StatsCard title="Лиды → Сделки" value={`${m.conversion_leads_to_deals}%`} color="#0288d1" />
            <StatsCard title="Сделки → Успешные" value={`${m.conversion_deals_to_successful}%`} color="#2e7d32" />
            <StatsCard title="Комиссия" value={`${m.total_commission.toLocaleString()} ₽`} color="#e65100" />
            <StatsCard title="Выплачено" value={`${m.paid_commission.toLocaleString()} ₽`} color="#1e8e3e" />
            <StatsCard title="Не выплачено" value={`${m.unpaid_commission.toLocaleString()} ₽`} color="#d93025" />
            <StatsCard title="В работе" value={m.leads_in_progress} color="#7b1fa2" />
            <StatsCard title="Клики" value={m.total_clicks} color="#4285f4" />
          </div>

          {report!.partners.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>
                {selectedPartnerId ? 'Партнёр' : 'По партнёрам'}
              </h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Имя</th>
                      <th style={styles.th}>Email</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Лиды</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Сделки</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Успешные</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Лид→Сд.</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Сд.→Усп.</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Комиссия</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Выплачено</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Не выплачено</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Клики</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report!.partners.map((p) => (
                      <tr key={p.partner_id}>
                        <td style={{ ...styles.td, fontWeight: 500 }}>{p.partner_name}</td>
                        <td style={styles.td}>{p.partner_email}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.total_leads}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.total_deals}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.total_successful_deals}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.conversion_leads_to_deals}%</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.conversion_deals_to_successful}%</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.total_commission.toLocaleString()}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.paid_commission.toLocaleString()}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.unpaid_commission.toLocaleString()}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{p.metrics.total_clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report!.partners.length === 0 && (
            <div style={styles.emptyState}>Нет данных за выбранный период</div>
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
  filterRow: { marginBottom: '20px' },
  filterLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#5f6368', fontWeight: 500 },
  select: { padding: '8px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', color: '#202124', outline: 'none', minWidth: '250px' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  statsGrid: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#202124' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '2px solid #e8eaed' },
  td: { padding: '12px', borderBottom: '1px solid #f1f3f4', fontSize: '14px', color: '#202124' },
  emptyState: { textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', color: '#5f6368', fontSize: '15px' },
}
