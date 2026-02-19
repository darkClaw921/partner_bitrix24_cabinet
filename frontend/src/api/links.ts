import apiClient from './client'

export type LinkType = 'direct' | 'iframe' | 'landing'

export interface Link {
  id: number
  partner_id: number
  title: string
  link_type: LinkType
  link_code: string
  target_url: string | null
  landing_id: number | null
  is_active: boolean
  created_at: string
  clicks_count: number
  clients_count: number
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
}

export interface CreateLinkData {
  title: string
  link_type: LinkType
  target_url?: string
  landing_id?: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export interface UpdateLinkData {
  title?: string
  target_url?: string
  landing_id?: number
  is_active?: boolean
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export interface EmbedCode {
  link_type: string
  link_code: string
  direct_url: string
  redirect_url_with_utm: string | null
  iframe_code: string | null
  landing_url: string | null
}

export async function getLinks(): Promise<Link[]> {
  const response = await apiClient.get<Link[]>('/links/')
  return response.data
}

export async function getLink(id: number): Promise<Link> {
  const response = await apiClient.get<Link>(`/links/${id}`)
  return response.data
}

export async function createLink(data: CreateLinkData): Promise<Link> {
  const response = await apiClient.post<Link>('/links/', data)
  return response.data
}

export async function updateLink(id: number, data: UpdateLinkData): Promise<Link> {
  const response = await apiClient.put<Link>(`/links/${id}`, data)
  return response.data
}

export async function deleteLink(id: number): Promise<void> {
  await apiClient.delete(`/links/${id}`)
}

export async function getEmbedCode(id: number): Promise<EmbedCode> {
  const response = await apiClient.get<EmbedCode>(`/links/${id}/embed-code`)
  return response.data
}
