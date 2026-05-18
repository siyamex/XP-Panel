import { api } from './client'
import type {
  FirewallRule, SecurityEvent, IPBlocklistEntry, SecurityScore,
  CreateFirewallRuleRequest, BlockIPRequest,
} from '@/types/security.types'

export const securityApi = {
  getScore: () =>
    api.get<SecurityScore>('/security/security/score'),

  listFirewallRules: () =>
    api.get<{ rules: FirewallRule[] }>('/security/security/firewall'),

  createFirewallRule: (data: CreateFirewallRuleRequest) =>
    api.post<FirewallRule>('/security/security/firewall', data),

  deleteFirewallRule: (id: string) =>
    api.delete(`/security/security/firewall/${id}`),

  listEvents: () =>
    api.get<{ events: SecurityEvent[] }>('/security/security/events'),

  listBlocklist: () =>
    api.get<{ entries: IPBlocklistEntry[] }>('/security/security/blocklist'),

  blockIP: (data: BlockIPRequest) =>
    api.post<IPBlocklistEntry>('/security/security/blocklist', data),

  unblockIP: (id: string) =>
    api.delete(`/security/security/blocklist/${id}`),
}
