'use client'

import { use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, GitBranch, Tag } from 'lucide-react'
import { devopsApi } from '@/lib/api/devops.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState } from 'react'

const RUN_STATUS = {
  running:   { color: 'text-blue-500 bg-blue-500/10',       icon: Loader2 },
  success:   { color: 'text-green-500 bg-green-500/10',     icon: CheckCircle2 },
  failed:    { color: 'text-destructive bg-destructive/10', icon: XCircle },
  cancelled: { color: 'text-muted-foreground bg-muted',     icon: XCircle },
}

const STEP_STATUS: Record<string, string> = {
  success: 'text-green-500',
  failed:  'text-destructive',
  skipped: 'text-muted-foreground',
}

export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => devopsApi.getPipeline(id),
    select: (r) => r.data,
  })

  const { data: runsData } = useQuery({
    queryKey: ['pipeline-runs', id],
    queryFn: () => devopsApi.listRuns(id),
    select: (r) => r.data,
    refetchInterval: 5000,
  })

  const triggerMutation = useMutation({
    mutationFn: () => devopsApi.triggerRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-runs', id] })
      qc.invalidateQueries({ queryKey: ['pipeline', id] })
      toast.success('Run triggered')
    },
    onError: () => toast.error('Failed to trigger run'),
  })

  const runs = runsData?.runs ?? []

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!pipeline) return <div className="p-6 text-muted-foreground">Pipeline not found.</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/devops" className="text-sm text-muted-foreground hover:text-foreground transition-colors">DevOps</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">{pipeline.name}</h1>
        </div>
        <button
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending || pipeline.status === 'running'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {triggerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Pipeline
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Branch', value: pipeline.branch, icon: GitBranch },
          { label: 'Trigger', value: pipeline.trigger, icon: Tag },
          { label: 'Steps', value: String(pipeline.steps?.length ?? 0), icon: Clock },
          { label: 'Total Runs', value: String(runs.length), icon: Play },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs">{label}</span>
            </div>
            <div className="font-semibold text-sm capitalize">{value}</div>
          </div>
        ))}
      </div>

      {pipeline.steps?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Pipeline Steps</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {pipeline.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg text-sm">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium">{step.name}</span>
                  {step.image && <span className="text-xs text-muted-foreground font-mono">{step.image}</span>}
                </div>
                {i < pipeline.steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold">Run History</h3></div>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            No runs yet
          </div>
        ) : (
          <div className="divide-y divide-border">
            {runs.map((run) => {
              const cfg = RUN_STATUS[run.status] ?? RUN_STATUS.cancelled
              const Icon = cfg.icon
              const isExpanded = expandedRun === run.id
              return (
                <div key={run.id}>
                  <button
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  >
                    <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize w-24 justify-center', cfg.color)}>
                      <Icon className={cn('w-3 h-3', run.status === 'running' && 'animate-spin')} />
                      {run.status}
                    </span>
                    <div className="flex-1 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{run.commit_sha?.substring(0, 7)}</span>
                      {run.commit_message && <span className="ml-2 text-sm">{run.commit_message}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {run.duration_seconds != null ? `${run.duration_seconds}s` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && run.step_results?.length > 0 && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {run.step_results.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 text-xs">
                          <span className={cn('font-bold shrink-0 mt-0.5', STEP_STATUS[step.status] ?? 'text-muted-foreground')}>
                            {step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '—'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{step.name}</div>
                            {step.output && <div className="font-mono text-muted-foreground mt-1 whitespace-pre-wrap">{step.output}</div>}
                          </div>
                          <span className="text-muted-foreground shrink-0">{step.duration_ms}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
