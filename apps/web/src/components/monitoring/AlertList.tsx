'use client'

import { AlertTriangle, CheckCircle2, Bell, BellOff, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

export interface AlertRule {
  id: string
  name: string
  metric: string
  condition: string
  threshold: number
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  server_name?: string
  last_triggered?: string
  trigger_count?: number
}

interface AlertListProps {
  rules: AlertRule[]
  onToggle?: (id: string, enabled: boolean) => void
  onDelete?: (id: string) => void
  loading?: boolean
  className?: string
}

const SEVERITY_CONFIG = {
  info:     { color: 'text-blue-500',  bg: 'bg-blue-500/10',  label: 'Info' },
  warning:  { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Warning' },
  critical: { color: 'text-red-500',   bg: 'bg-red-500/10',   label: 'Critical' },
}

export function AlertList({ rules, onToggle, onDelete, loading = false, className }: AlertListProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-10 text-center', className)}>
        <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
        <p className="text-sm text-muted-foreground">No alert rules configured</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {rules.map(rule => {
        const { color, bg, label } = SEVERITY_CONFIG[rule.severity]
        return (
          <div
            key={rule.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-opacity',
              rule.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
            )}
          >
            <div className={cn('rounded-md p-1.5 shrink-0', bg)}>
              <AlertTriangle className={cn('h-3.5 w-3.5', color)} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{rule.name}</span>
                <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', bg, color)}>{label}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {rule.metric} {rule.condition} {rule.threshold}
                {rule.server_name && <span> · {rule.server_name}</span>}
                {rule.last_triggered && (
                  <span> · last {formatDistanceToNow(new Date(rule.last_triggered), { addSuffix: true })}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {rule.trigger_count !== undefined && rule.trigger_count > 0 && (
                <span className="text-xs font-mono text-muted-foreground">{rule.trigger_count}×</span>
              )}
              {onToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggle(rule.id, !rule.enabled)}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  {rule.enabled
                    ? <Bell className="h-3.5 w-3.5 text-primary" />
                    : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
