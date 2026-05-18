'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { HardDrive, Plus, Trash2, Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Play } from 'lucide-react'
import { backupApi } from '@/lib/api/backup.api'
import type { CreateBackupRequest, CreateScheduleRequest } from '@/types/backup.types'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const STATUS_CONFIG = {
  pending:   { icon: Clock,        color: 'text-muted-foreground bg-muted',        label: 'Pending' },
  running:   { icon: RefreshCw,    color: 'text-blue-500 bg-blue-500/10',          label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-green-500 bg-green-500/10',        label: 'Completed' },
  failed:    { icon: AlertCircle,  color: 'text-destructive bg-destructive/10',    label: 'Failed' },
}

export default function BackupsPage() {
  const [tab, setTab] = useState<'backups' | 'schedules'>('backups')
  const [showCreate, setShowCreate] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const qc = useQueryClient()

  const { data: backupsData, isLoading: loadingBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupApi.listBackups(),
    select: (r) => r.data,
    refetchInterval: 10000,
  })

  const { data: schedulesData, isLoading: loadingSchedules } = useQuery({
    queryKey: ['backup-schedules'],
    queryFn: () => backupApi.listSchedules(),
    select: (r) => r.data,
  })

  const deleteBackupMutation = useMutation({
    mutationFn: (id: string) => backupApi.deleteBackup(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); toast.success('Backup deleted') },
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => backupApi.deleteSchedule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backup-schedules'] }); toast.success('Schedule deleted') },
  })

  const backups = backupsData?.backups ?? []
  const schedules = schedulesData?.schedules ?? []
  const completedBackups = backups.filter((b) => b.status === 'completed').length
  const totalSize = backups.reduce((acc, b) => acc + b.size_bytes, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Encrypted backup management with scheduling</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSchedule(true)} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />Schedule
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" />Run Backup
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total Backups</div>
          <div className="text-2xl font-bold mt-1">{backups.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold mt-1 text-green-500">{completedBackups}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total Size</div>
          <div className="text-2xl font-bold mt-1">{formatBytes(totalSize)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['backups', 'schedules'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'backups' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingBackups ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <HardDrive className="w-10 h-10 mb-2 opacity-30" />
              No backups yet — run your first backup
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Encrypted</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending
                  return (
                    <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3 font-medium font-mono text-xs">{b.name}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{b.type}</span></td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit', cfg.color)}>
                          <cfg.icon className={cn('w-3 h-3', b.status === 'running' && 'animate-spin')} />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBytes(b.size_bytes)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', b.encrypted ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                          {b.encrypted ? 'AES-256' : 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { if (confirm('Delete backup?')) deleteBackupMutation.mutate(b.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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
      )}

      {tab === 'schedules' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loadingSchedules ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Clock className="w-10 h-10 mb-2 opacity-30" />
              No schedules configured
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Schedule</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Retain</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.cron_expr}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{s.type}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.retain_count} copies</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', s.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                        {s.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { if (confirm('Delete schedule?')) deleteScheduleMutation.mutate(s.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <RunBackupModal onClose={() => setShowCreate(false)} />}
        {showSchedule && <CreateScheduleModal onClose={() => setShowSchedule(false)} />}
      </AnimatePresence>
    </div>
  )
}

function RunBackupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateBackupRequest>({ defaultValues: { type: 'full' } })
  const mutation = useMutation({
    mutationFn: (data: CreateBackupRequest) => backupApi.createBackup(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); toast.success('Backup started'); onClose() },
    onError: () => toast.error('Failed to start backup'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Run Backup Now</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Backup Type</label>
            <select {...register('type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
              <option value="full">Full Backup</option>
              <option value="files">Files Only</option>
              <option value="database">Database Only</option>
              <option value="incremental">Incremental</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Starting...' : 'Start Backup'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function CreateScheduleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateScheduleRequest>({ defaultValues: { type: 'full', retain_count: 7, cron_expr: '0 2 * * *' } })
  const mutation = useMutation({
    mutationFn: (data: CreateScheduleRequest) => backupApi.createSchedule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backup-schedules'] }); toast.success('Schedule created'); onClose() },
    onError: () => toast.error('Failed to create schedule'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Create Backup Schedule</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Schedule Name</label>
            <input {...register('name', { required: true })} placeholder="Daily Full Backup" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cron Expression</label>
              <input {...register('cron_expr', { required: true })} placeholder="0 2 * * *" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Retain Count</label>
              <input {...register('retain_count', { valueAsNumber: true })} type="number" min={1} max={365} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select {...register('type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
              <option value="full">Full</option>
              <option value="incremental">Incremental</option>
              <option value="database">Database</option>
              <option value="files">Files</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Saving...' : 'Create Schedule'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
