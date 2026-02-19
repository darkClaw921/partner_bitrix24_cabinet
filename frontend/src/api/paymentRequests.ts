import apiClient from './client'

export interface PaymentRequestResponse {
  id: number
  partner_id: number
  partner_name: string | null
  status: string
  total_amount: number
  client_ids: number[]
  clients_summary: {
    id: number
    name: string
    email: string | null
    phone: string | null
    deal_amount: number | null
    partner_reward: number | null
  }[]
  comment: string | null
  admin_comment: string | null
  created_at: string
  processed_at: string | null
  processed_by: number | null
}

export interface CreatePaymentRequest {
  client_ids: number[]
  comment?: string
}

export interface AdminAction {
  status: 'approved' | 'rejected'
  admin_comment?: string
}

// Partner
export async function createPaymentRequest(data: CreatePaymentRequest): Promise<PaymentRequestResponse> {
  const response = await apiClient.post<PaymentRequestResponse>('/payment-requests/', data)
  return response.data
}

export async function getPartnerPaymentRequests(): Promise<PaymentRequestResponse[]> {
  const response = await apiClient.get<PaymentRequestResponse[]>('/payment-requests/')
  return response.data
}

export async function getPartnerPaymentRequest(id: number): Promise<PaymentRequestResponse> {
  const response = await apiClient.get<PaymentRequestResponse>(`/payment-requests/${id}`)
  return response.data
}

// Admin
export async function getAdminPaymentRequests(status?: string): Promise<PaymentRequestResponse[]> {
  const params = status ? { status } : {}
  const response = await apiClient.get<PaymentRequestResponse[]>('/admin/payment-requests', { params })
  return response.data
}

export async function getAdminPaymentRequest(id: number): Promise<PaymentRequestResponse> {
  const response = await apiClient.get<PaymentRequestResponse>(`/admin/payment-requests/${id}`)
  return response.data
}

export async function processPaymentRequest(id: number, action: AdminAction): Promise<PaymentRequestResponse> {
  const response = await apiClient.put<PaymentRequestResponse>(`/admin/payment-requests/${id}`, action)
  return response.data
}

export async function getPendingCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/admin/payment-requests/pending-count')
  return response.data.count
}
