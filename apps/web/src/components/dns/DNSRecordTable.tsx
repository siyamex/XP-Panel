'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dnsApi } from '@/lib/api/dns.api'
import { DNS_RECORD_TYPES, type DNSRecord, type DNSZone } from '@/types/dns.types'
import { DNSRecordForm } from './DNSRecordForm'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

interface Props {
  zone: DNSZone
}

const TYPE_COLORS: Record<string, string> = {
  A: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  AAAA: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  CNAME: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  MX: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  TXT: 'bg-green-500/10 text-green-400 border-green-500/20',
  NS: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  SRV: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  CAA: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  PTR: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  SOA: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

export function DNSRecordTable({ zone }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState<DNSRecord | null>(null)
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dnsApi.deleteRecord(zone.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dns-zone', zone.id] })
      toast.success('Record deleted')
    },
    onError: () => toast.error('Failed to delete record'),
  })

  const records = zone.records ?? []
  const filtered = records.filter((r) => {
    const matchType = typeFilter === 'all' || r.type === typeFilter
    const matchSearch = !filter ||
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.content.toLowerCase().includes(filter.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              typeFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            )}
          >
            All ({records.length})
          </button>
          {DNS_RECORD_TYPES.map((t) => {
            const count = records.filter((r) => r.type === t).length
            if (count === 0) return null
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {t} ({count})
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Filter records..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary w-48"
          />
          <button
            onClick={() => { setEditRecord(null); setShowForm(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Content</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">TTL</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {records.length === 0 ? 'No DNS records yet' : 'No records match the filter'}
                  </td>
                </tr>
              ) : (
                filtered.map((record) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.name}
                      {record.disabled && (
                        <span className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide',
                        TYPE_COLORS[record.type] ?? 'bg-muted text-muted-foreground border-border'
                      )}>
                        {record.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-xs truncate text-muted-foreground">
                      {record.priority > 0 && (
                        <span className="text-foreground mr-2">{record.priority}</span>
                      )}
                      {record.content}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{record.ttl}s</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditRecord(record); setShowForm(true) }}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this record?')) {
                              deleteMutation.mutate(record.id)
                            }
                          }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Add/Edit form modal */}
      <AnimatePresence>
        {showForm && (
          <DNSRecordForm
            zone={zone}
            record={editRecord}
            onClose={() => { setShowForm(false); setEditRecord(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
