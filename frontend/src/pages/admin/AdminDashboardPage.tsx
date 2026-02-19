import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminOverview, getGlobalRewardPercentage, updateGlobalRewardPercentage, type AdminOverview } from '@/api/admin'
import StatsCard from '@/components/StatsCard'

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalPct, setGlobalPct] = useState<number>(10)
  const [editingPct, setEditingPct] = useState(false)
  const [pctInput, setPctInput] = useState('')
  const [savingPct, setSavingPct] = useState(false)

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
    getGlobalRewardPercentage()
      .then((r) => setGlobalPct(r.default_reward_percentage))
      .catch(() => {})
  }, [])

  const saveGlobalPct = async () => {
    const val = parseFloat(pctInput)
    if (isNaN(val) || val < 0 || val > 100) return
    setSavingPct(true)
    try {
      const result = await updateGlobalRewardPercentage(val)
      setGlobalPct(result.default_reward_percentage)
      setEditingPct(false)
    } catch { /* ignore */ }
    finally { setSavingPct(false) }
  }

  if (loading) return <div>Загрузка...</div>
  if (!data) return <div>Ошибка загрузки данных</div>

  return (
    <div>
      <div style={styles.statsGrid}>
        <StatsCard title="Партнёры" value={data.total_partners} color="#1a73e8" />
        <StatsCard title="Ссылки" value={data.total_links} color="#34a853" />
        <StatsCard title="Клики" value={data.total_clicks} color="#fbbc04" />
        <StatsCard title="Клиенты" value={data.total_clients} color="#ea4335" />
        <StatsCard title="Лендинги" value={data.total_landings} color="#9334e6" />
        <StatsCard title="Выплачено партнёрам" value={data.total_paid_amount > 0 ? data.total_paid_amount.toLocaleString('ru-RU') + ' \u20BD' : '0 \u20BD'} color="#34a853" />
        <StatsCard title="К выплате" value={data.total_unpaid_amount > 0 ? data.total_unpaid_amount.toLocaleString('ru-RU') + ' \u20BD' : '0 \u20BD'} color="#ea4335" />
      </div>

      <div style={styles.rewardSection}>
        <span style={styles.rewardLabel}>Глобальный % вознаграждения:</span>
        {editingPct ? (
          <span style={styles.rewardEditRow}>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              style={styles.rewardInput}
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGlobalPct()}
              autoFocus
            />
            <span style={styles.rewardPctSign}>%</span>
            <button style={styles.rewardSaveBtn} onClick={saveGlobalPct} disabled={savingPct}>
              {savingPct ? '...' : 'OK'}
            </button>
            <button style={styles.rewardCancelBtn} onClick={() => setEditingPct(false)}>Отмена</button>
          </span>
        ) : (
          <span style={styles.rewardEditRow}>
            <span style={styles.rewardValue}>{globalPct}%</span>
            <button style={styles.rewardEditBtn} onClick={() => { setPctInput(String(globalPct)); setEditingPct(true) }}>
              Изменить
            </button>
          </span>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Партнёры</h2>
          <Link to="/admin/partners" style={styles.viewAll}>Все партнёры</Link>
        </div>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Имя</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Компания</th>
                <th style={styles.th}>Ссылки</th>
                <th style={styles.th}>Клики</th>
                <th style={styles.th}>Клиенты</th>
                <th style={styles.th}>Лендинги</th>
              </tr>
            </thead>
            <tbody>
              {data.partners.slice(0, 10).map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>
                    <Link to={`/admin/partners/${p.id}`} style={styles.link}>{p.name}</Link>
                  </td>
                  <td style={styles.td}>{p.email}</td>
                  <td style={styles.td}>{p.company || '—'}</td>
                  <td style={styles.td}>{p.links_count}</td>
                  <td style={styles.td}>{p.clicks_count}</td>
                  <td style={styles.td}>{p.clients_count}</td>
                  <td style={styles.td}>{p.landings_count}</td>
                </tr>
              ))}
              {data.partners.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#5f6368' }}>
                    Пока нет партнёров
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  statsGrid: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '32px',
  },
  section: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '24px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#202124',
    margin: 0,
  },
  viewAll: {
    fontSize: '14px',
    color: '#1a73e8',
    textDecoration: 'none',
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
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e8eaed',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#202124',
    borderBottom: '1px solid #e8eaed',
  },
  link: {
    color: '#1a73e8',
    textDecoration: 'none',
    fontWeight: 500,
  },
  rewardSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '16px 24px',
    marginBottom: '24px',
  },
  rewardLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#202124',
  },
  rewardEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rewardValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a73e8',
  },
  rewardInput: {
    width: '80px',
    padding: '6px 10px',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  rewardPctSign: {
    fontSize: '14px',
    color: '#5f6368',
  },
  rewardEditBtn: {
    padding: '4px 12px',
    fontSize: '13px',
    color: '#1a73e8',
    background: '#e8f0fe',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  rewardSaveBtn: {
    padding: '4px 12px',
    fontSize: '13px',
    color: '#fff',
    background: '#1a73e8',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  rewardCancelBtn: {
    padding: '4px 12px',
    fontSize: '13px',
    color: '#5f6368',
    background: '#f1f3f4',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
}
