import { api } from './client'

// ─── FTP ─────────────────────────────────────────────────────────────────────
export interface FTPAccount {
  id: string
  username: string
  home_dir: string
  quota_mb: number
  enabled: boolean
  created_at: string
}

export const ftpApi = {
  list: () => api.get<{ accounts: FTPAccount[]; total: number }>('/webserver/ftp'),
  create: (d: { username: string; password: string; home_dir: string; quota_mb?: number }) =>
    api.post<{ id: string }>('/webserver/ftp', d),
  updatePassword: (id: string, password: string) => api.put(`/webserver/ftp/${id}/password`, { password }),
  delete: (id: string) => api.delete(`/webserver/ftp/${id}`),
  toggle: (id: string) => api.post(`/webserver/ftp/${id}/toggle`, {}),
}

// ─── Subdomains ───────────────────────────────────────────────────────────────
export interface Subdomain {
  id: string
  domain: string
  subdomain: string
  document_root: string
  redirect_to?: string
  created_at: string
}

export const subdomainApi = {
  list: (domain?: string) => api.get<{ subdomains: Subdomain[]; total: number }>('/webserver/subdomains', { params: { domain } }),
  create: (d: Omit<Subdomain, 'id' | 'created_at'>) => api.post<{ id: string }>('/webserver/subdomains', d),
  delete: (id: string) => api.delete(`/webserver/subdomains/${id}`),
}

// ─── Redirects ────────────────────────────────────────────────────────────────
export interface DomainRedirect {
  id: string
  domain: string
  source_path: string
  destination: string
  type: 301 | 302
  wildcard: boolean
  enabled: boolean
  created_at: string
}

export const redirectApi = {
  list: () => api.get<{ redirects: DomainRedirect[]; total: number }>('/webserver/redirects'),
  create: (d: Omit<DomainRedirect, 'id' | 'enabled' | 'created_at'>) => api.post<{ id: string }>('/webserver/redirects', d),
  delete: (id: string) => api.delete(`/webserver/redirects/${id}`),
}

// ─── Error Pages ──────────────────────────────────────────────────────────────
export interface ErrorPage {
  id: string
  domain: string
  error_code: number
  html_content: string
  updated_at: string
}

export const errorPageApi = {
  list: (domain: string) => api.get<{ pages: ErrorPage[] }>('/webserver/error-pages', { params: { domain } }),
  upsert: (d: { domain: string; error_code: number; html_content: string }) =>
    api.post<{ id: string }>('/webserver/error-pages', d),
}

// ─── Directory Privacy ────────────────────────────────────────────────────────
export interface PrivacyEntry {
  id: string
  domain: string
  path: string
  realm: string
  enabled: boolean
  created_at: string
}

export const privacyApi = {
  list: (domain: string) => api.get<{ entries: PrivacyEntry[] }>('/webserver/privacy', { params: { domain } }),
  create: (d: { domain: string; path: string; realm?: string; username: string; password: string }) =>
    api.post<{ id: string }>('/webserver/privacy', d),
  delete: (id: string) => api.delete(`/webserver/privacy/${id}`),
}

// ─── SSH Keys ─────────────────────────────────────────────────────────────────
export interface SSHKey {
  id: string
  label: string
  public_key: string
  fingerprint: string
  created_at: string
}

export const sshKeyApi = {
  list: () => api.get<{ keys: SSHKey[]; total: number }>('/webserver/ssh-keys'),
  add: (d: { label: string; public_key: string }) => api.post<{ id: string; fingerprint: string }>('/webserver/ssh-keys', d),
  delete: (id: string) => api.delete(`/webserver/ssh-keys/${id}`),
}

// ─── MySQL Remote Access ──────────────────────────────────────────────────────
export interface MySQLRemoteEntry {
  id: string
  ip_address: string
  label?: string
  created_at: string
}

export const mysqlRemoteApi = {
  list: () => api.get<{ entries: MySQLRemoteEntry[]; total: number }>('/webserver/mysql-remote'),
  add: (d: { ip_address: string; label?: string }) => api.post<{ id: string }>('/webserver/mysql-remote', d),
  delete: (id: string) => api.delete(`/webserver/mysql-remote/${id}`),
}

// ─── SSL CSR / Import ─────────────────────────────────────────────────────────
export const sslCsrApi = {
  generateCSR: (d: { domain: string; country?: string; state?: string; city?: string; organization?: string; email?: string }) =>
    api.post<{ csr: string; private_key: string }>('/webserver/ssl/csr', d),
  importSSL: (d: { domain: string; certificate: string; private_key: string; ca_bundle?: string }) =>
    api.post<{ id: string; expires_at: string }>('/webserver/ssl/import', d),
}

// ─── Mail features ────────────────────────────────────────────────────────────
export interface Autoresponder {
  id: string
  email: string
  subject: string
  body: string
  from_name?: string
  start_at?: string
  end_at?: string
  enabled: boolean
  created_at: string
}

export const autoresponderApi = {
  list: () => api.get<{ autoresponders: Autoresponder[]; total: number }>('/mail/autoresponders'),
  create: (d: Omit<Autoresponder, 'id' | 'enabled' | 'created_at'>) => api.post<{ id: string }>('/mail/autoresponders', d),
  update: (id: string, d: Partial<Autoresponder>) => api.put(`/mail/autoresponders/${id}`, d),
  delete: (id: string) => api.delete(`/mail/autoresponders/${id}`),
}

export interface EmailFilter {
  id: string
  mailbox: string
  name: string
  rules: Array<{ field: string; condition: string; value: string }>
  action: string
  action_value?: string
  priority: number
  enabled: boolean
  created_at: string
}

export const emailFilterApi = {
  list: (mailbox: string) => api.get<{ filters: EmailFilter[]; total: number }>('/mail/filters', { params: { mailbox } }),
  create: (d: Omit<EmailFilter, 'id' | 'enabled' | 'created_at'>) => api.post<{ id: string }>('/mail/filters', d),
  update: (id: string, d: Partial<EmailFilter>) => api.put(`/mail/filters/${id}`, d),
  delete: (id: string) => api.delete(`/mail/filters/${id}`),
}

export interface MailQueueEntry {
  id: string
  size: string
  date: string
  sender: string
  rcpt: string
  status: string
}

export const mailQueueApi = {
  list: () => api.get<{ entries: MailQueueEntry[]; total: number }>('/mail/queue'),
  flush: () => api.post('/mail/queue/flush', {}),
  deleteEntry: (id: string) => api.delete(`/mail/queue/${id}`),
  deleteAll: () => api.delete('/mail/queue'),
}

// ─── Bandwidth / Disk ─────────────────────────────────────────────────────────
export interface BandwidthPoint {
  timestamp: string
  bytes_in: number
  bytes_out: number
  requests_per_sec: number
  status_2xx: number
  status_4xx: number
  status_5xx: number
}

export const bandwidthApi = {
  getDomainBandwidth: (domain: string, period?: string) =>
    api.get<{ domain: string; period: string; points: BandwidthPoint[]; total_in: number; total_out: number }>(
      `/monitoring/bandwidth/${domain}`, { params: { period } }),
  getDomainDiskUsage: (domain: string) =>
    api.get<{ domain: string; root: string; total_bytes: number; tree: unknown[] }>(`/monitoring/disk/${domain}`),
}

// ─── ModSecurity ─────────────────────────────────────────────────────────────
export const modsecApi = {
  getStatus: () => api.get<{ installed: boolean; mode: string }>('/security/modsec/status'),
  setMode: (mode: string) => api.put('/security/modsec/mode', { mode }),
  listRules: () => api.get<{ rules: unknown[]; total: number; installed: boolean }>('/security/modsec/rules'),
  toggleRule: (d: { file: string; line: number; enabled: boolean }) =>
    api.post('/security/modsec/rules/toggle', d),
}
