import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSummary,
  getLinksStats,
  getLinkClicks,
  type Summary,
  type LinkStats,
  type DailyClicks,
} from '@/api/analytics'
import StatsCard from '@/components/StatsCard'
import ClickChart from '@/components/ClickChart'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [linksStats, setLinksStats] = useState<LinkStats[]>([])
  const [chartData, setChartData] = useState<DailyClicks[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, linksData] = await Promise.all([
          getSummary(),
          getLinksStats(),
        ])
        setSummary(summaryData)
        setLinksStats(linksData)

        if (linksData.length > 0) {
          const clicks = await getLinkClicks(linksData[0].link_id)
          setChartData(clicks)
        }
      } catch {
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  const LINK_TYPE_LABELS: Record<string, string> = {
    direct: 'Прямая',
    iframe: 'iFrame',
    landing: 'Лендинг',
  }

  const topLinks = linksStats.slice(0, 5)

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Дашборд</h1>

      {error && <div style={styles.error}>{error}</div>}

      {summary && (
        <div style={styles.statsGrid}>
          <StatsCard
            title="Всего кликов"
            value={summary.total_clicks}
            subtitle="За всё время"
            color="#1a73e8"
          />
          <StatsCard
            title="Всего клиентов"
            value={summary.total_clients}
            subtitle="За всё время"
            color="#1e8e3e"
          />
          <StatsCard
            title="Конверсия"
            value={`${summary.conversion_rate}%`}
            subtitle="Клиенты / Клики"
            color={summary.conversion_rate >= 5 ? '#1e8e3e' : summary.conversion_rate >= 1 ? '#f9ab00' : '#d93025'}
          />
          <StatsCard
            title="Клики сегодня"
            value={summary.clicks_today}
            color="#7b1fa2"
          />
          <StatsCard
            title="Клиенты сегодня"
            value={summary.clients_today}
            color="#e65100"
          />
        </div>
      )}

      {chartData.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Клики за 30 дней</h2>
          <ClickChart data={chartData} />
        </div>
      )}

      {topLinks.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Топ ссылок</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Название</th>
                  <th style={styles.th}>Тип</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Клики</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Клиенты</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {topLinks.map((link) => (
                  <tr
                    key={link.link_id}
                    style={styles.tr}
                    onClick={() => navigate(`/links/${link.link_id}`)}
                  >
                    <td style={styles.td}>
                      <span style={styles.linkTitle}>{link.title}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.typeBadge}>
                        {LINK_TYPE_LABELS[link.link_type] || link.link_type}
                      </span>
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
        </div>
      )}

      {!loading && linksStats.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>Пока нет данных для отображения.</p>
          <button style={styles.btnPrimary} onClick={() => navigate('/links')}>
            Создать ссылку
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  pageTitle: { fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#202124' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  statsGrid: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#202124' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '2px solid #e8eaed' },
  tr: { cursor: 'pointer', transition: 'background 0.15s' },
  td: { padding: '12px', borderBottom: '1px solid #f1f3f4', fontSize: '14px', color: '#202124' },
  linkTitle: { fontWeight: 500, color: '#1a73e8' },
  typeBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500, background: '#e8f0fe', color: '#1a73e8' },
  convBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  emptyText: { fontSize: '16px', color: '#5f6368', marginBottom: '16px' },
  btnPrimary: { padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
}
