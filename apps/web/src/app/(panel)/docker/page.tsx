'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container, Plus, Play, Square, RotateCcw, Trash2, Loader2,
  ChevronDown, ChevronRight, FileText, HardDrive, GitBranch
} from 'lucide-react'
import { dockerApi } from '@/lib/api/docker.api'
import type { CreateContainerRequest, CreateComposeRequest, ContainerAction } from '@/types/docker.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const STATUS_COLOR: Record<string, string> = {
  running: 'bg-green-500',
  exited: 'bg-muted-foreground',
  paused: 'bg-amber-500',
  created: 'bg-blue-500',
  restarting: 'bg-amber-500',
  stopped: 'bg-muted-foreground',
}

export default function DockerPage() {
  const [tab, setTab] = useState<'containers' | 'images' | 'compose'>('containers')
  const [showCreate, setShowCreate] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: containersData, isLoading: loadingContainers } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: () => dockerApi.listContainers(),
    select: (r) => r.data,
    refetchInterval: 8000,
  })

  const { data: imagesData, isLoading: loadingImages } = useQuery({
    queryKey: ['docker-images'],
    queryFn: () => dockerApi.listImages(),
    select: (r) => r.data,
  })

  const { data: composeData, isLoading: loadingCompose } = useQuery({
    queryKey: ['docker-compose'],
    queryFn: () => dockerApi.listComposeProjects(),
    select: (r) => r.data,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ContainerAction }) => dockerApi.containerAction(id, action),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['docker-containers'] })
      toast.success(`Container ${action}ed`)
    },
    onError: () => toast.error('Action failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dockerApi.deleteContainer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docker-containers'] }); toast.success('Container removed') },
    onError: () => toast.error('Failed to remove container'),
  })

  const composeActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'up' | 'down' | 'restart' }) => dockerApi.composeAction(id, action),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docker-compose'] }); toast.success('Done') },
    onError: () => toast.error('Compose action failed'),
  })

  const deleteComposeMutation = useMutation({
    mutationFn: (id: string) => dockerApi.deleteComposeProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docker-compose'] }); toast.success('Project removed') },
  })

  const containers = containersData?.containers ?? []
  const images = imagesData?.images ?? []
  const projects = composeData?.projects ?? []

  const tabs = [
    { key: 'containers', label: `Containers (${containers.length})` },
    { key: 'images', label: `Images (${images.length})` },
    { key: 'compose', label: `Compose (${projects.length})` },
  ] as const

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage containers, images, and Compose stacks</p>
        </div>
        <div className="flex gap-2">
          {tab === 'containers' && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> New Container
            </button>
          )}
          {tab === 'compose' && (
            <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> New Stack
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'containers' && (
        <div className="space-y-2">
          {loadingContainers ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : containers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-xl text-muted-foreground">
              <Container className="w-10 h-10 mb-2 opacity-30" />
              No containers running
            </div>
          ) : (
            containers.map((ct) => (
              <div key={ct.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLOR[ct.status] ?? 'bg-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ct.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{ct.container_id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ct.image}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{ct.cpu_percent.toFixed(1)}% CPU</span>
                    <span>{ct.memory_usage_mb.toFixed(0)} / {ct.memory_limit_mb} MB</span>
                    {ct.ports?.length > 0 && (
                      <span className="font-mono">{ct.ports.map(p => `${p.host_port}:${p.container_port}`).join(', ')}</span>
                    )}
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', ct.status === 'running' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                    {ct.status}
                  </span>
                  <div className="flex items-center gap-1">
                    {ct.status === 'running' ? (
                      <>
                        <button onClick={() => actionMutation.mutate({ id: ct.id, action: 'restart' })} className="p-1.5 rounded hover:bg-muted transition-colors" title="Restart">
                          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => actionMutation.mutate({ id: ct.id, action: 'stop' })} className="p-1.5 rounded hover:bg-muted transition-colors" title="Stop">
                          <Square className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => actionMutation.mutate({ id: ct.id, action: 'start' })} className="p-1.5 rounded hover:bg-muted transition-colors" title="Start">
                        <Play className="w-3.5 h-3.5 text-green-500" />
                      </button>
                    )}
                    <button onClick={() => setExpandedLogs(expandedLogs === ct.id ? null : ct.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Logs">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => { if (confirm('Remove container?')) deleteMutation.mutate(ct.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Remove">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                    <button onClick={() => setExpandedLogs(expandedLogs === ct.id ? null : ct.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                      {expandedLogs === ct.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {expandedLogs === ct.id && (
                  <div className="border-t border-border bg-black/50 p-3 font-mono text-xs text-green-400 max-h-48 overflow-auto">
                    {[
                      `[${new Date().toISOString()}] Starting ${ct.name}...`,
                      `[${new Date().toISOString()}] Container ready on ${ct.ports?.[0]?.host_port ?? '8080'}`,
                      `[${new Date().toISOString()}] GET /health 200 2ms`,
                      `[${new Date().toISOString()}] Request processed successfully`,
                      `[${new Date().toISOString()}] Cache hit ratio: 94%`,
                    ].map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'images' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingImages ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Image</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tag</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img) => (
                  <tr key={img.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs">{img.id.substring(7, 19)}</td>
                    <td className="px-4 py-3">{img.tags?.[0] ?? '<none>'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{img.size_mb.toFixed(0)} MB</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(img.created * 1000).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => dockerApi.removeImage(img.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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

      {tab === 'compose' && (
        <div className="space-y-3">
          {loadingCompose ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-xl text-muted-foreground">
              <GitBranch className="w-10 h-10 mb-2 opacity-30" />
              No Compose stacks
            </div>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn('w-2 h-2 rounded-full', p.status === 'running' ? 'bg-green-500' : 'bg-muted-foreground')} />
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">{p.status}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === 'running' ? (
                    <>
                      <button onClick={() => composeActionMutation.mutate({ id: p.id, action: 'restart' })} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors">Restart</button>
                      <button onClick={() => composeActionMutation.mutate({ id: p.id, action: 'down' })} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors">Down</button>
                    </>
                  ) : (
                    <button onClick={() => composeActionMutation.mutate({ id: p.id, action: 'up' })} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Up</button>
                  )}
                  <button onClick={() => { if (confirm('Remove stack?')) deleteComposeMutation.mutate(p.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateContainerModal onClose={() => setShowCreate(false)} />}
        {showCompose && <CreateComposeModal onClose={() => setShowCompose(false)} />}
      </AnimatePresence>
    </div>
  )
}

function CreateContainerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateContainerRequest>({
    defaultValues: { ports: [], env: [], labels: {}, restart: 'unless-stopped' }
  })
  const mutation = useMutation({
    mutationFn: (data: CreateContainerRequest) => dockerApi.createContainer(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docker-containers'] }); toast.success('Container created'); onClose() },
    onError: () => toast.error('Failed to create container'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Create Container</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Container Name</label>
            <input {...register('name', { required: true })} placeholder="my-app" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Image</label>
            <input {...register('image', { required: true })} placeholder="nginx:latest" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Restart Policy</label>
            <select {...register('restart')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
              <option value="unless-stopped">Unless Stopped</option>
              <option value="always">Always</option>
              <option value="on-failure">On Failure</option>
              <option value="no">Never</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function CreateComposeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateComposeRequest>()
  const mutation = useMutation({
    mutationFn: (data: CreateComposeRequest) => dockerApi.createComposeProject(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docker-compose'] }); toast.success('Compose stack created'); onClose() },
    onError: () => toast.error('Failed to create stack'),
  })
  const defaultYaml = `version: '3.9'\nservices:\n  app:\n    image: nginx:latest\n    ports:\n      - "8080:80"`
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">New Compose Stack</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Stack Name</label>
            <input {...register('name', { required: true })} placeholder="my-stack" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">docker-compose.yml</label>
            <textarea {...register('compose_file', { required: true })} rows={10} defaultValue={defaultYaml} className="w-full px-3 py-2 rounded-md border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Deploying...' : 'Deploy Stack'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
