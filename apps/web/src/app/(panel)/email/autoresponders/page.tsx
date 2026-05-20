'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { autoresponderApi, type Autoresponder } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

const blank = { email: '', subject: '', body: '', from_name: '', start_at: '', end_at: '' }

export default function AutorespondersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)

  const { data, isLoading } = useQuery({
    queryKey: ['autoresponders'],
    queryFn: () => autoresponderApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof blank) => autoresponderApi.create({
      email: d.email, subject: d.subject, body: d.body,
      from_name: d.from_name || undefined,
      start_at: d.start_at || undefined,
      end_at: d.end_at || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['autoresponders'] }); toast.success('Autoresponder created'); setShowForm(false); setForm(blank) },
    onError: () => toast.error('Failed to create autoresponder'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => autoresponderApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['autoresponders'] }); toast.success('Autoresponder deleted') },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      autoresponderApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autoresponders'] }),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Autoresponders</h1>
          <p className="text-muted-foreground text-sm mt-1">Automatic email replies for your mailboxes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Autoresponder
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">New Autoresponder</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email Address</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contact@example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">From Name (optional)</label>
              <input value={form.from_name} onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
                placeholder="John Doe" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="I'm currently out of office" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Date (optional)</label>
              <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Date (optional)</label>
              <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Message Body</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={4} placeholder="Thank you for your email. I will be back on..."
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={!form.email || !form.subject || !form.body || createMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Autoresponders ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.autoresponders.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No autoresponders configured</div>
        ) : (
          <div className="divide-y">
            {data.autoresponders.map((a: Autoresponder) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{a.email}</p>
                    <p className="text-xs text-muted-foreground">{a.subject}</p>
                    {(a.start_at || a.end_at) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.start_at && `From ${new Date(a.start_at).toLocaleDateString()}`}
                        {a.end_at && ` until ${new Date(a.end_at).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleMutation.mutate({ id: a.id, enabled: !a.enabled })}>
                    {a.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
