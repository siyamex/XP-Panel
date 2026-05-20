'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { redirectApi, type DomainRedirect } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function RedirectsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ domain: '', source_path: '/', destination: '', type: 301 as 301 | 302, wildcard: false })

  const { data, isLoading } = useQuery({
    queryKey: ['redirects'],
    queryFn: () => redirectApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => redirectApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['redirects'] })
      toast.success('Redirect created')
      setShowForm(false)
      setForm({ domain: '', source_path: '/', destination: '', type: 301, wildcard: false })
    },
    onError: () => toast.error('Failed to create redirect'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => redirectApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['redirects'] }); toast.success('Redirect deleted') },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domain Redirects</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage 301/302 redirects for your domains</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Redirect
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">New Redirect</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Domain</label>
              <input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source Path</label>
              <input value={form.source_path} onChange={e => setForm(f => ({ ...f, source_path: e.target.value }))}
                placeholder="/old-page" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Destination URL</label>
              <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="https://example.com/new-page" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: parseInt(e.target.value) as 301 | 302 }))}
                className="border border-input rounded px-2 py-1 text-xs bg-background">
                <option value={301}>301 Permanent</option>
                <option value={302}>302 Temporary</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.wildcard} onChange={e => setForm(f => ({ ...f, wildcard: e.target.checked }))}
                className="rounded" />
              <span className="text-muted-foreground">Wildcard redirect</span>
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={!form.domain || !form.destination || createMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Active Redirects ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.redirects.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No redirects configured</div>
        ) : (
          <div className="divide-y">
            {data.redirects.map((r: DomainRedirect) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-mono">
                      <span className="text-foreground">{r.domain}{r.source_path}</span>
                      <span className="text-muted-foreground mx-2">→</span>
                      <span className="text-primary">{r.destination}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.type === 301 ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>{r.type}</span>
                      {r.wildcard && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-muted">wildcard</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
