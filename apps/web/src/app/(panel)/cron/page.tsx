'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, Terminal } from 'lucide-react'
import { cronApi, type CronJob } from '@/lib/api/cron.api'
import { toast } from 'sonner'

const PRESETS = [
  { label: 'Every minute', minute: '*', hour: '*', day_month: '*', month: '*', day_week: '*' },
  { label: 'Every hour', minute: '0', hour: '*', day_month: '*', month: '*', day_week: '*' },
  { label: 'Every day at midnight', minute: '0', hour: '0', day_month: '*', month: '*', day_week: '*' },
  { label: 'Every week (Sunday)', minute: '0', hour: '0', day_month: '*', month: '*', day_week: '0' },
  { label: 'Every month', minute: '0', hour: '0', day_month: '1', month: '*', day_week: '*' },
]

const blank = { label: '', command: '', minute: '*', hour: '*', day_month: '*', month: '*', day_week: '*' }

export default function CronPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: () => cronApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof blank) => cronApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cron-jobs'] }); toast.success('Cron job created'); setShowForm(false); setForm(blank) },
    onError: () => toast.error('Failed to create cron job'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cronApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cron-jobs'] }); toast.success('Cron job deleted') },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => cronApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron-jobs'] }),
  })

  const applyPreset = (p: typeof PRESETS[0]) => setForm(f => ({ ...f, ...p }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cron Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule recurring tasks for your domains</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Cron Job
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">New Cron Job</h2>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className="text-xs px-2.5 py-1 border rounded-full hover:bg-muted transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Daily backup" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Command</label>
              <input value={form.command} onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                placeholder="/usr/bin/php /var/www/site/artisan schedule:run" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Schedule fields */}
          <div className="grid grid-cols-5 gap-2">
            {(['minute', 'hour', 'day_month', 'month', 'day_week'] as const).map(field => (
              <div key={field}>
                <label className="text-xs font-medium text-muted-foreground capitalize">{field.replace('_', ' ')}</label>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="mt-1 w-full border border-input rounded-lg px-2 py-2 text-sm bg-background font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-3 py-2">
            {form.minute} {form.hour} {form.day_month} {form.month} {form.day_week}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={!form.label || !form.command || createMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Jobs list */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Active Jobs ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.jobs.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No cron jobs yet</div>
        ) : (
          <div className="divide-y">
            {data.jobs.map(job => (
              <CronRow key={job.id} job={job}
                onDelete={() => deleteMutation.mutate(job.id)}
                onToggle={() => toggleMutation.mutate(job.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CronRow({ job, onDelete, onToggle }: { job: CronJob; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">{job.label}</p>
          <p className="text-xs font-mono text-muted-foreground">{job.command}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{job.schedule}</span>
            {job.last_run_at && <span className="ml-2">Last run: {new Date(job.last_run_at).toLocaleString()}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
          {job.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
