'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Plus, Trash2, Loader2, Search } from 'lucide-react'
import { mailApi } from '@/lib/api/mail.api'
import type { CreateMailboxRequest } from '@/types/mail.types'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

export default function EmailPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: () => mailApi.listMailboxes(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mailApi.deleteMailbox(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); toast.success('Mailbox deleted') },
    onError: () => toast.error('Failed to delete mailbox'),
  })

  const mailboxes = (data?.mailboxes ?? []).filter((m) =>
    !search || m.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage mailboxes, forwarders, and DKIM</p>
        </div>
        <div className="flex gap-2">
          <Link href="/email/forwarders" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Forwarders</Link>
          <Link href="/email/dkim" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">DKIM</Link>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Mailbox
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total Mailboxes</div>
          <div className="text-2xl font-bold mt-1">{data?.total ?? 0}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold mt-1 text-green-500">{(data?.mailboxes ?? []).filter((m) => m.active).length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total Storage Used</div>
          <div className="text-2xl font-bold mt-1">{formatBytes((data?.mailboxes ?? []).reduce((a, m) => a + m.used_mb * 1024 * 1024, 0))}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="text" placeholder="Search mailboxes..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : mailboxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Mail className="w-10 h-10 mb-2 opacity-30" />
            {search ? 'No mailboxes match your search' : 'No mailboxes yet'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Storage</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.map((m) => {
                const pct = m.quota_mb > 0 ? (m.used_mb / m.quota_mb) * 100 : 0
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-medium">{m.email}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">{formatBytes(m.used_mb * 1024 * 1024)} / {formatBytes(m.quota_mb * 1024 * 1024)}</div>
                        <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', m.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>{m.active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { if (confirm(`Delete ${m.email}?`)) deleteMutation.mutate(m.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddMailboxModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddMailboxModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateMailboxRequest>()
  const mutation = useMutation({
    mutationFn: (data: CreateMailboxRequest) => mailApi.createMailbox(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); toast.success('Mailbox created'); onClose() },
    onError: () => toast.error('Failed to create mailbox'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border"><h2 className="font-semibold">Create Mailbox</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
              <input {...register('local_part', { required: true })} placeholder="user" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
              <input {...register('domain', { required: true })} placeholder="example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <input {...register('password', { required: true })} type="password" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
