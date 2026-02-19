import { useState, useEffect, useCallback } from 'react'
import { getClients, type Client } from '@/api/clients'
import CrmForm from '@/components/CrmForm'
import ClientsTable from '@/components/ClientsTable'

const LIMIT = 50

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [skip, setSkip] = useState(0)

  const fetchClients = useCallback(async (offset: number) => {
    try {
      setError('')
      const data = await getClients(offset, LIMIT)
      setClients(data)
    } catch {
      setError('Не удалось загрузить клиентов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients(skip)
  }, [skip, fetchClients])

  const handleCreated = () => {
    setSkip(0)
    fetchClients(0)
  }

  const handlePageChange = (newSkip: number) => {
    setSkip(newSkip)
  }

  if (loading) {
    return <div style={styles.page}><div style={styles.loader}>Загрузка...</div></div>
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Клиенты</h1>

      <CrmForm onCreated={handleCreated} />

      {error && <div style={styles.error}>{error}</div>}

      <ClientsTable
        clients={clients}
        skip={skip}
        limit={LIMIT}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  title: { fontSize: '24px', fontWeight: 600, marginBottom: '24px' },
  loader: { textAlign: 'center', padding: '60px 0', color: '#5f6368', fontSize: '16px' },
  error: { background: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
}
