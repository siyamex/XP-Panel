import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from './useWebSocket'

export interface ServerMetrics {
  server_id: string
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

interface UseServerMetricsOptions {
  serverID: string
  historySize?: number
  enabled?: boolean
}

interface UseServerMetricsReturn {
  live: ServerMetrics | null
  history: ServerMetrics[]
  connected: boolean
}

const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080').replace(/\/+$/, '')

export function useServerMetrics({
  serverID,
  historySize = 60,
  enabled = true,
}: UseServerMetricsOptions): UseServerMetricsReturn {
  const [live, setLive] = useState<ServerMetrics | null>(null)
  const [history, setHistory] = useState<ServerMetrics[]>([])
  const [connected, setConnected] = useState(false)

  const { status } = useWebSocket<ServerMetrics>({
    url: `${WS_BASE}/ws/metrics/${serverID}`,
    enabled: enabled && !!serverID,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
    onMessage: (data) => {
      setLive(data)
      setHistory(prev => [...prev.slice(-(historySize - 1)), data])
    },
  })

  useEffect(() => {
    if (status !== 'open') setConnected(false)
  }, [status])

  return { live, history, connected }
}
