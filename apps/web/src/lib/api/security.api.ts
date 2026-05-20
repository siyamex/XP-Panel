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

  listGeoIPBlocks: () =>
    api.get<{
      blocks: Array<{ id: string; country_code: string; country_name: string; action: string; created_at: string }>
      total: number
    }>('/security/geoip'),

  addGeoIPBlock: (data: { country_code: string; country_name: string; action?: 'block' | 'log' }) =>
    api.post<{ id: string }>('/security/geoip', data),

  removeGeoIPBlock: (countryCode: string) =>
    api.delete(`/security/geoip/${countryCode}`),

  lookupGeoIP: (ip: string) =>
    api.get<{
      ip: string
      country_code: string
      country_name: string
      city: string
      region: string
      org: string
      latitude: number
      longitude: number
    }>(`/security/geoip/lookup?ip=${encodeURIComponent(ip)}`),
}
