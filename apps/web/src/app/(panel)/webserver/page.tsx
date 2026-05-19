'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Plus, Trash2, Loader2, Globe } from 'lucide-react'
import { vhostApi } from '@/lib/api/domains.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

export default function WebServerPage() {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vhosts'],
    queryFn: () => vhostApi.list(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vhostApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('Virtual host removed') },
    onError: () => toast.error('Failed to remove virtual host'),
  })

  const vhosts = data?.vhosts ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Web Server</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage virtual hosts and web server configuration</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Virtual Host
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(['nginx', 'apache', 'caddy', 'litespeed'] as const).map((type) => {
          const count = vhosts.filter((v) => v.server_type === type).length
          return (
            <div key={type} className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm text-muted-foreground capitalize">{type}</div>
              <div className="text-2xl font-bold mt-1">{count}</div>
            </div>
          )
        })}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : vhosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Server className="w-10 h-10 mb-2 opacity-30" />
            No virtual hosts configured
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Server</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PHP</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">SSL</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vhosts.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-medium">{v.domain_name}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{v.server_type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{v.php_version ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', v.ssl_enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {v.ssl_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', v.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { if (confirm(`Remove vhost for ${v.domain_name}?`)) deleteMutation.mutate(v.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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
        {showAdd && <AddVHostModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddVHostModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<{ domain_name: string; server_type: string; php_version: string }>()
  const mutation = useMutation({
    mutationFn: (d: { domain_name: string; server_type: string; php_version: string }) => vhostApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('Virtual host created'); onClose() },
    onError: () => toast.error('Failed to create virtual host'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Add Virtual Host</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('domain_name', { required: true })} placeholder="example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Web Server</label>
              <select {...register('server_type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="nginx">Nginx</option>
                <option value="apache">Apache</option>
                <option value="caddy">Caddy</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">PHP Version</label>
              <select {...register('php_version')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="">None</option>
                <option value="8.3">PHP 8.3</option>
                <option value="8.2">PHP 8.2</option>
                <option value="8.1">PHP 8.1</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
