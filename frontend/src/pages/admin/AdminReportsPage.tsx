import { useState, useEffect, useRef } from 'react'
import StatsCard from '@/components/StatsCard'
import DateRangePicker from '@/components/DateRangePicker'
import { getAdminPartners, type PartnerStats } from '@/api/admin'
import {
  getAdminReport,
  downloadAdminReportPDF,
  type AllPartnersReportResponse,
} from '@/api/reports'

interface SelectedPartner {
  id: number
  name: string
  email: string
}

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPartners, setSelectedPartners] = useState<SelectedPartner[]>([])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerResults, setPartnerResults] = useState<PartnerStats[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [report, setReport] = useState<AllPartnersReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePartnerSearchChange = (value: string) => {
    setPartnerSearch(value)
    if (!value.trim()) {
      setPartnerResults([])
      setShowDropdown(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true)
      getAdminPartners({ search: value, page: 1, page_size: 20 })
        .then((res) => {
          setPartnerResults(res.items)
          setShowDropdown(true)
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false))
    }, 300)
  }

  const addPartner = (p: PartnerStats) => {
    if (selectedPartners.some((s) => s.id === p.id)) return
    setSelectedPartners((prev) => [...prev, { id: p.id, name: p.name, email: p.email }])
    setPartnerSearch('')
    setPartnerResults([])
    setShowDropdown(false)
  }

  const removePartner = (id: number) => {
    setSelectedPartners((prev) => prev.filter((p) => p.id !== id))
  }

  const clearAll = () => {
    setSelectedPartners([])
    setPartnerSearch('')
    setPartnerResults([])
    setShowDropdown(false)
  }

  const getReportParams = () => {
    const params: any = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (selectedPartners.length > 0) {
      params.partner_ids = selectedPartners.map((p) => p.id)
    }
    return params
  }

  const fetchReport = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminReport(getReportParams())
      setReport(data)
    } catch {
      setError('Не удалось загрузить отчёт')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [dateFrom, dateTo, selectedPartners])

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      await downloadAdminReportPDF(getReportParams())
    } catch {
      setError('Не удалось скачать PDF')
    } finally {
      setDownloading(false)
    }
  }

  const m = report?.totals
  const selectedIds = new Set(selectedPartners.map((p) => p.id))

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
        <div style={styles.filterLabel}>
          Партнёры:
          <div ref={dropdownRef} style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Поиск по имени, email, компании..."
              value={partnerSearch}
              onChange={(e) => handlePartnerSearchChange(e.target.value)}
              onFocus={() => { if (partnerResults.length > 0) setShowDropdown(true) }}
              style={styles.searchInput}
            />
            {showDropdown && (
              <div style={styles.dropdown}>
                {searchLoading ? (
                  <div style={styles.dropdownItem}>Поиск...</div>
                ) : partnerResults.length === 0 ? (
                  <div style={styles.dropdownItem}>Ничего не найдено</div>
                ) : (
                  partnerResults.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        ...styles.dropdownItemClickable,
                        ...(selectedIds.has(p.id) ? styles.dropdownItemSelected : {}),
                      }}
                      onClick={() => addPartner(p)}
                    >
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: '#5f6368', fontSize: '12px', marginLeft: '8px' }}>{p.email}</span>
                      {p.company && <span style={{ color: '#5f6368', fontSize: '12px', marginLeft: '8px' }}>({p.company})</span>}
                      {selectedIds.has(p.id) && <span style={{ marginLeft: 'auto', color: '#1a73e8', fontSize: '12px' }}> ✓</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        {selectedPartners.length > 0 && (
          <div style={styles.badgesRow}>
            {selectedPartners.map((p) => (
              <span key={p.id} style={styles.selectedBadge}>
                {p.name}
                <button style={styles.badgeRemove} onClick={() => removePartner(p.id)}>&times;</button>
              </span>
            ))}
            <button style={styles.clearAllBtn} onClick={clearAll}>Сбросить все</button>
          </div>
        )}
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
                {selectedPartners.length === 1 ? 'Партнёр' : 'По партнёрам'}
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
  filterLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#5f6368', fontWeight: 500, flexWrap: 'wrap' as const },
  searchWrapper: { position: 'relative' as const },
  searchInput: { padding: '8px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '14px', color: '#202124', outline: 'none', width: '320px' },
  dropdown: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, maxHeight: '240px', overflowY: 'auto' as const, marginTop: '2px' },
  dropdownItem: { padding: '10px 12px', fontSize: '13px', color: '#5f6368' },
  dropdownItemClickable: { padding: '10px 12px', fontSize: '13px', color: '#202124', cursor: 'pointer', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center' },
  dropdownItemSelected: { background: '#e8f0fe' },
  badgesRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '8px', alignItems: 'center' },
  selectedBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px 4px 10px', background: '#e8f0fe', color: '#1a73e8', borderRadius: '12px', fontSize: '13px', fontWeight: 500 },
  badgeRemove: { background: 'none', border: 'none', color: '#1a73e8', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '0 2px', fontWeight: 700 },
  clearAllBtn: { background: 'none', border: 'none', color: '#5f6368', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' },
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
