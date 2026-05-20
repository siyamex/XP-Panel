'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity, Download } from 'lucide-react'
import { bandwidthApi } from '@/lib/api/hosting.api'

const PERIODS = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function BandwidthPage() {
  const [domain, setDomain] = useState('example.com')
  const [inputDomain, setInputDomain] = useState('example.com')
  const [period, setPeriod] = useState('24h')

  const { data, isLoading } = useQuery({
    queryKey: ['bandwidth', domain, period],
    queryFn: () => bandwidthApi.getDomainBandwidth(domain, period).then(r => r.data),
    enabled: !!domain,
  })

  const chartData = data?.points.map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    'Bytes In': Math.round(p.bytes_in / 1024 / 1024 * 100) / 100,
    'Bytes Out': Math.round(p.bytes_out / 1024 / 1024 * 100) / 100,
    'Requests/s': p.requests_per_sec,
  })) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bandwidth Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">Traffic analysis per domain</p>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <div className="flex-1 flex gap-2">
          <input value={inputDomain} onChange={e => setInputDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setDomain(inputDomain)}
            placeholder="example.com" className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={() => setDomain(inputDomain)} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            Load
          </button>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${period === p.value ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total Inbound</p>
            <p className="text-2xl font-bold mt-1">{formatBytes(data.total_in)}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Total Outbound</p>
            <p className="text-2xl font-bold mt-1">{formatBytes(data.total_out)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Traffic — {domain}</h2>
        </div>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} unit=" MB" />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v} MB`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Bytes In" stroke="#6366f1" fill="url(#colorIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="Bytes Out" stroke="#22c55e" fill="url(#colorOut)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Access log download */}
      <div className="bg-card border rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Raw Access Logs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Download the raw Nginx access log for {domain}</p>
        </div>
        <a href={`/api/v1/monitoring/logs/${domain}`} download
          className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
          <Download className="h-4 w-4" />Download Log
        </a>
      </div>
    </div>
  )
}
