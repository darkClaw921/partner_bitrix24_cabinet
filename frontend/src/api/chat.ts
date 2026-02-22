import apiClient from './client'

export interface ChatMessage {
  id: number
  partner_id: number
  sender_id: number
  sender_name: string
  is_from_admin: boolean
  message: string
  file_url: string | null
  file_name: string | null
  is_read: boolean
  created_at: string
}

export interface ChatConversationPreview {
  partner_id: number
  partner_name: string
  partner_email: string
  last_message: string
  last_message_at: string
  unread_count: number
}

// Partner
export async function getPartnerMessages(): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>('/chat/messages')
  return response.data
}

export async function sendPartnerMessage(message: string): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>('/chat/messages', { message })
  return response.data
}

export async function getPartnerUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/chat/unread-count')
  return response.data.count
}

export async function sendPartnerFile(file: File, message?: string): Promise<ChatMessage> {
  const formData = new FormData()
  formData.append('file', file)
  if (message) formData.append('message', message)
  const response = await apiClient.post<ChatMessage>('/chat/messages/file', formData)
  return response.data
}

export async function markPartnerMessagesRead(): Promise<void> {
  await apiClient.post('/chat/read')
}

// Admin
export async function getAdminConversations(): Promise<ChatConversationPreview[]> {
  const response = await apiClient.get<ChatConversationPreview[]>('/admin/chat/conversations')
  return response.data
}

export async function getAdminConversationMessages(partnerId: number): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>(`/admin/chat/conversations/${partnerId}/messages`)
  return response.data
}

export async function sendAdminMessage(partnerId: number, message: string): Promise<ChatMessage> {
  const response = await apiClient.post<ChatMessage>(`/admin/chat/conversations/${partnerId}/messages`, { message })
  return response.data
}

export async function getAdminChatUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/admin/chat/unread-count')
  return response.data.count
}

export async function sendAdminFile(partnerId: number, file: File, message?: string): Promise<ChatMessage> {
  const formData = new FormData()
  formData.append('file', file)
  if (message) formData.append('message', message)
  const response = await apiClient.post<ChatMessage>(`/admin/chat/conversations/${partnerId}/messages/file`, formData)
  return response.data
}

export async function markAdminMessagesRead(partnerId: number): Promise<void> {
  await apiClient.post(`/admin/chat/conversations/${partnerId}/read`)
}
