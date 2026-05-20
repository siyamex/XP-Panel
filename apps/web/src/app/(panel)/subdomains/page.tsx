'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Plus, Trash2, ExternalLink } from 'lucide-react'
import { subdomainApi, type Subdomain } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function SubdomainsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ domain: '', subdomain: '', document_root: '', redirect_to: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['subdomains'],
    queryFn: () => subdomainApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => subdomainApi.create({
      domain: d.domain, subdomain: d.subdomain,
      document_root: d.document_root || `/var/www/${d.domain}/${d.subdomain}`,
      redirect_to: d.redirect_to || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subdomains'] }); toast.success('Subdomain created'); setShowForm(false); setForm({ domain: '', subdomain: '', document_root: '', redirect_to: '' }) },
    onError: () => toast.error('Failed to create subdomain'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subdomainApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subdomains'] }); toast.success('Subdomain deleted') },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subdomains</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage subdomains for your domains</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Subdomain
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">New Subdomain</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Domain</label>
              <input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subdomain</label>
              <input value={form.subdomain} onChange={e => setForm(f => ({ ...f, subdomain: e.target.value }))}
                placeholder="blog" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Document Root (optional)</label>
              <input value={form.document_root} onChange={e => setForm(f => ({ ...f, document_root: e.target.value }))}
                placeholder="/var/www/example.com/blog" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Redirect to (optional)</label>
              <input value={form.redirect_to} onChange={e => setForm(f => ({ ...f, redirect_to: e.target.value }))}
                placeholder="https://example.com/blog" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {form.domain && form.subdomain && (
            <p className="text-xs text-muted-foreground">
              Full URL: <span className="font-mono text-foreground">{form.subdomain}.{form.domain}</span>
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={!form.domain || !form.subdomain || createMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Subdomains ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.subdomains.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No subdomains yet</div>
        ) : (
          <div className="divide-y">
            {data.subdomains.map((s: Subdomain) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium font-mono">{s.subdomain}.{s.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.redirect_to ? `→ ${s.redirect_to}` : s.document_root}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`https://${s.subdomain}.${s.domain}`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => deleteMutation.mutate(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
