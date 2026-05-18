'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Plus, RefreshCw, Trash2, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { sslApi } from '@/lib/api/domains.api'
import type { SSLCertificate } from '@/types/domain.types'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle2, color: 'text-green-500 bg-green-500/10' },
  pending: { label: 'Pending', icon: Clock, color: 'text-blue-500 bg-blue-500/10' },
  expired: { label: 'Expired', icon: AlertCircle, color: 'text-amber-500 bg-amber-500/10' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive bg-destructive/10' },
  revoked: { label: 'Revoked', icon: AlertCircle, color: 'text-muted-foreground bg-muted' },
}

export default function SSLPage() {
  const [showIssue, setShowIssue] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ssl-certs'],
    queryFn: () => sslApi.list(),
    select: (r) => r.data,
  })

  const renewMutation = useMutation({
    mutationFn: (id: string) => sslApi.renew(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssl-certs'] }); toast.success('Certificate renewal initiated') },
    onError: () => toast.error('Failed to renew certificate'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sslApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssl-certs'] }); toast.success('Certificate deleted') },
  })

  const certs = data?.certificates ?? []
  const activeCerts = certs.filter((c) => c.status === 'active').length
  const expiringSoon = certs.filter((c) => {
    if (!c.expires_at) return false
    const days = (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days > 0 && days < 30
  }).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SSL / TLS Certificates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage Let's Encrypt and custom certificates</p>
        </div>
        <button onClick={() => setShowIssue(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Issue Certificate
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold mt-1 text-green-500">{activeCerts}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Expiring Soon</div>
          <div className={cn('text-2xl font-bold mt-1', expiringSoon > 0 ? 'text-amber-500' : '')}>{expiringSoon}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{certs.length}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : certs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mb-2 opacity-30" />
            No certificates yet — issue your first SSL certificate
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Issuer</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Expires</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => {
                const cfg = STATUS_CONFIG[cert.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={cert.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium">{cert.domain}</div>
                      {cert.san_domains.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">+{cert.san_domains.length} SANs</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit', cfg.color)}>
                        <cfg.icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cert.issuer || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cert.expires_at ? formatDate(cert.expires_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{cert.provider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => renewMutation.mutate(cert.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Renew">
                          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => { if (confirm('Delete certificate?')) deleteMutation.mutate(cert.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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
  const { register, handleSubmit } = useForm<{ domain: string; provider: string; challenge_type: string }>()
  const mutation = useMutation({
    mutationFn: (d: { domain: string; provider: string; challenge_type: string }) => sslApi.issue(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssl-certs'] }); toast.success('Certificate issuance initiated'); onClose() },
    onError: () => toast.error('Failed to issue certificate'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border"><h2 className="font-semibold">Issue SSL Certificate</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('domain', { required: true })} placeholder="example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
              <select {...register('provider')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="letsencrypt">Let's Encrypt</option>
                <option value="zerossl">ZeroSSL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Challenge</label>
              <select {...register('challenge_type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="http">HTTP-01</option>
                <option value="dns">DNS-01</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Issuing...' : 'Issue Certificate'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function SSLTLSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SSL / TLS</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage SSL certificates and Let's Encrypt automation</p>
      </div>
      <div className="flex items-center justify-center h-64 bg-card border border-dashed border-border rounded-xl">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium">Coming in Phase 2</p>
          <p className="text-xs text-muted-foreground/60">SSL / TLS management will be available soon</p>
        </div>
      </div>
    </div>
  );
}
