'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Plus, Trash2, Loader2, Ban } from 'lucide-react'
import { securityApi } from '@/lib/api/security.api'
import type { CreateFirewallRuleRequest, BlockIPRequest } from '@/types/security.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

export default function FirewallPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [tab, setTab] = useState<'rules' | 'blocklist'>('rules')
  const qc = useQueryClient()

  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ['firewall-rules'],
    queryFn: () => securityApi.listFirewallRules(),
    select: (r) => r.data,
  })

  const { data: blocklistData, isLoading: loadingBlocklist } = useQuery({
    queryKey: ['ip-blocklist'],
    queryFn: () => securityApi.listBlocklist(),
    select: (r) => r.data,
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => securityApi.deleteFirewallRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['firewall-rules'] }); toast.success('Rule deleted') },
  })

  const unblockMutation = useMutation({
    mutationFn: (id: string) => securityApi.unblockIP(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ip-blocklist'] }); toast.success('IP unblocked') },
  })

  const rules = rulesData?.rules ?? []
  const blocklist = blocklistData?.entries ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">Firewall</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'rules' && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          )}
          {tab === 'blocklist' && (
            <button onClick={() => setShowBlock(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
              <Ban className="w-4 h-4" /> Block IP
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['rules', 'blocklist'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'rules' ? `Rules (${rules.length})` : `IP Blocklist (${blocklist.length})`}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingRules ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mb-2 opacity-30" />
              No firewall rules — all traffic passes
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Chain</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Protocol</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Port</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Priority</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{r.chain}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded font-bold', r.action === 'ACCEPT' ? 'bg-green-500/10 text-green-500' : r.action === 'DROP' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500')}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.protocol ?? 'all'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.source_ip ?? 'any'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.port_range ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.priority}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { if (confirm('Delete this rule?')) deleteRuleMutation.mutate(r.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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
      )}

      {tab === 'blocklist' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingBlocklist ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : blocklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Ban className="w-10 h-10 mb-2 opacity-30" />
              No IPs blocked
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">IP / CIDR</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Expires</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blocklist.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{e.ip}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.expires_at ? new Date(e.expires_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => unblockMutation.mutate(e.id)} className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          Unblock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddRuleModal onClose={() => setShowAdd(false)} />}
        {showBlock && <BlockIPModal onClose={() => setShowBlock(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateFirewallRuleRequest>({
    defaultValues: { chain: 'INPUT', action: 'DROP', priority: 100 }
  })
  const mutation = useMutation({
    mutationFn: (data: CreateFirewallRuleRequest) => securityApi.createFirewallRule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['firewall-rules'] }); toast.success('Rule created'); onClose() },
    onError: () => toast.error('Failed to create rule'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Add Firewall Rule</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Chain</label>
              <select {...register('chain')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="INPUT">INPUT</option>
                <option value="OUTPUT">OUTPUT</option>
                <option value="FORWARD">FORWARD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Action</label>
              <select {...register('action')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="ACCEPT">ACCEPT</option>
                <option value="DROP">DROP</option>
                <option value="REJECT">REJECT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Protocol</label>
              <select {...register('protocol')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="">all</option>
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
                <option value="icmp">icmp</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Source IP/CIDR</label>
              <input {...register('source_ip')} placeholder="0.0.0.0/0" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Port Range</label>
              <input {...register('port_range')} placeholder="80 or 80:443" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Comment (optional)</label>
            <input {...register('comment')} placeholder="Block SSH brute force" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Adding...' : 'Add Rule'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function BlockIPModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<BlockIPRequest>()
  const mutation = useMutation({
    mutationFn: (data: BlockIPRequest) => securityApi.blockIP(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ip-blocklist'] }); toast.success('IP blocked'); onClose() },
    onError: () => toast.error('Failed to block IP'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Block IP Address</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">IP or CIDR</label>
            <input {...register('ip', { required: true })} placeholder="192.168.1.1 or 10.0.0.0/8" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional)</label>
            <input {...register('reason')} placeholder="Brute force attack" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Blocking...' : 'Block IP'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
