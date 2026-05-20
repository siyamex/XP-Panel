import { api } from './client'
import type {
  FirewallRule, SecurityEvent, IPBlocklistEntry, SecurityScore,
  CreateFirewallRuleRequest, BlockIPRequest,
} from '@/types/security.types'

export const securityApi = {
  getScore: () =>
    api.get<SecurityScore>('/security/score'),

  listFirewallRules: () =>
    api.get<{ rules: FirewallRule[] }>('/security/firewall'),

  createFirewallRule: (data: CreateFirewallRuleRequest) =>
    api.post<FirewallRule>('/security/firewall', data),

  deleteFirewallRule: (id: string) =>
    api.delete(`/security/firewall/${id}`),

  listEvents: () =>
    api.get<{ events: SecurityEvent[] }>('/security/events'),

  listBlocklist: () =>
    api.get<{ entries: IPBlocklistEntry[] }>('/security/blocklist'),

  blockIP: (data: BlockIPRequest) =>
    api.post<IPBlocklistEntry>('/security/blocklist', data),

  unblockIP: (id: string) =>
    api.delete(`/security/blocklist/${id}`),
}
