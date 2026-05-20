'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Plus, Trash2, Globe } from 'lucide-react'
import { mysqlRemoteApi, type MySQLRemoteEntry } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function MySQLRemotePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ip_address: '', label: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['mysql-remote'],
    queryFn: () => mysqlRemoteApi.list().then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (d: typeof form) => mysqlRemoteApi.add({ ip_address: d.ip_address, label: d.label || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mysql-remote'] })
      toast.success('IP address added')
      setShowForm(false)
      setForm({ ip_address: '', label: '' })
    },
    onError: () => toast.error('Failed to add IP address'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mysqlRemoteApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mysql-remote'] }); toast.success('IP address removed') },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remote MySQL Access</h1>
          <p className="text-muted-foreground text-sm mt-1">Allow external IP addresses to connect to MySQL/MariaDB</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add IP Address
        </button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-600 dark:text-amber-400">
        <strong>Security Warning:</strong> Allowing remote MySQL access increases your attack surface. Only whitelist trusted IP addresses and use strong passwords.
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Allow IP Address</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">IP Address</label>
              <input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                placeholder="192.168.1.100 or 10.0.0.0/24" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Office server" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => addMutation.mutate(form)} disabled={!form.ip_address || addMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Allow Access
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Allowed IP Addresses ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.entries.length ? (
          <div className="p-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No external IPs allowed</p>
            <p className="text-xs text-muted-foreground mt-1">MySQL is only accessible from localhost by default</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.entries.map((e: MySQLRemoteEntry) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-mono font-medium">{e.ip_address}</p>
                    {e.label && <p className="text-xs text-muted-foreground">{e.label}</p>}
                    <p className="text-xs text-muted-foreground">Added {new Date(e.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(e.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
