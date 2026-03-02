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
