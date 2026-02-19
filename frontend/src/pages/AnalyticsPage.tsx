import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  getLinksStats,
  getLinkClicks,
  getClientsStats,
  fetchBitrixStats,
  type LinkStats,
  type DailyClicks,
  type ClientStats,
  type BitrixStats as BitrixStatsType,
} from '@/api/analytics'
import ClickChart from '@/components/ClickChart'
import BitrixStatsComponent from '@/components/BitrixStats'

const LINK_TYPE_LABELS: Record<string, string> = {
  direct: 'Прямая',
  iframe: 'iFrame',
  landing: 'Лендинг',
}

export default function AnalyticsPage() {
  const [linksStats, setLinksStats] = useState<LinkStats[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null)
  const [linkClicks, setLinkClicks] = useState<DailyClicks[]>([])
  const [clientsStats, setClientsStats] = useState<ClientStats[]>([])
  const [bitrixData, setBitrixData] = useState<BitrixStatsType | null>(null)
  const [bitrixLoading, setBitrixLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [links, clients] = await Promise.all([
          getLinksStats(),
          getClientsStats(),
        ])
        setLinksStats(links)
        setClientsStats(clients)
      } catch {
        setError('Не удалось загрузить данные аналитики')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleLinkSelect = async (linkId: number) => {
    if (selectedLinkId === linkId) {
      setSelectedLinkId(null)
      setLinkClicks([])
      return
    }
    setSelectedLinkId(linkId)
    try {
      const clicks = await getLinkClicks(linkId)
      setLinkClicks(clicks)
    } catch {
      setLinkClicks([])
    }
  }

  const handleBitrixFetch = async () => {
    setBitrixLoading(true)
    try {
      const data = await fetchBitrixStats()
      setBitrixData(data)
    } catch {
      setBitrixData({ success: false, clients: [], total_amount: 0, total_clients: 0, error: 'Ошибка запроса' })
    } finally {
      setBitrixLoading(false)
    }
  }

  const clientsChartData = clientsStats.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }))

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Аналитика</h1>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Статистика по ссылкам</h2>
        {linksStats.length === 0 ? (
          <p style={styles.emptyText}>Нет данных о ссылках</p>
        ) : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Название</th>
                    <th style={styles.th}>Тип</th>
                    <th style={styles.th}>Код</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Клики</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Клиенты</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Конверсия</th>
                  </tr>
                </thead>
                <tbody>
                  {linksStats.map((link) => (
                    <tr
                      key={link.link_id}
                      style={{
                        ...styles.tr,
                        background: selectedLinkId === link.link_id ? '#e8f0fe' : undefined,
                      }}
                      onClick={() => handleLinkSelect(link.link_id)}
                    >
                      <td style={styles.td}>
                        <span style={styles.linkTitle}>{link.title}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.typeBadge}>
                          {LINK_TYPE_LABELS[link.link_type] || link.link_type}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <code style={styles.code}>{link.link_code}</code>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {link.clicks_count}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {link.clients_count}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={{
                          ...styles.convBadge,
                          background: link.conversion_rate >= 5 ? '#e6f4ea' : link.conversion_rate >= 1 ? '#fef7e0' : '#fce8e6',
                          color: link.conversion_rate >= 5 ? '#1e8e3e' : link.conversion_rate >= 1 ? '#e37400' : '#d93025',
                        }}>
                          {link.conversion_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedLinkId && linkClicks.length > 0 && (
              <div style={styles.chartSection}>
                <h3 style={styles.chartTitle}>
                  Клики по дням — {linksStats.find((l) => l.link_id === selectedLinkId)?.title}
                </h3>
                <ClickChart data={linkClicks} />
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Статистика клиентов по дням</h2>
        {clientsChartData.length === 0 ? (
          <p style={styles.emptyText}>Нет данных о клиентах</p>
        ) : (
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#5f6368' }}
                  axisLine={{ stroke: '#dadce0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#5f6368' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #dadce0',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="form_count" name="Из формы" fill="#1e8e3e" radius={[3, 3, 0, 0]} stackId="clients" />
                <Bar dataKey="manual_count" name="Вручную" fill="#1a73e8" radius={[3, 3, 0, 0]} stackId="clients" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <BitrixStatsComponent
          data={bitrixData}
          loading={bitrixLoading}
          onFetch={handleBitrixFetch}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  pageTitle: { fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#202124' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#202124' },
  emptyText: { color: '#5f6368', fontSize: '14px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '2px solid #e8eaed' },
  tr: { cursor: 'pointer', transition: 'background 0.15s' },
  td: { padding: '12px', borderBottom: '1px solid #f1f3f4', fontSize: '14px', color: '#202124' },
  linkTitle: { fontWeight: 500, color: '#1a73e8' },
  typeBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500, background: '#e8f0fe', color: '#1a73e8' },
  code: { background: '#f1f3f4', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' },
  convBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 },
  chartSection: { marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e8eaed' },
  chartTitle: { fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#202124' },
}
