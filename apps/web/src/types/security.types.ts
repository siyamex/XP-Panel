export interface FirewallRule {
  id: string
  organization_id: string
  server_id?: string
  chain: 'INPUT' | 'OUTPUT' | 'FORWARD'
  action: 'ACCEPT' | 'DROP' | 'REJECT'
  protocol?: string
  source_ip?: string
  dest_ip?: string
  port_range?: string
  priority: number
  enabled: boolean
  comment?: string
  created_at: string
}

export interface SecurityEvent {
  id: string
  organization_id?: string
  server_id?: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  source_ip?: string
  source_country?: string
  target?: string
  details: Record<string, unknown>
  mitigated: boolean
  created_at: string
}

export interface IPBlocklistEntry {
  id: string
  organization_id: string
  ip: string
  reason?: string
  expires_at?: string
  created_at: string
}

export interface SecurityScore {
  score: number
  max_score: number
  grade: string
  checks: SecurityCheck[]
}

export interface SecurityCheck {
  name: string
  passed: boolean
  message: string
  weight: number
}

export interface CreateFirewallRuleRequest {
  chain?: 'INPUT' | 'OUTPUT' | 'FORWARD'
  action: 'ACCEPT' | 'DROP' | 'REJECT'
  protocol?: string
  source_ip?: string
  dest_ip?: string
  port_range?: string
  priority?: number
  comment?: string
}

export interface BlockIPRequest {
  ip: string
  reason?: string
}
