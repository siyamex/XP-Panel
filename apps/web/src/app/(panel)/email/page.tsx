'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Plus, Trash2, Loader2, Search, RefreshCw, Eye, EyeOff,
  Shield, ArrowRight, Copy, Check, Globe, Server, Info,
  PauseCircle, PlayCircle, Key, Settings, ExternalLink,
} from 'lucide-react'
import { mailApi } from '@/lib/api/mail.api'
import type {
  Mailbox, Forwarder, DKIMKey, CatchAll,
  CreateMailboxRequest, CreateForwarderRequest,
} from '@/types/mail.types'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

type Tab = 'mailboxes' | 'forwarders' | 'dkim' | 'catchall' | 'webmail' | 'protocols'

// ─── Password generator ───────────────────────────────────────────────────────
function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  return Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((n) => chars[n % chars.length])
    .join('')
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded hover:bg-muted transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [tab, setTab] = useState<Tab>('mailboxes')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'mailboxes', label: 'Mailboxes' },
    { id: 'forwarders', label: 'Forwarders' },
    { id: 'dkim', label: 'DKIM' },
    { id: 'catchall', label: 'Catch-All' },
    { id: 'webmail', label: 'Webmail' },
    { id: 'protocols', label: 'Protocols' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage mailboxes, forwarders, DKIM, and mail settings</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mailboxes' && <MailboxTab />}
      {tab === 'forwarders' && <ForwardersTab />}
      {tab === 'dkim' && <DKIMTab />}
      {tab === 'catchall' && <CatchAllTab />}
      {tab === 'webmail' && <WebmailTab />}
      {tab === 'protocols' && <ProtocolsTab />}
    </div>
  )
}

// ─── Mailboxes tab ────────────────────────────────────────────────────────────
function MailboxTab() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: () => mailApi.listMailboxes(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mailApi.deleteMailbox(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); toast.success('Mailbox deleted') },
    onError: () => toast.error('Failed to delete mailbox'),
  })

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      suspended ? mailApi.suspendMailbox(id) : mailApi.unsuspendMailbox(id),
    onSuccess: (_, { suspended }) => {
      qc.invalidateQueries({ queryKey: ['mailboxes'] })
      toast.success(suspended ? 'Mailbox suspended' : 'Mailbox activated')
    },
    onError: () => toast.error('Action failed'),
  })

  const mailboxes = (data?.mailboxes ?? []).filter((m) =>
    !search || m.email.toLowerCase().includes(search.toLowerCase())
  )

  const stats = data?.mailboxes ?? []
  const activeCount = stats.filter((m) => m.enabled).length
  const totalUsedBytes = stats.reduce((a, m) => a + m.used_mb * 1024 * 1024, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Mailboxes', value: data?.total ?? 0 },
          { label: 'Active', value: activeCount, color: 'text-green-500' },
          { label: 'Storage Used', value: formatBytes(totalUsedBytes) },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search mailboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Mailbox
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Mail className="w-10 h-10 mb-2 opacity-30" />
            <p>{search ? 'No mailboxes match your search' : 'No mailboxes yet'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Storage</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Quota</th>
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
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(m.used_mb * 1024 * 1024)} / {formatBytes(m.quota_mb * 1024 * 1024)}
                        </div>
                        <div className="h-1.5 w-28 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-amber-500' : 'bg-primary')}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.quota_mb} MB</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', m.enabled ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500')}>
                        {m.enabled ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedMailbox(m)}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          title="Settings"
                        >
                          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => suspendMutation.mutate({ id: m.id, suspended: m.enabled })}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          title={m.enabled ? 'Suspend' : 'Activate'}
                        >
                          {m.enabled
                            ? <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                            : <PlayCircle className="w-3.5 h-3.5 text-green-500" />}
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${m.email}? This cannot be undone.`)) deleteMutation.mutate(m.id) }}
                          className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
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
        {selectedMailbox && <MailboxSettingsModal mailbox={selectedMailbox} onClose={() => setSelectedMailbox(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Add mailbox modal ────────────────────────────────────────────────────────
function AddMailboxModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, setValue, watch } = useForm<CreateMailboxRequest & { quota_mb: number }>({
    defaultValues: { quota_mb: 1024 },
  })
  const password = watch('password')

  const mutation = useMutation({
    mutationFn: (data: CreateMailboxRequest) => mailApi.createMailbox(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); toast.success('Mailbox created'); onClose() },
    onError: () => toast.error('Failed to create mailbox'),
  })

  return (
    <Modal title="Create Mailbox" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
            <input {...register('local_part', { required: true })} placeholder="user" className="field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('domain', { required: true })} placeholder="example.com" className="field" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                {...register('password', { required: true })}
                type={showPassword ? 'text' : 'password'}
                className="field pr-8"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setValue('password', generatePassword())}
              className="px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors whitespace-nowrap"
            >
              Generate
            </button>
          </div>
          {password && (
            <PasswordStrength password={password} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Quota (MB)</label>
          <input {...register('quota_mb', { valueAsNumber: true })} type="number" min={100} step={100} className="field" />
        </div>
        <ModalActions onClose={onClose} isPending={mutation.isPending} label="Create Mailbox" />
      </form>
    </Modal>
  )
}

// ─── Mailbox settings modal ───────────────────────────────────────────────────
function MailboxSettingsModal({ mailbox, onClose }: { mailbox: Mailbox; onClose: () => void }) {
  const qc = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [activeSection, setActiveSection] = useState<'quota' | 'password'>('quota')
  const [newPassword, setNewPassword] = useState('')
  const [quota, setQuota] = useState(mailbox.quota_mb)

  const updateMutation = useMutation({
    mutationFn: (data: { quota_mb?: number }) => mailApi.updateMailbox(mailbox.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); toast.success('Updated'); onClose() },
    onError: () => toast.error('Failed to update'),
  })

  const passwordMutation = useMutation({
    mutationFn: (pw: string) => mailApi.changePassword(mailbox.id, pw),
    onSuccess: () => { toast.success('Password changed'); onClose() },
    onError: () => toast.error('Failed to change password'),
  })

  return (
    <Modal title={`Settings — ${mailbox.email}`} onClose={onClose}>
      <div className="flex gap-2 border-b border-border mb-4 -mt-1">
        {(['quota', 'password'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn('px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors', activeSection === s ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}
          >
            {s === 'quota' ? 'Quota Settings' : 'Change Password'}
          </button>
        ))}
      </div>

      {activeSection === 'quota' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Quota (MB)</label>
            <input
              type="number"
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
              min={100}
              step={100}
              className="field"
            />
          </div>
          <ModalActions onClose={onClose} isPending={updateMutation.isPending} label="Save Changes"
            onSubmit={() => updateMutation.mutate({ quota_mb: quota })} />
        </div>
      )}

      {activeSection === 'password' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="field pr-8"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                className="px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors"
              >
                Generate
              </button>
            </div>
            {newPassword && <PasswordStrength password={newPassword} />}
          </div>
          <ModalActions onClose={onClose} isPending={passwordMutation.isPending} label="Change Password"
            onSubmit={() => newPassword && passwordMutation.mutate(newPassword)} />
        </div>
      )}
    </Modal>
  )
}

// ─── Password strength indicator ──────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .filter((r) => r.test(password)).length
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  const colors = ['bg-destructive', 'bg-orange-500', 'bg-amber-500', 'bg-blue-500', 'bg-green-500']
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full', i <= score ? colors[score - 1] : 'bg-muted')} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[score - 1] ?? 'Too short'}</p>
    </div>
  )
}

// ─── Forwarders tab ───────────────────────────────────────────────────────────
function ForwardersTab() {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['forwarders'],
    queryFn: () => mailApi.listForwarders(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mailApi.deleteForwarder(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwarders'] }); toast.success('Forwarder deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Forwarder
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (data?.forwarders ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ArrowRight className="w-10 h-10 mb-2 opacity-30" />
            <p>No forwarders yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Destinations</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.forwarders ?? []).map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-medium">{f.source}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(f.destinations ?? []).join(', ')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm('Delete this forwarder?')) deleteMutation.mutate(f.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddForwarderModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function AddForwarderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [destinations, setDestinations] = useState('')
  const { register, handleSubmit } = useForm<{ source_local: string; source_domain: string }>()

  const mutation = useMutation({
    mutationFn: (data: CreateForwarderRequest) => mailApi.createForwarder(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwarders'] }); toast.success('Forwarder created'); onClose() },
    onError: () => toast.error('Failed to create forwarder'),
  })

  const onSubmit = (d: { source_local: string; source_domain: string }) => {
    const dests = destinations.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    if (!dests.length) return toast.error('Add at least one destination')
    mutation.mutate({ ...d, destinations: dests })
  }

  return (
    <Modal title="Add Forwarder" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From (local part)</label>
            <input {...register('source_local', { required: true })} placeholder="info" className="field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
            <input {...register('source_domain', { required: true })} placeholder="example.com" className="field" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Forward to (one per line or comma separated)</label>
          <textarea
            value={destinations}
            onChange={(e) => setDestinations(e.target.value)}
            rows={3}
            placeholder="user@gmail.com&#10;team@company.com"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <ModalActions onClose={onClose} isPending={mutation.isPending} label="Create Forwarder" />
      </form>
    </Modal>
  )
}

// ─── DKIM tab ─────────────────────────────────────────────────────────────────
function DKIMTab() {
  const [showGenerate, setShowGenerate] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dkim'],
    queryFn: () => mailApi.listDKIM(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => mailApi.deleteDKIM(domain),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dkim'] }); toast.success('DKIM key deleted') },
    onError: () => toast.error('Failed to delete DKIM key'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Key className="w-3.5 h-3.5" /> Generate DKIM Key
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (data?.keys ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Shield className="w-10 h-10 mb-2 opacity-30" />
            <p>No DKIM keys configured</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(data?.keys ?? []).map((k) => (
              <div key={k.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{k.domain}</span>
                    <span className="ml-2 text-xs text-muted-foreground">selector: {k.selector}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{k.key_size} bit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', k.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {k.active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => { if (confirm(`Delete DKIM for ${k.domain}?`)) deleteMutation.mutate(k.domain) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">DNS TXT Record</p>
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3">
                    <code className="text-xs break-all flex-1 font-mono">{k.dns_txt_value}</code>
                    <CopyBtn text={k.dns_txt_value} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showGenerate && <GenerateDKIMModal onClose={() => setShowGenerate(false)} />}
      </AnimatePresence>
    </div>
  )
}

function GenerateDKIMModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<{ domain: string; selector: string; key_size: number }>({
    defaultValues: { selector: 'default', key_size: 2048 },
  })

  const mutation = useMutation({
    mutationFn: (data: { domain: string; selector?: string; key_size?: number }) => mailApi.generateDKIM(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dkim'] }); toast.success('DKIM key generated'); onClose() },
    onError: () => toast.error('Failed to generate DKIM key'),
  })

  return (
    <Modal title="Generate DKIM Key" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
          <input {...register('domain', { required: true })} placeholder="example.com" className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Selector</label>
            <input {...register('selector')} placeholder="default" className="field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Key Size</label>
            <select {...register('key_size', { valueAsNumber: true })} className="field">
              <option value={1024}>1024 bit</option>
              <option value={2048}>2048 bit (recommended)</option>
              <option value={4096}>4096 bit</option>
            </select>
          </div>
        </div>
        <ModalActions onClose={onClose} isPending={mutation.isPending} label="Generate" />
      </form>
    </Modal>
  )
}

// ─── Catch-all tab ────────────────────────────────────────────────────────────
function CatchAllTab() {
  const [showAdd, setShowAdd] = useState(false)
  const [domain, setDomain] = useState('')
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['catchall', domain],
    queryFn: () => mailApi.getCatchAll(domain || undefined),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (d: string) => mailApi.deleteCatchAll(d),
    onSuccess: () => { refetch(); toast.success('Catch-all removed') },
    onError: () => toast.error('Failed to remove catch-all'),
  })

  const catchAll = data?.catch_all

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-500">
          A catch-all address receives all emails sent to non-existent addresses on a domain. Use carefully to avoid spam.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by domain..."
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="field max-w-xs"
        />
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Set Catch-All
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !catchAll ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Globe className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No catch-all configured{domain ? ` for ${domain}` : ''}</p>
          </div>
        ) : (
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">@{catchAll.domain}</div>
              <div className="text-sm text-muted-foreground mt-0.5">→ {catchAll.destination}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs px-2 py-0.5 rounded-full', catchAll.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                {catchAll.enabled ? 'Active' : 'Disabled'}
              </span>
              <button onClick={() => { if (confirm(`Remove catch-all for ${catchAll.domain}?`)) deleteMutation.mutate(catchAll.domain) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <SetCatchAllModal onClose={() => { setShowAdd(false); refetch() }} />}
      </AnimatePresence>
    </div>
  )
}

function SetCatchAllModal({ onClose }: { onClose: () => void }) {
  const { register, handleSubmit } = useForm<{ domain: string; destination: string }>()

  const mutation = useMutation({
    mutationFn: (data: { domain: string; destination: string }) => mailApi.setCatchAll({ ...data, enabled: true }),
    onSuccess: () => { toast.success('Catch-all configured'); onClose() },
    onError: () => toast.error('Failed to set catch-all'),
  })

  return (
    <Modal title="Configure Catch-All" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Domain</label>
          <input {...register('domain', { required: true })} placeholder="example.com" className="field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Destination Email</label>
          <input {...register('destination', { required: true })} type="email" placeholder="admin@example.com" className="field" />
        </div>
        <ModalActions onClose={onClose} isPending={mutation.isPending} label="Save" />
      </form>
    </Modal>
  )
}

// ─── Webmail tab ──────────────────────────────────────────────────────────────
function WebmailTab() {
  const webmailClients = [
    {
      name: 'Roundcube',
      description: 'Modern, browser-based IMAP client with a clean interface',
      url: '/webmail/roundcube',
      color: 'from-blue-500 to-blue-600',
      features: ['IMAP/SMTP', 'Calendar', 'Address Book', 'Plugins'],
      recommended: true,
    },
    {
      name: 'Horde',
      description: 'Feature-rich groupware suite with advanced collaboration tools',
      url: '/webmail/horde',
      color: 'from-orange-500 to-orange-600',
      features: ['Email', 'Calendar', 'Tasks', 'Notes', 'Files'],
    },
    {
      name: 'SquirrelMail',
      description: 'Lightweight, standards-based webmail for low-resource environments',
      url: '/webmail/squirrelmail',
      color: 'from-amber-500 to-amber-600',
      features: ['IMAP', 'Folders', 'Contacts', 'Lightweight'],
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {webmailClients.map((client) => (
          <div key={client.name} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className={cn('h-2 bg-gradient-to-r', client.color)} />
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{client.name}</h3>
                  {client.recommended && (
                    <span className="text-xs text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium">Recommended</span>
                  )}
                </div>
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{client.description}</p>
              <div className="flex flex-wrap gap-1">
                {client.features.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 bg-muted rounded-full">{f}</span>
                ))}
              </div>
              <a
                href={client.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors mt-2"
              >
                Open {client.name} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Webmail Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Roundcube Path</span>
              <code className="font-mono text-xs">/webmail/roundcube</code>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Horde Path</span>
              <code className="font-mono text-xs">/webmail/horde</code>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">SquirrelMail Path</span>
              <code className="font-mono text-xs">/webmail/squirrelmail</code>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Session Timeout</span>
              <span>30 minutes</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Max Attachment</span>
              <span>25 MB</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">SSL Required</span>
              <span className="text-green-500">Yes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Protocols tab ────────────────────────────────────────────────────────────
function ProtocolsTab() {
  const protocols = [
    {
      name: 'IMAP',
      description: 'Internet Message Access Protocol — recommended for syncing across devices',
      icon: '📬',
      color: 'border-blue-500/30 bg-blue-500/5',
      configs: [
        { label: 'Server', value: 'mail.yourdomain.com' },
        { label: 'Port (SSL/TLS)', value: '993', highlight: true },
        { label: 'Port (STARTTLS)', value: '143' },
        { label: 'Security', value: 'SSL/TLS or STARTTLS' },
        { label: 'Authentication', value: 'Normal Password' },
        { label: 'Username', value: 'Full email address' },
      ],
    },
    {
      name: 'POP3',
      description: 'Post Office Protocol — downloads emails to local device, removes from server',
      icon: '📥',
      color: 'border-orange-500/30 bg-orange-500/5',
      configs: [
        { label: 'Server', value: 'mail.yourdomain.com' },
        { label: 'Port (SSL/TLS)', value: '995', highlight: true },
        { label: 'Port (STARTTLS)', value: '110' },
        { label: 'Security', value: 'SSL/TLS or STARTTLS' },
        { label: 'Authentication', value: 'Normal Password' },
        { label: 'Username', value: 'Full email address' },
      ],
    },
    {
      name: 'SMTP',
      description: 'Simple Mail Transfer Protocol — for sending emails from your client',
      icon: '📤',
      color: 'border-green-500/30 bg-green-500/5',
      configs: [
        { label: 'Server', value: 'mail.yourdomain.com' },
        { label: 'Port (SSL/TLS)', value: '465', highlight: true },
        { label: 'Port (STARTTLS)', value: '587', highlight: true },
        { label: 'Port (Legacy)', value: '25' },
        { label: 'Security', value: 'SSL/TLS or STARTTLS' },
        { label: 'Authentication', value: 'Normal Password' },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {protocols.map((proto) => (
          <div key={proto.name} className={cn('border rounded-xl p-5 space-y-3', proto.color)}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{proto.icon}</span>
              <div>
                <h3 className="font-semibold">{proto.name}</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{proto.description}</p>
            <div className="space-y-1.5">
              {proto.configs.map((c) => (
                <div key={c.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <div className="flex items-center gap-1">
                    <span className={cn('font-mono', c.highlight && 'font-bold text-foreground')}>{c.value}</span>
                    {c.highlight && <CopyBtn text={c.value} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" /> Email Client Setup Guide
        </h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium mb-2">Recommended Settings (IMAP)</h4>
            <div className="space-y-1 font-mono text-xs bg-muted/40 rounded-lg p-3">
              <div><span className="text-muted-foreground">Incoming: </span>mail.yourdomain.com:993 (SSL)</div>
              <div><span className="text-muted-foreground">Outgoing: </span>mail.yourdomain.com:587 (STARTTLS)</div>
              <div><span className="text-muted-foreground">Username: </span>full email address</div>
              <div><span className="text-muted-foreground">Password: </span>your mailbox password</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Popular Clients</h4>
            <div className="space-y-2">
              {['Thunderbird', 'Apple Mail', 'Outlook', 'Gmail (Add Account)', 'K-9 Mail (Android)', 'Spark'].map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI components ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>
  )
}

function ModalActions({
  onClose, isPending, label, onSubmit,
}: {
  onClose: () => void
  isPending: boolean
  label: string
  onSubmit?: () => void
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
        Cancel
      </button>
      <button
        type={onSubmit ? 'button' : 'submit'}
        onClick={onSubmit}
        disabled={isPending}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
      </button>
    </div>
  )
}
