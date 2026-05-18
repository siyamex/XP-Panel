'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Plus, Trash2, ExternalLink, Shield, ShieldCheck,
  Loader2, Search, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { domainsApi } from '@/lib/api/domains.api'
import type { Domain, CreateDomainRequest } from '@/types/domain.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle2, color: 'text-green-500' },
  suspended: { label: 'Suspended', icon: AlertCircle, color: 'text-amber-500' },
  pending: { label: 'Pending', icon: Clock, color: 'text-blue-500' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-destructive' },
}

export default function DomainsPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainsApi.list(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => domainsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domains'] }); toast.success('Domain deleted') },
    onError: () => toast.error('Failed to delete domain'),
  })

  const domains = (data?.domains ?? []).filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domains</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your hosted domains and websites
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['active', 'pending', 'suspended', 'error'] as const).map((status) => {
          const count = (data?.domains ?? []).filter((d) => d.status === status).length
          const cfg = STATUS_CONFIG[status]
          return (
            <div key={status} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{status}</span>
                <cfg.icon className={cn('w-4 h-4', cfg.color)} />
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
            </div>
          )
        })}
      </div>

      {/* Search + list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Globe className="w-10 h-10 mb-2 opacity-30" />
            {search ? 'No domains match your search' : 'No domains yet — add your first domain'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Web Server</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PHP</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SSL</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {domains.map((domain) => {
                  const statusCfg = STATUS_CONFIG[domain.status]
                  return (
                    <motion.tr
                      key={domain.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/domains/${domain.id}`}
                          className="font-medium hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          {domain.name}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1 text-xs', statusCfg.color)}>
                          <statusCfg.icon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {domain.webserver_type}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {domain.php_version ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {domain.ssl_enabled ? (
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <Shield className="w-4 h-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${domain.name}?`)) {
                                deleteMutation.mutate(domain.id)
                              }
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Add domain modal */}
      <AnimatePresence>
        {showAdd && <AddDomainModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddDomainModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDomainRequest>()

  const mutation = useMutation({
    mutationFn: (data: CreateDomainRequest) => domainsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] })
      toast.success('Domain added')
      onClose()
    },
    onError: () => toast.error('Failed to add domain'),
  })

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
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Add Domain</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><Globe className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain Name</label>
            <input
              {...register('name', { required: 'Domain name is required' })}
              placeholder="example.com"
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Web Server</label>
            <select {...register('webserver_type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="nginx">Nginx</option>
              <option value="apache">Apache</option>
              <option value="caddy">Caddy</option>
              <option value="litespeed">LiteSpeed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">PHP Version</label>
            <select {...register('php_version')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">None</option>
              <option value="8.3">PHP 8.3</option>
              <option value="8.2">PHP 8.2</option>
              <option value="8.1">PHP 8.1</option>
              <option value="8.0">PHP 8.0</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Adding...' : 'Add Domain'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
