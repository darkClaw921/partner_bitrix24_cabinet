import apiClient from './client'

export interface RegisterData {
  email: string
  password: string
  name: string
  company?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface SavedPaymentMethod {
  id: string
  label: string
  value: string
}

export interface Partner {
  id: number
  email: string
  name: string
  company: string | null
  partner_code: string
  role: string
  created_at: string
  is_active: boolean
  approval_status: string
  saved_payment_methods: SavedPaymentMethod[]
}

export async function register(data: RegisterData): Promise<Partner> {
  const response = await apiClient.post<Partner>('/auth/register', data)
  return response.data
}

export async function login(data: LoginData): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/login', data)
  localStorage.setItem('accessToken', response.data.access_token)
  localStorage.setItem('refreshToken', response.data.refresh_token)
  return response.data
}

export async function refresh(): Promise<TokenResponse> {
  const refreshToken = localStorage.getItem('refreshToken')
  const response = await apiClient.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  localStorage.setItem('accessToken', response.data.access_token)
  localStorage.setItem('refreshToken', response.data.refresh_token)
  return response.data
}

export async function getMe(): Promise<Partner> {
  const response = await apiClient.get<Partner>('/auth/me')
  return response.data
}

export function logout(): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

export async function addPaymentMethod(label: string, value: string): Promise<Partner> {
  const response = await apiClient.post<Partner>('/auth/payment-methods', { label, value })
  return response.data
}

export async function deletePaymentMethod(methodId: string): Promise<Partner> {
  const response = await apiClient.delete<Partner>(`/auth/payment-methods/${methodId}`)
  return response.data
}
