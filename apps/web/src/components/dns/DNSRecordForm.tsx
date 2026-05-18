'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { dnsApi } from '@/lib/api/dns.api'
import { DNS_RECORD_TYPES, DNS_TTL_OPTIONS, type DNSRecord, type DNSZone } from '@/types/dns.types'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR', 'NAPTR']),
  content: z.string().min(1, 'Content is required'),
  ttl: z.number().int().min(60).max(86400),
  priority: z.number().int().min(0),
  disabled: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface Props {
  zone: DNSZone
  record: DNSRecord | null
  onClose: () => void
}

export function DNSRecordForm({ zone, record, onClose }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? zone.name + '.',
      type: record?.type ?? 'A',
      content: record?.content ?? '',
      ttl: record?.ttl ?? 3600,
      priority: record?.priority ?? 0,
      disabled: record?.disabled ?? false,
    },
  })

  const recordType = watch('type')
  const showPriority = recordType === 'MX' || recordType === 'SRV'

  useEffect(() => {
    if (record) {
      reset({
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: record.ttl,
        priority: record.priority,
        disabled: record.disabled,
      })
    }
  }, [record, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormData) => dnsApi.createRecord(zone.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dns-zone', zone.id] })
      toast.success('Record created')
      onClose()
    },
    onError: () => toast.error('Failed to create record'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => dnsApi.updateRecord(zone.id, record!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dns-zone', zone.id] })
      toast.success('Record updated')
      onClose()
    },
    onError: () => toast.error('Failed to update record'),
  })

  const onSubmit = (data: FormData) => {
    if (record) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const contentPlaceholders: Partial<Record<string, string>> = {
    A: '192.0.2.1',
    AAAA: '2001:db8::1',
    CNAME: 'target.example.com.',
    MX: 'mail.example.com.',
    TXT: '"v=spf1 include:_spf.example.com ~all"',
    NS: 'ns1.example.com.',
    SRV: '10 5060 sip.example.com.',
    CAA: '0 issue "letsencrypt.org"',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold">
            {record ? 'Edit DNS Record' : 'Add DNS Record'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select
                {...register('type')}
                disabled={!!record}
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {DNS_RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* TTL */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">TTL</label>
              <select
                {...register('ttl', { valueAsNumber: true })}
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DNS_TTL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
            <input
              {...register('name')}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={zone.name + '.'}
            />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Content</label>
            <input
              {...register('content')}
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={contentPlaceholders[recordType] ?? ''}
            />
            {errors.content && <p className="text-destructive text-xs mt-1">{errors.content.message}</p>}
          </div>

          {/* Priority (MX/SRV only) */}
          {showPriority && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <input
                {...register('priority', { valueAsNumber: true })}
                type="number"
                min={0}
                className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Disabled */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input {...register('disabled')} type="checkbox" className="rounded border-border" />
            <span className="text-muted-foreground">Disable this record</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : record ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
