import { api } from './client'
import type {
  Backup, BackupSchedule, BackupDestination,
  CreateBackupRequest, CreateScheduleRequest,
} from '@/types/backup.types'

export const backupApi = {
  listBackups: () =>
    api.get<{ backups: Backup[]; total: number }>('/backup/backups'),

  createBackup: (data: CreateBackupRequest) =>
    api.post<Backup>('/backup/backups', data),

  deleteBackup: (id: string) =>
    api.delete(`/backup/backups/${id}`),

  listSchedules: () =>
    api.get<{ schedules: BackupSchedule[] }>('/backup/backups/schedules'),

  createSchedule: (data: CreateScheduleRequest) =>
    api.post<BackupSchedule>('/backup/backups/schedules', data),

  deleteSchedule: (id: string) =>
    api.delete(`/backup/backups/schedules/${id}`),
}
