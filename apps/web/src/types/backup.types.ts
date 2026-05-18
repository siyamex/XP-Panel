export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed'
export type BackupType = 'full' | 'incremental' | 'database' | 'files'

export interface Backup {
  id: string
  organization_id: string
  schedule_id?: string
  destination_id?: string
  name: string
  type: BackupType
  status: BackupStatus
  size_bytes: number
  storage_path?: string
  encrypted: boolean
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface BackupSchedule {
  id: string
  organization_id: string
  name: string
  cron_expr: string
  destination_id?: string
  type: BackupType
  retain_count: number
  enabled: boolean
  last_run_at?: string
  next_run_at?: string
  created_at: string
}

export interface BackupDestination {
  id: string
  organization_id: string
  name: string
  type: 's3' | 'local' | 'backblaze'
  config: Record<string, unknown>
  created_at: string
}

export interface CreateBackupRequest {
  name?: string
  type: BackupType
  destination_id?: string
}

export interface CreateScheduleRequest {
  name: string
  cron_expr: string
  type?: BackupType
  destination_id?: string
  retain_count?: number
}
