'use client'

import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

export interface Incident {
  id: string
  title: string
  severity: 'warning' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  server_name?: string
  metric?: string
  value?: number
  threshold?: number
  started_at: string
  resolved_at?: string
  duration_seconds?: number
}

interface IncidentTimelineProps {
  incidents: Incident[]
  loading?: boolean
  className?: string
}

const STATUS_CONFIG = {
  open:         { color: 'text-red-500',   bg: 'bg-red-500',   label: 'Open' },
  acknowledged: { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Ack' },
  resolved:     { color: 'text-green-500', bg: 'bg-green-500', label: 'Resolved' },
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function IncidentRow({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false)
  const { color, bg, label } = STATUS_CONFIG[incident.status]

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status dot */}
        <span className={cn('w-2 h-2 rounded-full shrink-0', bg)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{incident.title}</span>
            <span className={cn('text-xs font-medium shrink-0', color)}>{label}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {incident.server_name && <span>{incident.server_name}</span>}
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}</span>
            {incident.duration_seconds && (
              <span>· {formatDuration(incident.duration_seconds)}</span>
            )}
          </div>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs space-y-1.5">
          {incident.metric && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20">Metric</span>
              <span className="font-mono">{incident.metric}</span>
            </div>
          )}
          {incident.value !== undefined && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20">Value</span>
              <span className="font-mono font-medium text-red-500">{incident.value}</span>
              {incident.threshold !== undefined && (
                <span className="text-muted-foreground">(threshold: {incident.threshold})</span>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20">Started</span>
            <span className="font-mono">{format(new Date(incident.started_at), 'MMM d HH:mm:ss')}</span>
          </div>
          {incident.resolved_at && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20">Resolved</span>
              <span className="font-mono">{format(new Date(incident.resolved_at), 'MMM d HH:mm:ss')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function IncidentTimeline({ incidents, loading = false, className }: IncidentTimelineProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-10 text-center', className)}>
        <CheckCircle2 className="h-8 w-8 text-green-500/30 mb-2" />
        <p className="text-sm text-muted-foreground">No incidents</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {incidents.map(i => <IncidentRow key={i.id} incident={i} />)}
    </div>
  )
}
