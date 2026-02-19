import apiClient from './client'

export interface LandingImage {
  id: number
  file_path: string
  sort_order: number
  url: string
}

export interface Landing {
  id: number
  partner_id: number
  title: string
  description: string
  header_text: string
  button_text: string
  theme_color: string
  is_active: boolean
  created_at: string
  images: LandingImage[]
}

export interface CreateLandingData {
  title: string
  description: string
  header_text: string
  button_text?: string
  theme_color?: string
}

export interface UpdateLandingData {
  title?: string
  description?: string
  header_text?: string
  button_text?: string
  theme_color?: string
  is_active?: boolean
}

export async function getLandings(): Promise<Landing[]> {
  const response = await apiClient.get<Landing[]>('/landings/')
  return response.data
}

export async function getLanding(id: number): Promise<Landing> {
  const response = await apiClient.get<Landing>(`/landings/${id}`)
  return response.data
}

export async function createLanding(data: CreateLandingData): Promise<Landing> {
  const response = await apiClient.post<Landing>('/landings/', data)
  return response.data
}

export async function updateLanding(id: number, data: UpdateLandingData): Promise<Landing> {
  const response = await apiClient.put<Landing>(`/landings/${id}`, data)
  return response.data
}

export async function deleteLanding(id: number): Promise<void> {
  await apiClient.delete(`/landings/${id}`)
}

export async function uploadImage(landingId: number, file: File): Promise<LandingImage> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post<LandingImage>(
    `/landings/${landingId}/images`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function deleteImage(landingId: number, imageId: number): Promise<void> {
  await apiClient.delete(`/landings/${landingId}/images/${imageId}`)
}
