import apiClient from './client'

export interface Summary {
  total_clicks: number
  total_clients: number
  conversion_rate: number
  clicks_today: number
  clients_today: number
}

export interface LinkStats {
  link_id: number
  title: string
  link_type: string
  link_code: string
  clicks_count: number
  clients_count: number
  conversion_rate: number
}

export interface DailyClicks {
  date: string
  clicks: number
}

export interface ClientStats {
  date: string
  form_count: number
  manual_count: number
  total: number
}

export interface BitrixClient {
  name: string
  external_id: string
  status: string
  stage: string
  deal_amount: number
  currency: string
  created_at: string
  assigned_by_name?: string
  status_semantic_id?: string
}

export interface BitrixStats {
  success: boolean
  clients: BitrixClient[]
  total_amount: number
  total_clients: number
  error?: string
  conversion?: {
    total: number
    successful: number
    percentage: number
  }
}

export const getSummary = async (): Promise<Summary> => {
  const response = await apiClient.get('/analytics/summary')
  return response.data
}

export const getLinksStats = async (): Promise<LinkStats[]> => {
  const response = await apiClient.get('/analytics/links')
  return response.data
}

export const getLinkClicks = async (linkId: number, days: number = 30): Promise<DailyClicks[]> => {
  const response = await apiClient.get(`/analytics/links/${linkId}/clicks`, {
    params: { days },
  })
  return response.data
}

export const getClientsStats = async (days: number = 30): Promise<ClientStats[]> => {
  const response = await apiClient.get('/analytics/clients/stats', {
    params: { days },
  })
  return response.data
}

export const fetchBitrixStats = async (): Promise<BitrixStats> => {
  const response = await apiClient.post('/analytics/bitrix/fetch')
  return response.data
}
