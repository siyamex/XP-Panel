'use client'

import { useEffect, useRef, useState } from 'react'
import { Activity, Cpu, MemoryStick, HardDrive, Wifi } from 'lucide-react'
import { MetricsChart } from '@/components/charts/MetricsChart'
import { ResourceGauge } from '@/components/charts/ResourceGauge'
import { cn } from '@/lib/utils/cn'

export interface LiveMetrics {
  timestamp: string
  cpu_percent: number
  ram_percent: number
  disk_percent: number
  net_in_mb_s: number
  net_out_mb_s: number
  load_avg_1: number
  load_avg_5: number
  load_avg_15: number
  process_count: number
}

interface MetricsDashboardProps {
  serverID: string
  wsURL?: string
  className?: string
}

const MAX_HISTORY = 60  // keep 60 data points (~10 min at 10s interval)

export function MetricsDashboard({ serverID, wsURL, className }: MetricsDashboardProps) {
  const [live, setLive] = useState<LiveMetrics | null>(null)
  const [history, setHistory] = useState<LiveMetrics[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const url = wsURL
      ?? `${(process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080').replace(/\/+$/, '')}/api/v1/monitoring/ws/${serverID}`

    const connect = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000) // auto-reconnect
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try {
          const data: LiveMetrics = JSON.parse(e.data)
          setLive(data)
          setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), data])
        } catch { /* ignore parse errors */ }
      }
    }
    connect()
    return () => { wsRef.current?.close() }
  }, [serverID, wsURL])

  const gauges = [
    { value: live?.cpu_percent ?? 0,  label: 'CPU',  icon: Cpu },
    { value: live?.ram_percent ?? 0,  label: 'RAM',  icon: MemoryStick },
    { value: live?.disk_percent ?? 0, label: 'Disk', icon: HardDrive },
  ]

  const chartData = history.map(m => ({
    timestamp: m.timestamp,
    CPU: Math.round(m.cpu_percent),
    RAM: Math.round(m.ram_percent),
    Disk: Math.round(m.disk_percent),
  }))

  return (
    <div className={cn('space-y-4', className)}>
      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground')} />
        {connected ? 'Live' : 'Reconnecting…'}
        {live && (
          <span>· Updated {new Date(live.timestamp).toLocaleTimeString()}</span>
        )}
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-3 gap-4">
        {gauges.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
            <ResourceGauge value={value} label={label} size="lg" />
          </div>
        ))}
      </div>

      {/* Network quick stats */}
      {live && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Wifi,     label: '↓ In',      value: `${live.net_in_mb_s.toFixed(1)} MB/s` },
            { icon: Wifi,     label: '↑ Out',     value: `${live.net_out_mb_s.toFixed(1)} MB/s` },
            { icon: Activity, label: 'Load (1m)', value: live.load_avg_1.toFixed(2) },
            { icon: Activity, label: 'Processes', value: live.process_count.toString() },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Icon className="h-3 w-3" />
                {label}
              </div>
              <div className="text-sm font-bold font-mono tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* History chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3">Resource History</div>
          <MetricsChart data={chartData} height={160} />
        </div>
      )}
    </div>
  )
}
