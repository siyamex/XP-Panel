'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, XCircle, Shield, Server, Globe, Package } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  type: 'alert' | 'info' | 'success' | 'error' | 'security' | 'system'
  title: string
  body: string
  resource_type?: string
  resource_id?: string
  read: boolean
  created_at: string
}

const TYPE_CONFIG = {
  alert:    { icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  info:     { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  success:  { icon: CheckCircle2,  color: 'text-green-500',  bg: 'bg-green-500/10' },
  error:    { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-500/10' },
  security: { icon: Shield,        color: 'text-red-500',    bg: 'bg-red-500/10' },
  system:   { icon: Server,        color: 'text-purple-500', bg: 'bg-purple-500/10' },
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  domain:   Globe,
  server:   Server,
  app:      Package,
  security: Shield,
}

async function fetchNotifications(filter: string): Promise<Notification[]> {
  const params = filter !== 'all' ? `?${filter === 'unread' ? 'unread=true' : `type=${filter}`}` : ''
  const res = await apiClient.get(`/notifications${params}`)
  return res.data.notifications ?? []
}

async function markRead(id: string) {
  await apiClient.patch(`/notifications/${id}/read`)
}

async function markAllRead() {
  await apiClient.post('/notifications/read-all')
}

async function deleteNotification(id: string) {
  await apiClient.delete(`/notifications/${id}`)
}

const FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'unread',   label: 'Unread' },
  { value: 'alert',    label: 'Alerts' },
  { value: 'security', label: 'Security' },
  { value: 'system',   label: 'System' },
]

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => fetchNotifications(filter),
    refetchInterval: 30_000,
  })

  const markReadMut = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('All marked as read') },
  })

  const deleteMut = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-medium bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">System alerts and activity feed</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => markAllMut.mutate()}
          disabled={markAllMut.isPending || unreadCount === 0}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              filter === f.value
                ? 'bg-background shadow-sm text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === 'unread' ? 'All caught up!' : 'Nothing here yet.'}
            </p>
          </div>
        )}

        {notifications.map(n => {
          const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
          const Icon = cfg.icon
          const ResourceIcon = n.resource_type ? (RESOURCE_ICONS[n.resource_type] ?? Bell) : Bell

          return (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer',
                n.read
                  ? 'bg-card border-border hover:bg-accent/30'
                  : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
              )}
              onClick={() => !n.read && markReadMut.mutate(n.id)}
            >
              <div className={cn('rounded-full p-2 shrink-0', cfg.bg)}>
                <Icon className={cn('h-4 w-4', cfg.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMut.mutate(n.id) }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {(n.resource_type || !n.read) && (
                  <div className="flex items-center gap-3 mt-2">
                    {n.resource_type && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ResourceIcon className="h-3 w-3" />
                        {n.resource_type}
                        {n.resource_id && <span className="font-mono">{n.resource_id.slice(0, 8)}</span>}
                      </span>
                    )}
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 ml-auto" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
