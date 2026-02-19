import apiClient from './client'

export interface Client {
  id: number
  partner_id: number
  link_id: number | null
  source: 'form' | 'manual'
  name: string
  phone: string | null
  email: string | null
  company: string | null
  comment: string | null
  external_id: string | null
  webhook_sent: boolean
  deal_amount: number | null
  partner_reward: number | null
  is_paid: boolean
  deal_status: string | null
  deal_status_name: string | null
  created_at: string
  link_title: string | null
}

export interface CreateClientData {
  name: string
  phone?: string
  email?: string
  company?: string
  comment?: string
  link_id?: number
}

export async function getClients(skip = 0, limit = 50): Promise<Client[]> {
  const response = await apiClient.get<Client[]>('/clients/', {
    params: { skip, limit },
  })
  return response.data
}

export async function getClient(id: number): Promise<Client> {
  const response = await apiClient.get<Client>(`/clients/${id}`)
  return response.data
}

export async function createClient(data: CreateClientData): Promise<Client> {
  const response = await apiClient.post<Client>('/clients/', data)
  return response.data
}
