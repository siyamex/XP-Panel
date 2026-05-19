export interface Mailbox {
  id: string
  organization_id: string
  domain_id?: string
  local_part: string
  domain: string
  email: string
  quota_mb: number
  used_mb: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface Forwarder {
  id: string
  organization_id: string
  source_local: string
  source_domain: string
  source: string
  destinations: string[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface DKIMKey {
  id: string
  organization_id: string
  domain: string
  selector: string
  public_key: string
  dns_txt_value: string
  key_size: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CatchAll {
  id: string
  organization_id: string
  domain: string
  destination: string
  enabled: boolean
  created_at: string
}

export interface CreateMailboxRequest {
  local_part: string
  domain: string
  password: string
  quota_mb?: number
}

export interface UpdateMailboxRequest {
  quota_mb?: number
  enabled?: boolean
}

export interface CreateForwarderRequest {
  source_local: string
  source_domain: string
  destinations: string[]
}

export interface GenerateDKIMRequest {
  domain: string
  selector?: string
  key_size?: number
}

export interface SetCatchAllRequest {
  domain: string
  destination: string
  enabled?: boolean
}
