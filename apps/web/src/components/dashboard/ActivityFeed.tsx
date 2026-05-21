'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  Globe, Database, Mail, Shield, HardDrive,
  Container, Package, User, Settings, Key,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface ActivityItem {
  id: string
  action: string
  resource_type: string
  resource_name?: string
  user?: string
  severity?: 'info' | 'success' | 'warning' | 'error'
  created_at: string
}

interface ActivityFeedProps {
  items: ActivityItem[]
  loading?: boolean
  maxItems?: number
  className?: string
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  domain:    Globe,
  database:  Database,
  mailbox:   Mail,
  security:  Shield,
  backup:    HardDrive,
  container: Container,
  app:       Package,
  user:      User,
  settings:  Settings,
  ssl:       Key,
}

const SEVERITY_CONFIG = {
  info:    { icon: Info,          color: 'text-blue-500',  bg: 'bg-blue-500/10' },
  success: { icon: CheckCircle2,  color: 'text-green-500', bg: 'bg-green-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  error:   { icon: AlertTriangle, color: 'text-red-500',   bg: 'bg-red-500/10' },
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const ResourceIcon = RESOURCE_ICONS[item.resource_type] ?? Info
  const sev = item.severity ?? 'info'
  const { color, bg } = SEVERITY_CONFIG[sev]

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn('rounded-md p-1.5 shrink-0 mt-0.5', bg)}>
        <ResourceIcon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-medium">{item.action}</span>
          {item.resource_name && (
            <span className="text-muted-foreground"> · {item.resource_name}</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.user && (
            <span className="text-xs text-muted-foreground">{item.user}</span>
          )}
          <span className="text-xs text-muted-foreground/60">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ActivityFeed({ items, loading = false, maxItems = 10, className }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-md bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-2.5 bg-muted animate-pulse rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <Info className="h-8 w-8 text-muted-foreground/20 mb-2" />
        <p className="text-sm text-muted-foreground">No recent activity</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {items.slice(0, maxItems).map(item => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  )
}
