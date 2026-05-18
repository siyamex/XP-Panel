import { api } from './client'
import type { ServerMetrics, AlertRule, Incident, CreateAlertRuleRequest } from '@/types/monitoring.types'

export const monitoringApi = {
  getCurrentMetrics: (serverId?: string) =>
    api.get<ServerMetrics>(`/monitoring/metrics/current${serverId ? `?server_id=${serverId}` : ''}`),

  listAlertRules: () =>
    api.get<{ rules: AlertRule[] }>('/monitoring/alerts/rules'),

  createAlertRule: (data: CreateAlertRuleRequest) =>
    api.post<AlertRule>('/monitoring/alerts/rules', data),

  deleteAlertRule: (id: string) =>
    api.delete(`/monitoring/alerts/rules/${id}`),

  listIncidents: () =>
    api.get<{ incidents: Incident[] }>('/monitoring/incidents'),
}
