'use client'

import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { securityApi } from '@/lib/api/security.api'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

export default function SecurityPage() {
  const { data: score, isLoading } = useQuery({
    queryKey: ['security-score'],
    queryFn: () => securityApi.getScore(),
    select: (r) => r.data,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['security-events'],
    queryFn: () => securityApi.listEvents(),
    select: (r) => r.data,
  })

  const events = eventsData?.events ?? []
  const recentEvents = events.slice(0, 5)

  const gradeColor = score
    ? score.grade === 'A' ? 'text-green-500' :
      score.grade === 'B' ? 'text-blue-500' :
      score.grade === 'C' ? 'text-amber-500' : 'text-destructive'
    : ''

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Security score, firewall, and threat detection</p>
        </div>
        <div className="flex gap-2">
          <Link href="/security/firewall" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Firewall</Link>
          <Link href="/security/events" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Events</Link>
          <Link href="/security/scanner" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Scanner</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : score ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Score card */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <div className={cn('text-7xl font-black mb-2', gradeColor)}>{score.grade}</div>
            <div className="text-sm text-muted-foreground">{score.score}/{score.max_score} points</div>
            <div className="w-full bg-muted rounded-full h-2 mt-3">
              <div
                className={cn('h-full rounded-full transition-all', score.grade === 'A' ? 'bg-green-500' : score.grade === 'B' ? 'bg-blue-500' : score.grade === 'C' ? 'bg-amber-500' : 'bg-destructive')}
                style={{ width: `${(score.score / score.max_score) * 100}%` }}
              />
            </div>
          </div>

          {/* Checks */}
          <div className="col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Security Checks</h3>
            <div className="space-y-2">
              {score.checks.map((ch) => (
                <div key={ch.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {ch.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{ch.name}</div>
                      <div className="text-xs text-muted-foreground">{ch.message}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{ch.weight}pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Firewall Rules', href: '/security/firewall', icon: ShieldCheck, desc: 'Manage nftables rules' },
          { label: 'Security Events', href: '/security/events', icon: AlertTriangle, desc: `${events.length} recent events` },
          { label: 'Malware Scanner', href: '/security/scanner', icon: ShieldAlert, desc: 'ClamAV integration' },
        ].map(({ label, href, icon: Icon, desc }) => (
          <Link key={label} href={href} className="bg-card border border-border rounded-xl p-4 hover:bg-muted/20 transition-colors">
            <Icon className="w-5 h-5 text-primary mb-2" />
            <div className="font-medium text-sm">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </Link>
        ))}
      </div>

      {recentEvents.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Recent Security Events</h3>
            <Link href="/security/events" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className={cn('w-1.5 h-1.5 rounded-full', e.severity === 'critical' ? 'bg-destructive' : e.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500')} />
                  <div>
                    <span className="font-medium capitalize">{e.type.replace(/_/g, ' ')}</span>
                    {e.source_ip && <span className="text-muted-foreground ml-2 font-mono text-xs">{e.source_ip}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
