import { api } from './client'

export interface CronJob {
  id: string
  org_id: string
  user_id: string
  domain?: string
  label: string
  command: string
  schedule: string
  minute: string
  hour: string
  day_month: string
  month: string
  day_week: string
  enabled: boolean
  last_run_at?: string
  last_status?: string
  created_at: string
}

export const cronApi = {
  list: () => api.get<{ jobs: CronJob[]; total: number }>('/webserver/cron'),
  create: (d: Omit<CronJob, 'id' | 'org_id' | 'user_id' | 'schedule' | 'created_at' | 'enabled' | 'last_run_at' | 'last_status'>) =>
    api.post<{ id: string }>('/webserver/cron', d),
  update: (id: string, d: Partial<CronJob>) => api.put(`/webserver/cron/${id}`, d),
  delete: (id: string) => api.delete(`/webserver/cron/${id}`),
  toggle: (id: string) => api.post(`/webserver/cron/${id}/toggle`, {}),
}
