'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Filter, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { emailFilterApi, type EmailFilter } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

const ACTIONS = [
  { value: 'move', label: 'Move to folder' },
  { value: 'delete', label: 'Delete' },
  { value: 'mark_read', label: 'Mark as read' },
  { value: 'mark_spam', label: 'Mark as spam' },
  { value: 'forward', label: 'Forward to' },
  { value: 'reject', label: 'Reject with message' },
]

const RULE_FIELDS = ['subject', 'from', 'to', 'body', 'header']
const RULE_CONDITIONS = ['contains', 'not_contains', 'equals', 'starts_with', 'ends_with', 'regex']

type RuleRow = { field: string; condition: string; value: string }
const blankRule: RuleRow = { field: 'subject', condition: 'contains', value: '' }

export default function EmailFiltersPage() {
  const qc = useQueryClient()
  const [mailbox, setMailbox] = useState('')
  const [inputMailbox, setInputMailbox] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', rules: [blankRule] as RuleRow[], action: 'move', action_value: '', priority: 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['email-filters', mailbox],
    queryFn: () => emailFilterApi.list(mailbox).then(r => r.data),
    enabled: !!mailbox,
  })

  const createMutation = useMutation({
    mutationFn: () => emailFilterApi.create({ mailbox, name: form.name, rules: form.rules, action: form.action, action_value: form.action_value || undefined, priority: form.priority }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-filters'] }); toast.success('Filter created'); setShowForm(false) },
    onError: () => toast.error('Failed to create filter'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailFilterApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-filters'] }); toast.success('Filter deleted') },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => emailFilterApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-filters'] }),
  })

  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, { ...blankRule }] }))
  const updateRule = (i: number, key: keyof RuleRow, val: string) =>
    setForm(f => ({ ...f, rules: f.rules.map((r, idx) => idx === i ? { ...r, [key]: val } : r) }))
  const removeRule = (i: number) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Filters</h1>
        <p className="text-muted-foreground text-sm mt-1">Create Sieve-style rules to automatically process incoming email</p>
      </div>

      {/* Mailbox selector */}
      <div className="flex gap-2">
        <input value={inputMailbox} onChange={e => setInputMailbox(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setMailbox(inputMailbox)}
          placeholder="user@example.com" className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={() => setMailbox(inputMailbox)} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Load Filters
        </button>
      </div>

      {mailbox && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Filters for <span className="font-medium text-foreground">{mailbox}</span></p>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />Add Filter
            </button>
          </div>

          {showForm && (
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-sm">New Filter</h2>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Filter Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Block newsletters" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Rules (ALL must match)</label>
                  <button onClick={addRule} className="text-xs text-primary hover:underline">+ Add rule</button>
                </div>
                <div className="space-y-2">
                  {form.rules.map((rule, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={rule.field} onChange={e => updateRule(i, 'field', e.target.value)}
                        className="border border-input rounded px-2 py-1.5 text-xs bg-background">
                        {RULE_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <select value={rule.condition} onChange={e => updateRule(i, 'condition', e.target.value)}
                        className="border border-input rounded px-2 py-1.5 text-xs bg-background">
                        {RULE_CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                      <input value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)}
                        placeholder="value" className="flex-1 border border-input rounded px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                      {form.rules.length > 1 && (
                        <button onClick={() => removeRule(i)} className="text-muted-foreground hover:text-destructive">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Action</label>
                  <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                    className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">
                    {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                {['move', 'forward', 'reject'].includes(form.action) && (
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {form.action === 'move' ? 'Folder' : form.action === 'forward' ? 'Email address' : 'Message'}
                    </label>
                    <input value={form.action_value} onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                      className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
                <button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  Create Filter
                </button>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <span className="font-semibold text-sm">Filters ({data?.total ?? 0})</span>
            </div>
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : !data?.filters.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No filters for this mailbox</div>
            ) : (
              <div className="divide-y">
                {data.filters.map((f: EmailFilter) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.rules.length} rule{f.rules.length !== 1 ? 's' : ''} → {ACTIONS.find(a => a.value === f.action)?.label ?? f.action}
                          {f.action_value && `: ${f.action_value}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleMutation.mutate({ id: f.id, enabled: !f.enabled })}>
                        {f.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => deleteMutation.mutate(f.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!mailbox && (
        <div className="bg-card border rounded-xl p-8 text-center">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Enter a mailbox address above to manage its filters</p>
        </div>
      )}
    </div>
  )
}
