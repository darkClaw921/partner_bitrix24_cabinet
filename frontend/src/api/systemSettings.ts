import apiClient from './client'

export interface TrackingConfig {
  lead_field: string
  deal_field: string
  value_template: string
  field_type: string
}

export interface SyncConfig {
  enabled: boolean
  interval_minutes: number
  last_run: string | null
}

export interface SystemSettings {
  partner_tracking_lead_field: string
  partner_tracking_deal_field: string
  partner_tracking_value_template: string
  partner_tracking_field_type: string
  b24_sync_enabled: string
  b24_sync_interval_minutes: string
  b24_sync_last_run: string
  default_partner_links?: string
}

export interface DefaultLinkConfig {
  title: string
  url: string
  enabled: boolean
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
}

export async function getSettings(): Promise<SystemSettings> {
  const response = await apiClient.get<{ settings: SystemSettings }>('/admin/settings')
  return response.data.settings
}

export async function updateTrackingSettings(config: Partial<TrackingConfig>): Promise<void> {
  await apiClient.put('/admin/settings/tracking', config)
}

export async function updateSyncSettings(config: Partial<SyncConfig>): Promise<void> {
  await apiClient.put('/admin/settings/sync', config)
}

export async function triggerSync(): Promise<void> {
  await apiClient.post('/admin/settings/sync/run-now')
}

export async function getDefaultLinksSettings(): Promise<DefaultLinkConfig[]> {
  const response = await apiClient.get<{ links: DefaultLinkConfig[] }>('/admin/settings/default-links')
  return response.data.links
}

export async function updateDefaultLinksSettings(links: DefaultLinkConfig[]): Promise<void> {
  await apiClient.put('/admin/settings/default-links', { links })
}
