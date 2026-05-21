'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint {
  timestamp: string
  bytes_in: number
  bytes_out: number
  requests?: number
}

interface BandwidthChartProps {
  data: DataPoint[]
  height?: number
  showLegend?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTime(ts: string): string {
  try { return format(parseISO(ts), 'HH:mm') } catch { return ts }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="capitalize">{entry.name}:</span>
          <span className="font-mono font-medium">{formatBytes(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function BandwidthChart({ data, height = 200, showLegend = true }: BandwidthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatBytes}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => <span className="text-muted-foreground capitalize">{v}</span>}
          />
        )}
        <Area
          type="monotone"
          dataKey="bytes_in"
          name="Inbound"
          stroke="#3b82f6"
          strokeWidth={1.5}
          fill="url(#gradIn)"
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Area
          type="monotone"
          dataKey="bytes_out"
          name="Outbound"
          stroke="#22c55e"
          strokeWidth={1.5}
          fill="url(#gradOut)"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
