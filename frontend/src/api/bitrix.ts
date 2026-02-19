import apiClient from './client'

export interface BitrixSettings {
  configured: boolean
  api_token?: string
  bitrix24_webhook_url?: string
  entity_type?: string
  deal_category_id?: number
  deal_stage_id?: string
  lead_status_id?: string
}

export interface Funnel {
  ID: string
  TITLE: string
}

export interface Stage {
  STATUS_ID: string
  NAME: string
  SORT?: string
}

export interface LeadStatus {
  STATUS_ID: string
  NAME: string
}

export interface B24Lead {
  id: number
  phone: string
  name: string
  status: string | null
  bitrix24_lead_id: string | null
  created_at: string
}

export interface ConversionStats {
  total: number
  successful: number
  percentage: number
}

export const getBitrixSettings = async (): Promise<BitrixSettings> => {
  const response = await apiClient.get('/bitrix/settings')
  return response.data
}

export const updateBitrixSettings = async (data: {
  entity_type?: string
  deal_category_id?: number
  deal_stage_id?: string
  lead_status_id?: string
}): Promise<unknown> => {
  const response = await apiClient.put('/bitrix/settings', data)
  return response.data
}

export const getBitrixFunnels = async (): Promise<Funnel[]> => {
  const response = await apiClient.get('/bitrix/funnels')
  return response.data
}

export const getBitrixStages = async (categoryId: number = 0): Promise<Stage[]> => {
  const response = await apiClient.get('/bitrix/stages', { params: { category_id: categoryId } })
  return response.data
}

export const getBitrixLeadStatuses = async (): Promise<LeadStatus[]> => {
  const response = await apiClient.get('/bitrix/lead-statuses')
  return response.data
}

export const getBitrixLeads = async (): Promise<B24Lead[]> => {
  const response = await apiClient.get('/bitrix/leads')
  return response.data
}

export const getBitrixConversionStats = async (): Promise<ConversionStats> => {
  const response = await apiClient.get('/bitrix/stats')
  return response.data
}
