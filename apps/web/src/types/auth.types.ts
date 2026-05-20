export interface User {
  id: string
  organization_id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  status: 'active' | 'suspended' | 'pending' | 'locked'
  mfa_enabled: boolean
  mfa_type?: 'totp' | 'sms' | 'webauthn'
  passkey_enabled: boolean
  timezone: string
  language: string
  roles: string[]
  created_at: string
  last_login_at?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended' | 'trial' | 'cancelled'
  white_label_domain?: string
  logo_url?: string
  settings: Record<string, unknown>
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  ip_address: string
  user_agent: string
  device_fingerprint?: string
  expires_at: string
  last_active_at: string
  created_at: string
  is_current?: boolean
}

export interface APIToken {
  id: string
  name: string
  scopes: string[]
  last_used_at?: string
  expires_at?: string
  created_at: string
  token?: string // only present on creation
}

export interface Passkey {
  id: string
  credential_id: string
  name: string
  aaguid: string
  created_at: string
  last_used_at?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: User
  requires_mfa: boolean
  mfa_session_id?: string
}

export interface RegisterRequest {
  organization_name: string
  email: string
  username: string
  password: string
  timezone?: string
}

export interface MFASetupResponse {
  secret: string
  qr_code: string // base64 PNG
  backup_codes: string[]
}
