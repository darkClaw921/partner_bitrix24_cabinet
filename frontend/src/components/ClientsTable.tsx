import type { Client } from '@/api/clients'

interface ClientsTableProps {
  clients: Client[]
  skip: number
  limit: number
  onPageChange: (newSkip: number) => void
}

const SOURCE_LABELS: Record<string, string> = {
  form: 'Форма',
  manual: 'Вручную',
}

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  form: { bg: '#e6f4ea', color: '#1e8e3e' },
  manual: { bg: '#e8f0fe', color: '#1a73e8' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ClientsTable({ clients, skip, limit, onPageChange }: ClientsTableProps) {
  if (clients.length === 0 && skip === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>Клиентов пока нет</p>
        <p style={styles.emptyHint}>Добавьте клиента вручную или дождитесь заявки с формы</p>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Имя</th>
              <th style={styles.th}>Телефон</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Компания</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Источник</th>
              <th style={styles.th}>Ссылка</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Webhook</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Статус</th>
              <th style={styles.th}>Дата</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const sc = SOURCE_COLORS[c.source] || SOURCE_COLORS.manual
              return (
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.phone || '—'}</td>
                  <td style={styles.td}>{c.email || '—'}</td>
                  <td style={styles.td}>{c.company || '—'}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
                      {SOURCE_LABELS[c.source] || c.source}
                    </span>
                  </td>
                  <td style={styles.td}>{c.link_title || '—'}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span style={{ color: c.webhook_sent ? '#1e8e3e' : '#d93025', fontWeight: 600 }}>
                      {c.webhook_sent ? '\u2713' : '\u2717'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {c.deal_status_name ? (
                      <span
                        style={{
                          ...styles.badge,
                          ...(c.deal_status_name && c.external_id
                            ? /won|успеш|закрыт.*успеш/i.test(c.deal_status_name)
                              ? { background: '#e6f4ea', color: '#1e8e3e' }
                              : /fail|lose|проиг|отклон|закрыт.*без/i.test(c.deal_status_name)
                                ? { background: '#fce8e6', color: '#d93025' }
                                : { background: '#f1f3f4', color: '#5f6368' }
                            : { background: '#f1f3f4', color: '#5f6368' }),
                        }}
                      >
                        {c.deal_status_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button
          style={skip > 0 ? styles.pageBtn : styles.pageBtnDisabled}
          disabled={skip <= 0}
          onClick={() => onPageChange(Math.max(0, skip - limit))}
        >
          Назад
        </button>
        <span style={styles.pageInfo}>
          {skip + 1} — {skip + clients.length}
        </span>
        <button
          style={clients.length === limit ? styles.pageBtn : styles.pageBtnDisabled}
          disabled={clients.length < limit}
          onClick={() => onPageChange(skip + limit)}
        >
          Далее
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  tableScroll: { overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#5f6368', borderBottom: '2px solid #e8eaed', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #e8eaed' },
  td: { padding: '12px 16px', fontSize: '14px', verticalAlign: 'middle' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 },
  empty: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  emptyText: { fontSize: '18px', fontWeight: 500, marginBottom: '8px' },
  emptyHint: { fontSize: '14px', color: '#5f6368' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '16px', borderTop: '1px solid #e8eaed' },
  pageBtn: { padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' },
  pageBtnDisabled: { padding: '6px 16px', background: '#f1f3f4', color: '#80868b', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'default' },
  pageInfo: { fontSize: '13px', color: '#5f6368' },
}
