export interface ServerMetrics {
  server_id: string
  timestamp: string
  cpu_percent: number
  ram_percent: number
  disk_percent: number
  net_in_mb_s: number
  net_out_mb_s: number
  load_avg_1: number
  load_avg_5: number
  load_avg_15: number
  processes: number
  ram_total_mb: number
  ram_used_mb: number
  disk_total_mb: number
  disk_used_mb: number
  uptime: number
}

export interface AlertRule {
  id: string
  organization_id: string
  server_id?: string
  name: string
  metric: string
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  threshold: number
  duration_seconds: number
  severity: 'info' | 'warning' | 'critical'
  channels: string[]
  enabled: boolean
  created_at: string
}

export interface Incident {
  id: string
  organization_id: string
  alert_rule_id?: string
  server_id?: string
  title: string
  status: 'open' | 'acknowledged' | 'resolved'
  severity: 'info' | 'warning' | 'critical'
  metric?: string
  value?: number
  threshold?: number
  started_at: string
  resolved_at?: string
  acknowledged_at?: string
}

export interface CreateAlertRuleRequest {
  server_id?: string
  name: string
  metric: string
  condition: string
  threshold: number
  duration_seconds?: number
  severity?: string
  channels?: string[]
}

export const METRIC_OPTIONS = [
  { value: 'cpu_percent', label: 'CPU Usage (%)' },
  { value: 'ram_percent', label: 'RAM Usage (%)' },
  { value: 'disk_percent', label: 'Disk Usage (%)' },
  { value: 'load_avg_1', label: 'Load Average (1m)' },
  { value: 'net_in_mb_s', label: 'Network In (MB/s)' },
  { value: 'net_out_mb_s', label: 'Network Out (MB/s)' },
]

export const CONDITION_OPTIONS = [
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'Greater than or equal (≥)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'Less than or equal (≤)' },
  { value: 'eq', label: 'Equal to (=)' },
]
