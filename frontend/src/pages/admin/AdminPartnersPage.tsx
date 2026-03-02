import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getAdminPartners, togglePartnerActive, type PartnerStats, type PaginatedPartners } from '@/api/admin'

export default function AdminPartnersPage() {
  const [data, setData] = useState<PaginatedPartners>({ items: [], total: 0, page: 1, page_size: 50 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const loadPartners = (s: string, p: number) => {
    setLoading(true)
    getAdminPartners({ search: s || undefined, page: p, page_size: pageSize })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPartners(search, page)
  }, [page])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      loadPartners(value, 1)
    }, 300)
  }

  const handleToggleActive = async (partner: PartnerStats) => {
    const action = partner.is_active ? 'деактивировать' : 'активировать'
    if (!window.confirm(`${partner.is_active ? 'Деактивировать' : 'Активировать'} партнёра «${partner.name}»?\n\n${partner.is_active ? 'Партнёр не сможет войти в систему.' : 'Партнёр снова сможет войти в систему.'}`)) return
    try {
      await togglePartnerActive(partner.id)
      loadPartners(search, page)
    } catch (e: any) {
      alert(e?.response?.data?.detail || `Не удалось ${action} партнёра`)
    }
  }

  const totalPages = Math.ceil(data.total / pageSize)

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Все партнёры ({data.total})</h2>
        <input
          type="text"
          placeholder="Поиск по имени, email, компании..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#5f6368' }}>Загрузка...</div>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Имя</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Компания</th>
                  <th style={styles.th}>Код</th>
                  <th style={styles.th}>Ссылки</th>
                  <th style={styles.th}>Клики</th>
                  <th style={styles.th}>Клиенты</th>
                  <th style={styles.th}>Лендинги</th>
                  <th style={styles.th}>Выплачено</th>
                  <th style={styles.th}>К выплате</th>
                  <th style={styles.th}>% Вознагр.</th>
                  <th style={styles.th}>Статус</th>
                  <th style={styles.th}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.td}>{p.id}</td>
                    <td style={styles.td}>
                      <Link to={`/admin/partners/${p.id}`} style={styles.link}>{p.name}</Link>
                    </td>
                    <td style={styles.td}>{p.email}</td>
                    <td style={styles.td}>{p.company || '—'}</td>
                    <td style={styles.tdCode}>{p.partner_code}</td>
                    <td style={styles.td}>{p.links_count}</td>
                    <td style={styles.td}>{p.clicks_count}</td>
                    <td style={styles.td}>{p.clients_count}</td>
                    <td style={styles.td}>{p.landings_count}</td>
                    <td style={{ ...styles.td, color: '#137333', fontWeight: 500 }}>
                      {p.paid_amount > 0 ? p.paid_amount.toLocaleString('ru-RU') + ' \u20BD' : '—'}
                    </td>
                    <td style={{ ...styles.td, color: '#d93025', fontWeight: 500 }}>
                      {p.unpaid_amount > 0 ? p.unpaid_amount.toLocaleString('ru-RU') + ' \u20BD' : '—'}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500, color: '#1a73e8' }}>
                      {p.reward_percentage != null ? `${p.reward_percentage}%` : <span style={{ color: '#5f6368', fontWeight: 400 }}>глоб.</span>}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          background: p.is_active ? '#e6f4ea' : '#fce8e6',
                          color: p.is_active ? '#137333' : '#d93025',
                          cursor: 'pointer',
                        }}
                        title={p.is_active ? 'Нажмите чтобы деактивировать' : 'Нажмите чтобы активировать'}
                        onClick={() => handleToggleActive(p)}
                      >
                        {p.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td style={styles.td}>{new Date(p.created_at).toLocaleDateString('ru-RU')}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ ...styles.td, textAlign: 'center', color: '#5f6368' }}>
                      {search ? 'Ничего не найдено' : 'Пока нет партнёров'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                style={{ ...styles.pageBtn, ...(page <= 1 ? styles.pageBtnDisabled : {}) }}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                &larr; Назад
              </button>
              <span style={styles.pageInfo}>
                {page} / {totalPages}
              </span>
              <button
                style={{ ...styles.pageBtn, ...(page >= totalPages ? styles.pageBtnDisabled : {}) }}
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Вперёд &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    padding: '24px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#202124',
    margin: 0,
  },
  searchInput: {
    padding: '8px 14px',
    border: '1px solid #dadce0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    width: '300px',
    maxWidth: '100%',
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
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#202124',
    borderBottom: '1px solid #e8eaed',
  },
  tdCode: {
    padding: '12px',
    fontSize: '13px',
    color: '#202124',
    borderBottom: '1px solid #e8eaed',
    fontFamily: 'monospace',
  },
  link: {
    color: '#1a73e8',
    textDecoration: 'none',
    fontWeight: 500,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e8eaed',
  },
  pageBtn: {
    padding: '6px 16px',
    background: '#fff',
    color: '#1a73e8',
    border: '1px solid #dadce0',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  pageBtnDisabled: {
    color: '#dadce0',
    cursor: 'default',
  },
  pageInfo: {
    fontSize: '13px',
    color: '#5f6368',
  },
}
