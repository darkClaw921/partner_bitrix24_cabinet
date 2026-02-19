import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminPartners, togglePartnerActive, type PartnerStats } from '@/api/admin'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerStats[]>([])
  const [loading, setLoading] = useState(true)

  const loadPartners = () => {
    getAdminPartners()
      .then(setPartners)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const handleToggleActive = async (partner: PartnerStats) => {
    const action = partner.is_active ? 'деактивировать' : 'активировать'
    if (!window.confirm(`${partner.is_active ? 'Деактивировать' : 'Активировать'} партнёра «${partner.name}»?\n\n${partner.is_active ? 'Партнёр не сможет войти в систему.' : 'Партнёр снова сможет войти в систему.'}`)) return
    try {
      await togglePartnerActive(partner.id)
      loadPartners()
    } catch (e: any) {
      alert(e?.response?.data?.detail || `Не удалось ${action} партнёра`)
    }
  }

  if (loading) return <div>Загрузка...</div>

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Все партнёры ({partners.length})</h2>
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
            {partners.map((p) => (
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
            {partners.length === 0 && (
              <tr>
                <td colSpan={14} style={{ ...styles.td, textAlign: 'center', color: '#5f6368' }}>
                  Пока нет партнёров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#202124',
    margin: '0 0 16px 0',
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
}
