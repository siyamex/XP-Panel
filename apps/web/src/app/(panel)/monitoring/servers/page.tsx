'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Plus, Trash2, Copy, CheckCircle2, Clock, WifiOff, AreaChart } from 'lucide-react'
import { monitoringApi, type MonitoredServer } from '@/lib/api/monitoring.api'
import Link from 'next/link'
import { toast } from 'sonner'

function statusBadge(s: MonitoredServer['status']) {
  const map = {
    active:   'bg-green-500/10 text-green-600 border-green-500/20',
    offline:  'bg-red-500/10 text-red-500 border-red-500/20',
    disabled: 'bg-muted text-muted-foreground border-border',
  }
  return map[s] ?? map.disabled
}

function lastSeen(ts: string | null) {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function ServersPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ hostname: '', ip_address: '' })
  const [newKey, setNewKey] = useState<{ id: string; hostname: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['monitored-servers'],
    queryFn: () => monitoringApi.listServers().then(r => r.data),
    refetchInterval: 15_000,
  })

  const addMutation = useMutation({
    mutationFn: () => monitoringApi.registerServer(form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['monitored-servers'] })
      setNewKey({ id: res.data.id, hostname: form.hostname, key: res.data.api_key })
      setShowAdd(false)
      setForm({ hostname: '', ip_address: '' })
      toast.success('Server registered')
    },
    onError: () => toast.error('Failed to register server'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => monitoringApi.deleteServer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monitored-servers'] }); toast.success('Server removed') },
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitored Servers</h1>
          <p className="text-muted-foreground text-sm mt-1">Add servers and install the agent to collect real-time metrics</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Server
        </button>
      </div>

      {/* New API key reveal */}
      {newKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Server registered — copy this API key now. It will not be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs font-mono bg-background border border-border rounded-lg px-3 py-2 break-all">
              {newKey.key}
            </code>
            <button onClick={() => copy(newKey.key)}
              className="shrink-0 px-3 py-2 border rounded-lg text-sm hover:bg-muted flex items-center gap-1">
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Install the agent: <code className="bg-muted px-1 py-0.5 rounded">xp-agent -key {newKey.key} -server https://your-panel.example.com</code>
          </p>
          <button onClick={() => setNewKey(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Register New Server</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hostname *</label>
              <input value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
                placeholder="web01.example.com"
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">IP Address</label>
              <input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                placeholder="192.168.1.1"
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => addMutation.mutate()} disabled={!form.hostname || addMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Register
            </button>
          </div>
        </div>
      )}

      {/* Server list */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Servers ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.servers.length ? (
          <div className="p-8 text-center">
            <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No servers registered yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.servers.map((s: MonitoredServer) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.hostname}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {s.ip_address && <span>{s.ip_address}</span>}
                      {s.agent_version && <span>v{s.agent_version}</span>}
                      <span className="flex items-center gap-1">
                        {s.status === 'active'
                          ? <Clock className="h-3 w-3" />
                          : <WifiOff className="h-3 w-3" />}
                        {lastSeen(s.last_seen_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/monitoring?server=${s.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors">
                    <AreaChart className="h-3.5 w-3.5" />Metrics
                  </Link>
                  <button onClick={() => deleteMutation.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent install instructions */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Agent Installation</h2>
        <p className="text-xs text-muted-foreground">After registering a server, run the following on that server:</p>
        <div className="space-y-2">
          <div className="bg-muted rounded-lg px-4 py-3 font-mono text-xs">
            <span className="text-muted-foreground"># Download agent binary</span>
            <br />
            curl -fsSL https://install.xp-panel.io/agent | bash
          </div>
          <div className="bg-muted rounded-lg px-4 py-3 font-mono text-xs">
            <span className="text-muted-foreground"># Run with systemd (recommended)</span>
            <br />
            xp-agent -key YOUR_API_KEY -server https://your-panel.example.com
          </div>
        </div>
      </div>
    </div>
  )
}
