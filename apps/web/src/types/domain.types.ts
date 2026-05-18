export type DomainStatus = 'active' | 'suspended' | 'pending' | 'error'
export type WebServerType = 'nginx' | 'apache' | 'litespeed' | 'openlitespeed' | 'caddy'

export interface Domain {
  id: string
  organization_id: string
  user_id: string
  server_id?: string
  package_id?: string
  name: string
  document_root?: string
  status: DomainStatus
  ssl_enabled: boolean
  webserver_type: WebServerType
  php_version?: string
  bandwidth_used_mb: number
  disk_used_mb: number
  created_at: string
  updated_at: string
}

export interface CreateDomainRequest {
  name: string
  server_id?: string
  package_id?: string
  webserver_type?: WebServerType
  php_version?: string
  document_root?: string
}

export interface Server {
  id: string
  hostname: string
  ip_address: string
  datacenter?: string
  os_type?: string
  status: 'provisioning' | 'active' | 'maintenance' | 'offline' | 'error'
  specs: Record<string, unknown>
  created_at: string
}

export interface SSLCertificate {
  id: string
  organization_id: string
  domain: string
  san_domains: string[]
  issuer: string
  expires_at?: string
  auto_renew: boolean
  provider: 'letsencrypt' | 'zerossl' | 'custom'
  challenge_type: 'http' | 'dns' | 'tls-alpn'
  status: 'pending' | 'active' | 'expired' | 'revoked' | 'failed'
  last_error?: string
  created_at: string
  updated_at: string
}

export interface VHost {
  id: string
  organization_id: string
  domain_name: string
  document_root: string
  server_type: WebServerType
  php_version?: string
  ssl_enabled: boolean
  status: 'active' | 'suspended' | 'pending'
  created_at: string
  updated_at: string
}

export interface PHPConfig {
  id: string
  vhost_id: string
  php_version: string
  memory_limit: string
  max_execution_time: number
  upload_max_filesize: string
  post_max_size: string
  max_input_vars: number
  opcache_enabled: boolean
  created_at: string
  updated_at: string
}
