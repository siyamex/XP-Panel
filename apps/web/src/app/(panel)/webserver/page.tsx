'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server, Plus, Trash2, Loader2, Search, RefreshCw,
  Globe, Settings, CheckCircle, XCircle, AlertCircle, ExternalLink,
} from 'lucide-react'
import { webserverApi, type Vhost, type CreateVhostRequest } from '@/lib/api/webserver.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

const SERVER_TYPES = ['nginx', 'apache', 'caddy', 'litespeed'] as const
const PHP_VERSIONS = ['8.3', '8.2', '8.1', '8.0', '7.4']

const SERVER_COLORS: Record<string, string> = {
  nginx:      'bg-green-500/10 text-green-600 dark:text-green-400',
  apache:     'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  caddy:      'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  litespeed:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

function StatusBadge({ status }: { status: Vhost['status'] }) {
  const map = {
    active:   { Icon: CheckCircle, cls: 'text-green-500 bg-green-500/10',   label: 'Active' },
    disabled: { Icon: XCircle,     cls: 'text-muted-foreground bg-muted',    label: 'Disabled' },
    error:    { Icon: AlertCircle, cls: 'text-red-500 bg-red-500/10',        label: 'Error' },
  }
  const { Icon, cls, label } = map[status] ?? map.error
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cls)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  )
}

export default function WebServerPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editVhost, setEditVhost] = useState<Vhost | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vhosts'],
    queryFn: () => webserverApi.listVhosts(),
    select: r => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webserverApi.deleteVhost(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('Virtual host deleted') },
    onError: () => toast.error('Failed to delete virtual host'),
  })

  const vhosts = (data?.vhosts ?? []).filter(v =>
    !search || v.domain_name.toLowerCase().includes(search.toLowerCase())
  )
  const byType = (t: string) => (data?.vhosts ?? []).filter(v => v.server_type === t).length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Web Server</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage virtual hosts and web server configuration</p>
      </div>

      {/* Server type breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {SERVER_TYPES.map(t => (
          <div key={t} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold', SERVER_COLORS[t])}>
              {t.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-muted-foreground capitalize">{t}</div>
              <div className="text-xl font-bold">{byType(t)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div className="flex gap-3">
        <Link href="/ssl" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
          <Globe className="w-4 h-4 text-green-500" /> SSL Certificates
        </Link>
        <Link href="/php" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
          <Server className="w-4 h-4 text-purple-500" /> PHP Configuration
        </Link>
      </div>

      {/* Vhosts table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="text" placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Virtual Host
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : vhosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Server className="w-10 h-10 opacity-20" />
            <p>{search ? 'No domains match your search' : 'No virtual hosts configured yet'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Server</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Document Root</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PHP</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SSL</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vhosts.map(v => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{v.domain_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded font-mono font-medium capitalize', SERVER_COLORS[v.server_type] ?? 'bg-muted text-muted-foreground')}>
                      {v.server_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{v.document_root}</td>
                  <td className="px-4 py-3">
                    {v.php_version
                      ? <span className="text-xs font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded">PHP {v.php_version}</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {v.ssl_enabled
                      ? <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-medium">✓ SSL</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={`https://${v.domain_name}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted transition-colors">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                      <button onClick={() => setEditVhost(v)} className="p-1.5 rounded hover:bg-muted transition-colors">
                        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete vhost for ${v.domain_name}?`)) deleteMutation.mutate(v.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddVhostModal onClose={() => setShowAdd(false)} />}
        {editVhost && <EditVhostModal vhost={editVhost} onClose={() => setEditVhost(null)} />}
      </AnimatePresence>
    </div>
  )
}

function AddVhostModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch } = useForm<CreateVhostRequest & { has_php: boolean }>({
    defaultValues: { server_type: 'nginx', document_root: '/var/www', has_php: true, php_version: '8.2' },
  })
  const hasPhp = watch('has_php')
  const mutation = useMutation({
    mutationFn: (data: CreateVhostRequest) => webserverApi.createVhost(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('Virtual host created'); onClose() },
    onError: () => toast.error('Failed to create virtual host'),
  })
  const onSubmit = ({ has_php, ...rest }: CreateVhostRequest & { has_php: boolean }) =>
    mutation.mutate({ ...rest, php_version: has_php ? rest.php_version : undefined })

  return (
    <ModalShell title="Add Virtual Host" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Domain Name</label>
          <input {...register('domain_name', { required: true })} placeholder="example.com" className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Server Type</label>
            <select {...register('server_type')} className="field">
              {SERVER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Document Root</label>
            <input {...register('document_root', { required: true })} placeholder="/var/www/example" className="field" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="has_php" {...register('has_php')} className="rounded" />
          <label htmlFor="has_php" className="text-sm font-medium">Enable PHP-FPM</label>
        </div>
        {hasPhp && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">PHP Version</label>
            <select {...register('php_version')} className="field">
              {PHP_VERSIONS.map(v => <option key={v} value={v}>PHP {v}</option>)}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditVhostModal({ vhost, onClose }: { vhost: Vhost; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm({ defaultValues: { server_type: vhost.server_type, php_version: vhost.php_version ?? '' } })
  const mutation = useMutation({
    mutationFn: (d: { server_type: string; php_version: string }) =>
      webserverApi.updateVhost(vhost.id, { server_type: d.server_type, php_version: d.php_version || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('Updated'); onClose() },
    onError: () => toast.error('Failed to update'),
  })
  return (
    <ModalShell title={`Edit — ${vhost.domain_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Server Type</label>
          <select {...register('server_type')} className="field">
            {SERVER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">PHP Version</label>
          <select {...register('php_version')} className="field">
            <option value="">— Disabled —</option>
            {PHP_VERSIONS.map(v => <option key={v} value={v}>PHP {v}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>
  )
}
