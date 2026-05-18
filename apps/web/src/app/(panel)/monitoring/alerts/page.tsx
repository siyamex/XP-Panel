'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { monitoringApi } from '@/lib/api/monitoring.api'
import type { CreateAlertRuleRequest } from '@/types/monitoring.types'
import { METRIC_OPTIONS, CONDITION_OPTIONS } from '@/types/monitoring.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AlertsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => monitoringApi.listAlertRules(),
    select: (r) => r.data,
  })

  const { data: incidentsData, isLoading: loadingIncidents } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => monitoringApi.listIncidents(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => monitoringApi.deleteAlertRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); toast.success('Rule deleted') },
  })

  const rules = rulesData?.rules ?? []
  const incidents = incidentsData?.incidents ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/monitoring" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Monitoring</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">Alert Rules</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold">Alert Rules</h3></div>
        {loadingRules ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            No alert rules configured
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rule</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Condition</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Severity</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Duration</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.metric}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.metric} {r.condition} {r.threshold}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', r.severity === 'critical' ? 'bg-destructive/10 text-destructive' : r.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground')}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.duration_seconds}s</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteMutation.mutate(r.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold">Incidents</h3></div>
        {loadingIncidents ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
            No incidents — everything looks good!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {inc.status === 'resolved' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                    inc.status === 'open' ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
                    <Clock className="w-4 h-4 text-amber-500" />}
                  <div>
                    <div className="text-sm font-medium">{inc.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(inc.started_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', inc.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500')}>{inc.severity}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', inc.status === 'resolved' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>{inc.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddAlertRuleModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddAlertRuleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateAlertRuleRequest>({
    defaultValues: { condition: 'gt', severity: 'warning', duration_seconds: 60 }
  })
  const mutation = useMutation({
    mutationFn: (data: CreateAlertRuleRequest) => monitoringApi.createAlertRule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alert-rules'] }); toast.success('Rule created'); onClose() },
    onError: () => toast.error('Failed to create rule'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Add Alert Rule</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rule Name</label>
            <input {...register('name', { required: true })} placeholder="High CPU Usage" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Metric</label>
              <select {...register('metric', { required: true })} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                {METRIC_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Condition</label>
              <select {...register('condition')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Threshold</label>
              <input {...register('threshold', { required: true, valueAsNumber: true })} type="number" step="0.1" placeholder="85" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (s)</label>
              <input {...register('duration_seconds', { valueAsNumber: true })} type="number" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Severity</label>
              <select {...register('severity')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
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
