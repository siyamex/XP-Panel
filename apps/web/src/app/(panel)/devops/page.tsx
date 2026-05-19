'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, Plus, Play, Trash2, Loader2, CheckCircle2, XCircle, Clock, Rocket } from 'lucide-react'
import { devopsApi } from '@/lib/api/devops.api'
import type { CreatePipelineRequest } from '@/types/devops.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_CONFIG = {
  idle:      { color: 'text-muted-foreground bg-muted', icon: Clock },
  running:   { color: 'text-blue-500 bg-blue-500/10', icon: Loader2 },
  success:   { color: 'text-green-500 bg-green-500/10', icon: CheckCircle2 },
  failed:    { color: 'text-destructive bg-destructive/10', icon: XCircle },
  cancelled: { color: 'text-muted-foreground bg-muted', icon: XCircle },
}

export default function DevOpsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data: pipelinesData, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => devopsApi.listPipelines(),
    select: (r) => r.data,
  })

  const { data: deploymentsData } = useQuery({
    queryKey: ['deployments'],
    queryFn: () => devopsApi.listDeployments(),
    select: (r) => r.data,
  })

  const triggerMutation = useMutation({
    mutationFn: (id: string) => devopsApi.triggerRun(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline triggered') },
    onError: () => toast.error('Failed to trigger pipeline'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devopsApi.deletePipeline(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline deleted') },
    onError: () => toast.error('Failed to delete pipeline'),
  })

  const pipelines = pipelinesData?.pipelines ?? []
  const deployments = deploymentsData?.deployments ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DevOps</h1>
          <p className="text-sm text-muted-foreground mt-0.5">CI/CD pipelines and deployments</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Pipeline
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Pipelines', value: pipelines.length },
          { label: 'Successful Runs', value: deployments.filter(d => d.status === 'success').length },
          { label: 'Failed Runs', value: pipelines.filter(p => p.status === 'failed').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold">Pipelines</h3></div>
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <GitBranch className="w-10 h-10 mb-2 opacity-30" />
            No pipelines yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Pipeline</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Branch</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Trigger</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Last Run</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.idle
                const Icon = cfg.icon
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/devops/pipelines/${p.id}`} className="font-medium hover:text-primary transition-colors">{p.name}</Link>
                      {p.description && <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.branch}</td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{p.trigger}</td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit capitalize font-medium', cfg.color)}>
                        <Icon className={cn('w-3 h-3', p.status === 'running' && 'animate-spin')} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.last_run_at ? new Date(p.last_run_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => triggerMutation.mutate(p.id)} disabled={p.status === 'running'} className="p-1.5 rounded hover:bg-green-500/10 transition-colors disabled:opacity-40">
                          <Play className="w-3.5 h-3.5 text-green-500" />
                        </button>
                        <Link href={`/devops/pipelines/${p.id}`} className="p-1.5 rounded hover:bg-muted transition-colors">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                        <button onClick={() => { if (confirm('Delete pipeline?')) deleteMutation.mutate(p.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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

      {deployments.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold">Recent Deployments</h3></div>
          <div className="divide-y divide-border">
            {deployments.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Rocket className={cn('w-4 h-4', d.status === 'success' ? 'text-green-500' : d.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')} />
                  <div>
                    <span className="font-medium capitalize">{d.environment}</span>
                    {d.version && <span className="text-xs text-muted-foreground ml-2">v{d.version}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={cn('px-2 py-0.5 rounded-full capitalize font-medium', d.status === 'success' ? 'bg-green-500/10 text-green-500' : d.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>{d.status}</span>
                  <span>{new Date(d.deployed_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  )
}

function CreatePipelineModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreatePipelineRequest>({
    defaultValues: { branch: 'main', trigger: 'manual', steps: [] }
  })
  const mutation = useMutation({
    mutationFn: (data: CreatePipelineRequest) => devopsApi.createPipeline(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline created'); onClose() },
    onError: () => toast.error('Failed to create pipeline'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">New Pipeline</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
            <input {...register('name', { required: true })} placeholder="Deploy Production" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Repository URL (optional)</label>
            <input {...register('repo_url')} placeholder="https://github.com/org/repo" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Branch</label>
              <input {...register('branch')} placeholder="main" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Trigger</label>
              <select {...register('trigger')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
                <option value="manual">Manual</option>
                <option value="push">On Push</option>
                <option value="schedule">Scheduled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
            <input {...register('description')} placeholder="Deploys to production server" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
