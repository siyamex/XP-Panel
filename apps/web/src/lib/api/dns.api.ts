import { api } from './client'
import type { DNSZone, DNSRecord, CreateZoneRequest, CreateRecordRequest, UpdateRecordRequest } from '@/types/dns.types'

export const dnsApi = {
  listZones: () =>
    api.get<{ zones: DNSZone[]; total: number }>('/dns/zones'),

  getZone: (id: string) =>
    api.get<DNSZone>(`/dns/zones/${id}`),

  createZone: (data: CreateZoneRequest) =>
    api.post<DNSZone>('/dns/zones', data),

  deleteZone: (id: string) =>
    api.delete(`/dns/zones/${id}`),

  listRecords: (zoneId: string) =>
    api.get<{ records: DNSRecord[]; total: number }>(`/dns/zones/${zoneId}/records`),

  createRecord: (zoneId: string, data: CreateRecordRequest) =>
    api.post<DNSRecord>(`/dns/zones/${zoneId}/records`, data),

  updateRecord: (zoneId: string, recordId: string, data: UpdateRecordRequest) =>
    api.put<DNSRecord>(`/dns/zones/${zoneId}/records/${recordId}`, data),

  deleteRecord: (zoneId: string, recordId: string) =>
    api.delete(`/dns/zones/${zoneId}/records/${recordId}`),
}
