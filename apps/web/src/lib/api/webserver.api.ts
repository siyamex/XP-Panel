import { api } from './client'

export interface Vhost {
  id: string
  organization_id: string
  domain_name: string
  server_type: 'nginx' | 'apache' | 'caddy' | 'litespeed'
  document_root: string
  php_version: string | null
  ssl_enabled: boolean
  ssl_cert_path?: string
  ssl_key_path?: string
  status: 'active' | 'disabled' | 'error'
  created_at: string
  updated_at: string
}

export interface SSLCert {
  id: string
  organization_id: string
  domain: string
  provider: 'letsencrypt' | 'custom' | 'self-signed'
  status: 'active' | 'pending' | 'expired' | 'error'
  expires_at: string | null
  created_at: string
}

export interface CreateVhostRequest {
  domain_name: string
  server_type: string
  document_root: string
  php_version?: string
}

export interface UpdateVhostRequest {
  server_type?: string
  php_version?: string | null
}

export const webserverApi = {
  listVhosts: () =>
    api.get<{ vhosts: Vhost[]; total: number }>('/webserver/vhosts'),

  getVhost: (id: string) =>
    api.get<Vhost>(`/webserver/vhosts/${id}`),

  createVhost: (data: CreateVhostRequest) =>
    api.post<Vhost>('/webserver/vhosts', data),

  updateVhost: (id: string, data: UpdateVhostRequest) =>
    api.put<{ message: string }>(`/webserver/vhosts/${id}`, data),

  deleteVhost: (id: string) =>
    api.delete(`/webserver/vhosts/${id}`),

  listSSL: () =>
    api.get<{ certs: SSLCert[]; total: number }>('/webserver/ssl'),

  getSSL: (id: string) =>
    api.get<SSLCert>(`/webserver/ssl/${id}`),

  issueSSL: (req: { domain: string; sans?: string[]; email: string; auto_renew?: boolean; webroot?: string }) =>
    api.post<SSLCert>('/webserver/ssl/issue', req),

  renewSSL: (id: string) =>
    api.post<SSLCert>(`/webserver/ssl/renew/${id}`),

  deleteSSL: (id: string) =>
    api.delete(`/webserver/ssl/${id}`),

  toggleAutoRenew: (id: string, auto_renew: boolean) =>
    api.put<{ auto_renew: boolean }>(`/webserver/ssl/${id}/auto-renew`, { auto_renew }),

  listPHPVersions: () =>
    api.get<{ versions: string[] }>('/webserver/php'),

  updatePHP: (vhostId: string, php_version: string | null) =>
    api.put<{ message: string }>(`/webserver/php/${vhostId}`, { php_version }),

  getPHPIni: (vhostId: string) =>
    api.get<{ settings: Record<string, string> }>(`/webserver/php/${vhostId}/ini`),

  updatePHPIni: (vhostId: string, settings: Record<string, string>) =>
    api.put<{ updated: boolean }>(`/webserver/php/${vhostId}/ini`, settings),

  getOPcacheStatus: (vhostId: string) =>
    api.get<{
      enabled: boolean
      cache_full: boolean
      memory_usage: { used_memory: number; free_memory: number; wasted_memory: number; current_wasted_percentage: number }
      statistics: { num_cached_scripts: number; hits: number; misses: number; opcache_hit_rate: number }
    }>(`/webserver/php/${vhostId}/opcache`),

  resetOPcache: (vhostId: string) =>
    api.post<{ reset: boolean; message: string }>(`/webserver/php/${vhostId}/opcache/reset`, {}),
}
