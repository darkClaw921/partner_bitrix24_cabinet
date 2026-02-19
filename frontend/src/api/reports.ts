import apiClient from './client'

export interface PartnerReportMetrics {
  total_leads: number
  total_sales: number
  total_deal_amount: number
  total_commission: number
  paid_commission: number
  unpaid_commission: number
  leads_in_progress: number
  total_clicks: number
  payment_requests_total: number
  payment_requests_approved: number
  payment_requests_rejected: number
  payment_requests_pending: number
  payment_requests_amount: number
}

export interface PartnerReportResponse {
  partner_id: number
  partner_name: string
  partner_email: string
  date_from: string | null
  date_to: string | null
  metrics: PartnerReportMetrics
  clients: Array<{
    name: string
    email: string | null
    phone: string | null
    deal_amount: number | null
    partner_reward: number | null
    is_paid: boolean
    deal_status: string
    created_at: string
  }>
}

export interface AllPartnersReportRow {
  partner_id: number
  partner_name: string
  partner_email: string
  metrics: PartnerReportMetrics
}

export interface AllPartnersReportResponse {
  date_from: string | null
  date_to: string | null
  totals: PartnerReportMetrics
  partners: AllPartnersReportRow[]
}

interface ReportParams {
  date_from?: string
  date_to?: string
}

interface AdminReportParams extends ReportParams {
  partner_id?: number
}

export async function getPartnerReport(params: ReportParams): Promise<PartnerReportResponse> {
  const response = await apiClient.get<PartnerReportResponse>('/reports', { params })
  return response.data
}

export async function downloadPartnerReportPDF(params: ReportParams): Promise<void> {
  const response = await apiClient.get('/reports/pdf', {
    params,
    responseType: 'blob',
  })
  downloadBlob(response.data, 'report.pdf')
}

export async function getAdminReport(params: AdminReportParams): Promise<AllPartnersReportResponse> {
  const response = await apiClient.get<AllPartnersReportResponse>('/admin/reports', { params })
  return response.data
}

export async function downloadAdminReportPDF(params: AdminReportParams): Promise<void> {
  const response = await apiClient.get('/admin/reports/pdf', {
    params,
    responseType: 'blob',
  })
  downloadBlob(response.data, 'report.pdf')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
