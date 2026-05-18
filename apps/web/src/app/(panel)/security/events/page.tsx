'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Loader2, Globe, AlertTriangle, Info } from 'lucide-react'
import { securityApi } from '@/lib/api/security.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

const SEVERITY_CONFIG = {
  info:     { color: 'text-blue-500 bg-blue-500/10',        icon: Info },
  warning:  { color: 'text-amber-500 bg-amber-500/10',      icon: AlertTriangle },
  critical: { color: 'text-destructive bg-destructive/10',  icon: ShieldAlert },
}

export default function SecurityEventsPage() {
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['security-events'],
    queryFn: () => securityApi.listEvents(),
    select: (r) => r.data,
    refetchInterval: 15000,
  })

  const blockMutation = useMutation({
    mutationFn: (ip: string) => securityApi.blockIP({ ip, reason: 'Blocked from security events' }),
    onSuccess: () => { toast.success('IP added to blocklist') },
    onError: () => toast.error('Failed to block IP'),
  })

  const events = (data?.events ?? []).filter((e) => filter === 'all' || e.severity === filter)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-bold">Security Events</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
          {(['all', 'info', 'warning', 'critical'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 text-xs rounded-md capitalize transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ShieldAlert className="w-10 h-10 mb-2 opacity-30" />
            No security events
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Severity</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source IP</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Country</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Target</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const cfg = SEVERITY_CONFIG[e.severity] ?? SEVERITY_CONFIG.info
                return (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="capitalize text-sm">{e.type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit capitalize', cfg.color)}>
                        <cfg.icon className="w-3 h-3" />{e.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{e.source_ip ?? '—'}</td>
                    <td className="px-4 py-3">
                      {e.source_country ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Globe className="w-3 h-3 text-muted-foreground" />{e.source_country}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[140px]">{e.target ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {e.source_ip && (
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => blockMutation.mutate(e.source_ip!)} className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            Block IP
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
