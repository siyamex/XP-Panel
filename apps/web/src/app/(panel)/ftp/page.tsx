'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Plus, Trash2, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'
import { ftpApi, type FTPAccount } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

export default function FTPPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [changePwId, setChangePwId] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [form, setForm] = useState({ username: '', password: '', home_dir: '/var/www', quota_mb: 0 })

  const { data, isLoading } = useQuery({
    queryKey: ['ftp-accounts'],
    queryFn: () => ftpApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => ftpApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ftp-accounts'] }); toast.success('FTP account created'); setShowForm(false); setForm({ username: '', password: '', home_dir: '/var/www', quota_mb: 0 }) },
    onError: () => toast.error('Failed to create FTP account'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ftpApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ftp-accounts'] }); toast.success('FTP account deleted') },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => ftpApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ftp-accounts'] }),
  })

  const changePwMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => ftpApi.updatePassword(id, password),
    onSuccess: () => { toast.success('Password updated'); setChangePwId(null); setNewPw('') },
    onError: () => toast.error('Failed to update password'),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FTP Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage FTP/SFTP access to your hosting files</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Create FTP Account
        </button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">New FTP Account</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="ftpuser" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Home Directory</label>
              <input value={form.home_dir} onChange={e => setForm(f => ({ ...f, home_dir: e.target.value }))}
                placeholder="/var/www/mysite" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quota (MB, 0 = unlimited)</label>
              <input type="number" value={form.quota_mb} onChange={e => setForm(f => ({ ...f, quota_mb: parseInt(e.target.value) || 0 }))}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={!form.username || !form.password || createMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">FTP Accounts ({data?.total ?? 0})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data?.accounts.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No FTP accounts yet</div>
        ) : (
          <div className="divide-y">
            {data.accounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium font-mono">{acc.username}</p>
                    <p className="text-xs text-muted-foreground">{acc.home_dir} · {acc.quota_mb ? `${acc.quota_mb} MB` : 'Unlimited'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {changePwId === acc.id ? (
                    <div className="flex items-center gap-1">
                      <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                        placeholder="New password" className="border border-input rounded px-2 py-1 text-xs bg-background w-32 focus:outline-none focus:ring-1 focus:ring-ring" />
                      <button onClick={() => changePwMutation.mutate({ id: acc.id, password: newPw })}
                        disabled={!newPw} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-50">Save</button>
                      <button onClick={() => setChangePwId(null)} className="px-2 py-1 text-xs border rounded hover:bg-muted">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setChangePwId(acc.id)} className="text-muted-foreground hover:text-foreground transition-colors" title="Change password">
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => toggleMutation.mutate(acc.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {acc.enabled ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(acc.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
