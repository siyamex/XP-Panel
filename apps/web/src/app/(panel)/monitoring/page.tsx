'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cpu, MemoryStick, HardDrive, Wifi, AlertTriangle, CheckCircle2, Clock, Server } from 'lucide-react'
import { monitoringApi } from '@/lib/api/monitoring.api'
import type { ServerMetrics, Incident } from '@/types/monitoring.types'
import { cn } from '@/lib/utils/cn'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function MetricCard({ label, value, max, unit, icon: Icon, color }: {
  label: string; value: number; max: number; unit: string; icon: any; color: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  const isHigh = pct > 85
  const isMed = pct > 60

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', color)} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className={cn('text-lg font-bold tabular-nums', isHigh ? 'text-destructive' : isMed ? 'text-amber-500' : 'text-foreground')}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', isHigh ? 'bg-destructive' : isMed ? 'bg-amber-500' : color.replace('text-', 'bg-'))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function MonitoringPage() {
  const searchParams = useSearchParams()
  const serverID = searchParams.get('server') ?? 'local'

  const [wsMetrics, setWsMetrics] = useState<ServerMetrics | null>(null)
  const [history, setHistory] = useState<Array<{ time: string; cpu: number; ram: number; disk: number }>>([])
  const wsRef = useRef<WebSocket | null>(null)

  const { data: serversData } = useQuery({
    queryKey: ['monitored-servers'],
    queryFn: () => monitoringApi.listServers().then(r => r.data),
  })

  const { data: apiMetrics } = useQuery({
    queryKey: ['metrics-current', serverID],
    queryFn: () => monitoringApi.getCurrentMetrics(serverID === 'local' ? undefined : serverID),
    select: (r) => r.data,
    refetchInterval: 10000,
  })

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => monitoringApi.listIncidents(),
    select: (r) => r.data,
  })

  const metrics = wsMetrics ?? apiMetrics

  useEffect(() => {
    setWsMetrics(null)
    setHistory([])
    const params = serverID !== 'local' ? `?server_id=${serverID}` : ''
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080') + '/api/v1/monitoring/metrics/stream' + params
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const m: ServerMetrics = JSON.parse(ev.data)
        setWsMetrics(m)
        setHistory((prev) => {
          const entry = {
            time: new Date(m.timestamp).toLocaleTimeString(),
            cpu: m.cpu_percent,
            ram: m.ram_percent,
            disk: m.disk_percent,
          }
          return [...prev.slice(-29), entry]
        })
      } catch {}
    }

    return () => ws.close()
  }, [serverID])

  const incidents = incidentsData?.incidents ?? []
  const openIncidents = incidents.filter((i) => i.status === 'open')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time server metrics and alerting</p>
        </div>
        <div className="flex gap-2 items-center">
          {serversData?.servers.length ? (
            <select
              value={serverID}
              onChange={e => {
                const url = new URL(window.location.href)
                if (e.target.value === 'local') url.searchParams.delete('server')
                else url.searchParams.set('server', e.target.value)
                window.history.pushState({}, '', url)
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="local">Local (this server)</option>
              {serversData.servers.map(s => (
                <option key={s.id} value={s.id}>{s.hostname}</option>
              ))}
            </select>
          ) : null}
          <Link href="/monitoring/servers" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
            <Server className="h-3.5 w-3.5" />Servers
          </Link>
          <Link href="/monitoring/alerts" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Alerts</Link>
          <Link href="/monitoring/logs" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Logs</Link>
        </div>
      </div>

      {openIncidents.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium">{openIncidents.length} open incident{openIncidents.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">{openIncidents[0]?.title}</p>
          </div>
        </div>
      )}

      {metrics ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="CPU Usage" value={metrics.cpu_percent} max={100} unit="%" icon={Cpu} color="text-blue-500" />
            <MetricCard label="RAM Usage" value={metrics.ram_percent} max={100} unit="%" icon={MemoryStick} color="text-purple-500" />
            <MetricCard label="Disk Usage" value={metrics.disk_percent} max={100} unit="%" icon={HardDrive} color="text-orange-500" />
            <MetricCard label="Network In" value={metrics.net_in_mb_s} max={1000} unit=" MB/s" icon={Wifi} color="text-green-500" />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Load (1m)', value: metrics.load_avg_1.toFixed(2) },
              { label: 'Load (5m)', value: metrics.load_avg_5.toFixed(2) },
              { label: 'Processes', value: metrics.processes.toString() },
              { label: 'Uptime', value: `${Math.floor(metrics.uptime / 3600)}h` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className="text-xl font-bold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          {history.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Live Metrics (last 30s)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2} fill="url(#cpuGrad)" dot={false} />
                  <Area type="monotone" dataKey="ram" name="RAM %" stroke="#a855f7" strokeWidth={2} fill="url(#ramGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="bg-card border border-border rounded-xl p-4 h-20 animate-pulse" />)}
        </div>
      )}

      {incidents.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Recent Incidents</h3>
            <Link href="/monitoring/alerts" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-border">
            {incidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {inc.status === 'resolved' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : inc.status === 'open' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  <span>{inc.title}</span>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', inc.severity === 'critical' ? 'bg-destructive/10 text-destructive' : inc.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground')}>
                  {inc.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
