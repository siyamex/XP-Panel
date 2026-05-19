'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Plus, RefreshCw, Trash2, Loader2,
  AlertCircle, CheckCircle2, Clock, Info, Lock,
} from 'lucide-react'
import { webserverApi, type SSLCert } from '@/lib/api/webserver.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const days = daysUntil(expiresAt)
  if (days === null) return <span className="text-muted-foreground text-xs">—</span>
  if (days < 0)  return <span className="text-xs text-red-500 font-medium">Expired</span>
  if (days < 14) return <span className="text-xs text-red-500 font-medium">{days}d left</span>
  if (days < 30) return <span className="text-xs text-amber-500 font-medium">{days}d left</span>
  return <span className="text-xs text-muted-foreground">{days}d left</span>
}

const STATUS_MAP: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  active:  { icon: CheckCircle2, cls: 'text-green-500 bg-green-500/10', label: 'Active' },
  pending: { icon: Clock,        cls: 'text-blue-500 bg-blue-500/10',   label: 'Pending' },
  expired: { icon: AlertCircle,  cls: 'text-amber-500 bg-amber-500/10', label: 'Expired' },
  error:   { icon: AlertCircle,  cls: 'text-red-500 bg-red-500/10',     label: 'Error' },
}

export default function SSLPage() {
  const [showIssue, setShowIssue] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ssl-certs'],
    queryFn: () => webserverApi.listSSL(),
    select: r => r.data,
    refetchInterval: 10_000, // poll while certs are pending
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webserverApi.deleteSSL(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssl-certs'] }); toast.success('Certificate deleted') },
    onError: () => toast.error('Failed to delete certificate'),
  })

  const certs = data?.certificates ?? []
  const activeCount   = certs.filter(c => c.status === 'active').length
  const expiringCount = certs.filter(c => { const d = daysUntil(c.expires_at); return d !== null && d >= 0 && d < 30 }).length
  const expiredCount  = certs.filter(c => c.status === 'expired' || (daysUntil(c.expires_at) ?? 1) < 0).length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SSL / TLS Certificates</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Issue and manage Let's Encrypt and custom SSL certificates</p>
      </div>

      {/* Auto-renewal info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-500">
          Let's Encrypt certificates are renewed automatically 30 days before expiry via ACME HTTP-01 challenge.
          Wildcard certificates require DNS-01 validation.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',          value: certs.length,    color: '' },
          { label: 'Active',         value: activeCount,     color: 'text-green-500' },
          { label: 'Expiring Soon',  value: expiringCount,   color: expiringCount > 0 ? 'text-amber-500' : '' },
          { label: 'Expired',        value: expiredCount,    color: expiredCount > 0 ? 'text-red-500' : '' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Certificates</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={() => setShowIssue(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Issue Certificate
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : certs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <ShieldCheck className="w-10 h-10 opacity-20" />
            <p>No SSL certificates yet</p>
            <button onClick={() => setShowIssue(true)} className="text-sm text-primary hover:underline">Issue your first certificate →</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Expires</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Time Left</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map(cert => {
                const s = STATUS_MAP[cert.status] ?? STATUS_MAP.error
                const Icon = s.icon
                const expiryDate = cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '—'
                return (
                  <tr key={cert.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="font-medium">{cert.domain}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', s.cls)}>
                        <Icon className="w-3 h-3" /> {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{cert.provider}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{expiryDate}</td>
                    <td className="px-4 py-3"><ExpiryBadge expiresAt={cert.expires_at} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { if (confirm(`Delete certificate for ${cert.domain}?`)) deleteMutation.mutate(cert.id) }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showIssue && <IssueCertModal onClose={() => setShowIssue(false)} />}
      </AnimatePresence>
    </div>
  )
}

function IssueCertModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<{ domain: string; provider: string }>({
    defaultValues: { provider: 'letsencrypt' },
  })
  const mutation = useMutation({
    mutationFn: (d: { domain: string; provider: string }) => webserverApi.issueSSL(d.domain, d.provider),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ssl-certs'] })
      toast.success(res.data.message ?? 'Certificate issuance queued')
      onClose()
    },
    onError: () => toast.error('Failed to issue certificate'),
  })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Issue SSL Certificate</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('domain', { required: true })} placeholder="example.com" className="field" />
            <p className="text-xs text-muted-foreground mt-1">For wildcard certificates use *.example.com (requires DNS-01)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
            <select {...register('provider')} className="field">
              <option value="letsencrypt">Let's Encrypt (free, auto-renew)</option>
              <option value="zerossl">ZeroSSL (free, auto-renew)</option>
              <option value="custom">Custom / Upload</option>
            </select>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Requirements</p>
            <p>• Domain DNS must point to this server</p>
            <p>• Port 80 must be publicly accessible for HTTP-01 challenge</p>
            <p>• Certificate will be valid for 90 days and auto-renewed</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue Certificate'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
