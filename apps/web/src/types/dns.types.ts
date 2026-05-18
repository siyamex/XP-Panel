export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'SRV' | 'CAA' | 'PTR' | 'NAPTR'

export interface DNSZone {
  id: string
  organization_id: string
  domain_id?: string
  name: string
  kind: 'Native' | 'Master' | 'Slave'
  serial: number
  nameservers: string[]
  status: 'active' | 'suspended' | 'pending'
  records?: DNSRecord[]
  created_at: string
  updated_at: string
}

export interface DNSRecord {
  id: string
  zone_id: string
  name: string
  type: DNSRecordType
  content: string
  ttl: number
  priority: number
  disabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateZoneRequest {
  name: string
  kind?: 'Native' | 'Master' | 'Slave'
  nameservers?: string[]
}

export interface CreateRecordRequest {
  name: string
  type: DNSRecordType
  content: string
  ttl?: number
  priority?: number
  disabled?: boolean
}

export interface UpdateRecordRequest {
  content: string
  ttl: number
  priority: number
  disabled: boolean
}

export const DNS_RECORD_TYPES: DNSRecordType[] = [
  'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR'
]

export const DNS_TTL_OPTIONS = [
  { label: 'Auto (3600)', value: 3600 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours', value: 43200 },
  { label: '1 day', value: 86400 },
]
