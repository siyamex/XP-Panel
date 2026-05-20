import { api } from './client'
import type { ServerMetrics, AlertRule, Incident, CreateAlertRuleRequest } from '@/types/monitoring.types'

export interface MonitoredServer {
  id: string
  hostname: string
  ip_address: string | null
  agent_version: string | null
  last_seen_at: string | null
  status: 'active' | 'offline' | 'disabled'
  created_at: string
}

export interface MetricPoint {
  t: string
  cpu: number
  ram: number
  disk: number
  net_in: number
  net_out: number
  load: number
  procs: number
}

export const monitoringApi = {
  getCurrentMetrics: (serverId?: string) =>
    api.get<ServerMetrics>(`/monitoring/metrics/current${serverId ? `?server_id=${serverId}` : ''}`),

  // Managed servers
  listServers: () =>
    api.get<{ servers: MonitoredServer[]; total: number }>('/monitoring/servers'),
  registerServer: (d: { hostname: string; ip_address?: string }) =>
    api.post<{ id: string; api_key: string; note: string }>('/monitoring/servers', d),
  deleteServer: (id: string) => api.delete(`/monitoring/servers/${id}`),
  getServerMetrics: (id: string, period?: string) =>
    api.get<{ server_id: string; period: string; points: MetricPoint[]; total: number }>(
      `/monitoring/servers/${id}/metrics`, { params: { period } }),

  listAlertRules: () =>
    api.get<{ rules: AlertRule[] }>('/monitoring/alerts/rules'),
  createAlertRule: (data: CreateAlertRuleRequest) =>
    api.post<AlertRule>('/monitoring/alerts/rules', data),
  deleteAlertRule: (id: string) =>
    api.delete(`/monitoring/alerts/rules/${id}`),

  listIncidents: () =>
    api.get<{ incidents: Incident[] }>('/monitoring/incidents'),
  acknowledgeIncident: (id: string) =>
    api.put(`/monitoring/incidents/${id}/acknowledge`, {}),
  resolveIncident: (id: string) =>
    api.put(`/monitoring/incidents/${id}/resolve`, {}),
}
