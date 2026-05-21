import { api } from './client'
import type { Domain, CreateDomainRequest, SSLCertificate, VHost, PHPConfig } from '@/types/domain.types'

export const domainsApi = {
  list: () =>
    api.get<{ domains: Domain[]; total: number }>('/domains'),

  get: (id: string) =>
    api.get<Domain>(`/domains/${id}`),

  create: (data: CreateDomainRequest) =>
    api.post<Domain>('/domains', data),

  delete: (id: string) =>
    api.delete(`/domains/${id}`),

  suspend: (id: string) =>
    api.post<Domain>(`/domains/${id}/suspend`),

  unsuspend: (id: string) =>
    api.post<Domain>(`/domains/${id}/unsuspend`),
}

export const sslApi = {
  list: () =>
    api.get<{ certs: SSLCertificate[]; total: number }>('/webserver/ssl'),

  issue: (data: { domain: string; san_domains?: string[]; provider?: string; challenge_type?: string }) =>
    api.post<SSLCertificate>('/webserver/ssl/issue', data),

  renew: (id: string) =>
    api.post<SSLCertificate>(`/webserver/ssl/renew/${id}`),

  delete: (id: string) =>
    api.delete(`/webserver/ssl/${id}`),
}

export const vhostApi = {
  list: () =>
    api.get<{ vhosts: VHost[]; total: number }>('/webserver/vhosts'),

  create: (data: { domain_name: string; server_type?: string; php_version?: string; document_root?: string }) =>
    api.post<VHost>('/webserver/vhosts', data),

  delete: (id: string) =>
    api.delete(`/webserver/vhosts/${id}`),
}

export const phpApi = {
  getConfig: (vhostId: string) =>
    api.get<PHPConfig>(`/webserver/php/${vhostId}`),

  updateConfig: (vhostId: string, data: Partial<PHPConfig>) =>
    api.put<PHPConfig>(`/webserver/php/${vhostId}`, data),
}
