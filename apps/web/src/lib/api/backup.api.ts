import { api } from './client'
import type {
  Backup, BackupSchedule, BackupDestination,
  CreateBackupRequest, CreateScheduleRequest,
} from '@/types/backup.types'

// Gateway routes: /api/v1/backups/* → backup service

export const backupApi = {
  listBackups: () =>
    api.get<{ backups: Backup[]; total: number }>('/backups'),

  createBackup: (data: CreateBackupRequest) =>
    api.post<Backup>('/backups', data),

  deleteBackup: (id: string) =>
    api.delete(`/backups/${id}`),

  restoreBackup: (id: string) =>
    api.post(`/backups/${id}/restore`),

  listSchedules: () =>
    api.get<{ schedules: BackupSchedule[] }>('/backups/schedules'),

  createSchedule: (data: CreateScheduleRequest) =>
    api.post<BackupSchedule>('/backups/schedules', data),

  deleteSchedule: (id: string) =>
    api.delete(`/backups/schedules/${id}`),

  listDestinations: () =>
    api.get<{ destinations: BackupDestination[] }>('/backups/destinations'),

  createDestination: (data: Partial<BackupDestination>) =>
    api.post<BackupDestination>('/backups/destinations', data),

  deleteDestination: (id: string) =>
    api.delete(`/backups/destinations/${id}`),
}
