'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Plus, Play, Square, RotateCcw, Trash2, Loader2,
  ChevronDown, ChevronRight, FileText, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { dockerApi } from '@/lib/api/docker.api'
import type { ComposeProject, CreateComposeRequest, ComposeAction } from '@/types/docker.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const DEFAULT_COMPOSE = `version: "3.9"
services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`

const STATUS_COLOR: Record<string, string> = {
  running: 'bg-green-500',
  stopped: 'bg-muted-foreground',
  partial: 'bg-amber-500',
  error:   'bg-red-500',
}

function ProjectCard({
  project,
  onAction,
  onDelete,
  actionLoading,
}: {
  project: ComposeProject
  onAction: (id: string, action: ComposeAction) => void
  onDelete: (id: string) => void
  actionLoading: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isLoading = actionLoading === project.id

  return (
    <motion.div layout className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLOR[project.status] ?? 'bg-muted-foreground')} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{project.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{project.status}</p>
        </div>
        <div className="flex items-center gap-1">
          {project.status !== 'running' && (
            <button
              onClick={() => onAction(project.id, 'up')}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500 transition-colors disabled:opacity-50"
              title="Start"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          {project.status === 'running' && (
            <>
              <button
                onClick={() => onAction(project.id, 'restart')}
                disabled={isLoading}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Restart"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onAction(project.id, 'down')}
                disabled={isLoading}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors disabled:opacity-50"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(project.id)}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                compose.yml
              </div>
              <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                {project.compose_file}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateComposeRequest>({
    defaultValues: { name: '', compose_file: DEFAULT_COMPOSE },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateComposeRequest) => dockerApi.createComposeProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compose-projects'] })
      toast.success('Compose project created')
      onClose()
    },
    onError: () => toast.error('Failed to create project'),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">New Compose Project</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Project Name</label>
            <input
              {...register('name', { required: 'Name is required', pattern: { value: /^[a-z0-9-]+$/, message: 'lowercase, numbers, hyphens only' } })}
              placeholder="my-app"
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">docker-compose.yml</label>
            <textarea
              {...register('compose_file', { required: true })}
              rows={16}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-input bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Deploy
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function ComposePage() {
  const [showNew, setShowNew] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['compose-projects'],
    queryFn: () => dockerApi.listComposeProjects(),
    select: r => r.data,
    refetchInterval: 15_000,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: ComposeAction }) => dockerApi.composeAction(id, action),
    onMutate: ({ id }) => setActionLoading(id),
    onSettled: () => setActionLoading(null),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['compose-projects'] })
      toast.success(`Compose ${action} executed`)
    },
    onError: () => toast.error('Action failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dockerApi.deleteComposeProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compose-projects'] }); toast.success('Project deleted') },
    onError: () => toast.error('Failed to delete project'),
  })

  const projects = data?.projects ?? []
  const running = projects.filter(p => p.status === 'running').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/docker" className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Compose Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage multi-container Docker Compose applications
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Projects', value: projects.length },
          { label: 'Running',        value: running, green: true },
          { label: 'Stopped',        value: projects.length - running },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.green && running > 0 && 'text-green-500')}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Project List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No Compose projects yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Deploy your first multi-container app</p>
          <button onClick={() => setShowNew(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onAction={(id, action) => actionMutation.mutate({ id, action })}
              onDelete={id => deleteMutation.mutate(id)}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      </AnimatePresence>
    </div>
  )
}
