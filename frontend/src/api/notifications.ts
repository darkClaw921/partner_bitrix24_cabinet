import apiClient from './client'

export interface PartnerNotification {
  id: number
  title: string
  message: string
  created_at: string
  is_read: boolean
}

export async function getNotifications(): Promise<{ notifications: PartnerNotification[] }> {
  const response = await apiClient.get<{ notifications: PartnerNotification[] }>('/notifications/')
  return response.data
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const response = await apiClient.get<{ count: number }>('/notifications/unread-count')
  return response.data
}

export async function markAsRead(id: number): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`)
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all')
}
