import apiClient from './client'

export interface PartnerStats {
  id: number
  email: string
  name: string
  company: string | null
  partner_code: string
  created_at: string
  is_active: boolean
  links_count: number
  clicks_count: number
  clients_count: number
  landings_count: number
  paid_amount: number
  unpaid_amount: number
  reward_percentage: number | null
}

export interface AdminOverview {
  total_partners: number
  total_links: number
  total_clicks: number
  total_clients: number
  total_landings: number
  total_paid_amount: number
  total_unpaid_amount: number
  partners: PartnerStats[]
}

export interface AdminPartnerClient {
  id: number
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: string
  deal_amount: number | null
  partner_reward: number | null
  is_paid: boolean
  paid_at: string | null
  payment_comment: string | null
  created_at: string | null
}

export interface AdminPartnerDetail {
  id: number
  email: string
  name: string
  company: string | null
  partner_code: string
  role: string
  created_at: string
  is_active: boolean
  workflow_id: number | null
  reward_percentage: number | null
  effective_reward_percentage: number
  links_count: number
  clicks_count: number
  clients_count: number
  landings_count: number
  links: Array<{
    id: number
    title: string
    link_type: string
    link_code: string
    target_url: string
    is_active: boolean
    created_at: string | null
  }>
  clients: AdminPartnerClient[]
}

export interface ClientPaymentUpdate {
  deal_amount?: number | null
  partner_reward?: number | null
  is_paid?: boolean | null
  payment_comment?: string | null
}

export interface BulkClientPaymentUpdate {
  client_ids: number[]
  deal_amount?: number | null
  partner_reward?: number | null
  is_paid?: boolean | null
  payment_comment?: string | null
}

export interface PartnerPaymentSummary {
  partner_id: number
  partner_name: string
  total_deal_amount: number
  total_reward: number
  paid_amount: number
  unpaid_amount: number
  clients: AdminPartnerClient[]
}

export interface AdminConfig {
  b24_service_frontend_url: string
  default_reward_percentage: number
}

export interface AdminNotification {
  id: number
  title: string
  message: string
  created_by: number
  created_at: string
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await apiClient.get<AdminOverview>('/admin/overview')
  return response.data
}

export async function getAdminPartners(): Promise<PartnerStats[]> {
  const response = await apiClient.get<PartnerStats[]>('/admin/partners')
  return response.data
}

export async function getAdminPartnerDetail(id: number): Promise<AdminPartnerDetail> {
  const response = await apiClient.get<AdminPartnerDetail>(`/admin/partners/${id}`)
  return response.data
}

export async function updateClientPayment(clientId: number, data: ClientPaymentUpdate): Promise<void> {
  await apiClient.put(`/admin/clients/${clientId}/payment`, data)
}

export async function bulkUpdateClientPayment(data: BulkClientPaymentUpdate): Promise<void> {
  await apiClient.put('/admin/clients/bulk-payment', data)
}

export async function getPartnerPaymentSummary(partnerId: number): Promise<PartnerPaymentSummary> {
  const response = await apiClient.get<PartnerPaymentSummary>(`/admin/partners/${partnerId}/payments`)
  return response.data
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const response = await apiClient.get<AdminConfig>('/admin/config')
  return response.data
}

export async function updatePartnerRewardPercentage(
  partnerId: number,
  rewardPercentage: number | null
): Promise<{ id: number; reward_percentage: number | null; effective_reward_percentage: number }> {
  const response = await apiClient.put(`/admin/partners/${partnerId}/reward-percentage`, {
    reward_percentage: rewardPercentage,
  })
  return response.data
}

export async function togglePartnerActive(
  partnerId: number
): Promise<{ ok: boolean; id: number; is_active: boolean }> {
  const response = await apiClient.put(`/admin/partners/${partnerId}/toggle-active`)
  return response.data
}

export async function getGlobalRewardPercentage(): Promise<{ default_reward_percentage: number }> {
  const response = await apiClient.get('/admin/reward-percentage')
  return response.data
}

export async function updateGlobalRewardPercentage(
  percentage: number
): Promise<{ default_reward_percentage: number }> {
  const response = await apiClient.put('/admin/reward-percentage', {
    default_reward_percentage: percentage,
  })
  return response.data
}

export async function createNotification(data: { title: string; message: string }): Promise<AdminNotification> {
  const response = await apiClient.post<AdminNotification>('/admin/notifications', data)
  return response.data
}

export async function getAdminNotifications(): Promise<{ notifications: AdminNotification[] }> {
  const response = await apiClient.get<{ notifications: AdminNotification[] }>('/admin/notifications')
  return response.data
}

export async function deleteNotification(id: number): Promise<void> {
  await apiClient.delete(`/admin/notifications/${id}`)
}

export interface RegistrationRequest {
  id: number
  email: string
  name: string
  company: string | null
  partner_code: string
  created_at: string
  approval_status: string
}

export async function getPendingRegistrations(): Promise<RegistrationRequest[]> {
  const response = await apiClient.get<RegistrationRequest[]>('/admin/registrations')
  return response.data
}

export async function getPendingRegistrationsCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/admin/registrations/count')
  return response.data.count
}

export async function approveRegistration(partnerId: number): Promise<void> {
  await apiClient.post(`/admin/registrations/${partnerId}/approve`)
}

export async function rejectRegistration(partnerId: number, rejectionReason?: string): Promise<void> {
  await apiClient.post(`/admin/registrations/${partnerId}/reject`, {
    rejection_reason: rejectionReason || null,
  })
}
