import type { BitrixStats as BitrixStatsType } from '@/api/analytics'

interface BitrixStatsProps {
  data: BitrixStatsType | null
  loading: boolean
  onFetch: () => void
}

function getSemanticStatusStyle(semanticId: string | undefined): { bg: string; color: string } {
  switch (semanticId) {
    case 'S': return { bg: '#e6f4ea', color: '#1e8e3e' }
    case 'F': return { bg: '#fce8e6', color: '#d93025' }
    case 'P': return { bg: '#e8f0fe', color: '#1a73e8' }
    default: return { bg: '#f1f3f4', color: '#5f6368' }
  }
}

export default function BitrixStats({ data, loading, onFetch }: BitrixStatsProps) {
  return (
    <div>
      <div style={styles.header}>
        <h3 style={styles.title}>Bitrix24</h3>
        <button
          style={styles.fetchBtn}
          onClick={onFetch}
          disabled={loading}
        >
          {loading ? 'Загрузка...' : 'Запросить данные из Bitrix24'}
        </button>
      </div>

      {data && !data.success && (
        <div style={styles.error}>
          Не удалось получить данные{data.error ? `: ${data.error}` : ''}
        </div>
      )}

      {data && data.success && (
        <>
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Клиентов в Bitrix</div>
              <div style={styles.summaryValue}>{data.total_clients}</div>
            </div>
            {data.conversion && (
              <>
                <div style={styles.summaryCard}>
                  <div style={styles.summaryLabel}>Успешных</div>
                  <div style={styles.summaryValue}>{data.conversion.successful}</div>
                </div>
                <div style={styles.summaryCard}>
                  <div style={styles.summaryLabel}>Конверсия</div>
                  <div style={styles.summaryValue}>{data.conversion.percentage}%</div>
                </div>
              </>
            )}
          </div>

          {data.clients.length > 0 && (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Имя</th>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Статус</th>
                    <th style={styles.th}>Ответственный</th>
                    <th style={styles.th}>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((client, idx) => {
                    const statusStyle = getSemanticStatusStyle(client.status_semantic_id)
                    return (
                      <tr key={idx}>
                        <td style={styles.td}>{client.name}</td>
                        <td style={styles.td}>
                          <code style={styles.code}>{client.external_id}</code>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                          }}>
                            {client.status}
                          </span>
                        </td>
                        <td style={styles.td}>{client.assigned_by_name || '—'}</td>
                        <td style={{ ...styles.td, color: '#5f6368' }}>
                          {client.created_at ? new Date(client.created_at).toLocaleDateString('ru-RU') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '18px', fontWeight: 600, color: '#202124', margin: 0 },
  fetchBtn: { padding: '8px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '20px' },
  summaryCard: { flex: 1, background: '#f8f9fa', borderRadius: '8px', padding: '16px' },
  summaryLabel: { fontSize: '12px', color: '#5f6368', fontWeight: 500, textTransform: 'uppercase' as const, marginBottom: '4px' },
  summaryValue: { fontSize: '24px', fontWeight: 700, color: '#202124' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase' as const, borderBottom: '2px solid #e8eaed', letterSpacing: '0.5px' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f3f4', fontSize: '14px', color: '#202124' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 },
  code: { background: '#f1f3f4', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' },
}
