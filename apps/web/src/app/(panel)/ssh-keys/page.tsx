'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2, Copy, Check } from 'lucide-react'
import { sshKeyApi, type SSHKey } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function SSHKeysPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', public_key: '' })
  const [copied, setCopied] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: () => sshKeyApi.list().then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (d: typeof form) => sshKeyApi.add(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssh-keys'] }); toast.success('SSH key added'); setShowForm(false); setForm({ label: '', public_key: '' }) },
    onError: () => toast.error('Failed to add SSH key'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sshKeyApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssh-keys'] }); toast.success('SSH key removed') },
  })

  const copyFP = (fp: string) => {
    navigator.clipboard.writeText(fp)
    setCopied(fp)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SSH Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage authorized SSH public keys for your account</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Add Key
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Add SSH Public Key</h2>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="My MacBook" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Public Key</label>
            <textarea value={form.public_key} onChange={e => setForm(f => ({ ...f, public_key: e.target.value }))}
              rows={4} placeholder="ssh-rsa AAAAB3NzaC1yc2E... user@host"
              className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your public key (from <code className="font-mono bg-muted px-1 rounded">~/.ssh/id_rsa.pub</code> or <code className="font-mono bg-muted px-1 rounded">~/.ssh/id_ed25519.pub</code>)
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => addMutation.mutate(form)} disabled={!form.label || !form.public_key || addMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Add Key
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Authorized Keys ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.keys.length ? (
          <div className="p-8 text-center">
            <KeyRound className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No SSH keys added yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.keys.map((k: SSHKey) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{k.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs font-mono text-muted-foreground">{k.fingerprint.slice(0, 32)}...</p>
                      <button onClick={() => copyFP(k.fingerprint)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {copied === k.fingerprint ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Added {new Date(k.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(k.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
