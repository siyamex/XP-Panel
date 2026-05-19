'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Plus, Trash2, Loader2, Users, Search,
  RefreshCw, ExternalLink, Eye, EyeOff, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react'
import { databasesApi } from '@/lib/api/databases.api'
import type { Database as DB, DBUser, CreateDatabaseRequest, CreateDBUserRequest } from '@/types/database.types'
import { DB_PRIVILEGES } from '@/types/database.types'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

type Tab = 'databases' | 'users'

const DB_TYPE_STYLE: Record<string, { cls: string; label: string; port: number }> = {
  mysql:      { cls: 'bg-orange-500/10 text-orange-500', label: 'MySQL',      port: 3306 },
  postgresql: { cls: 'bg-blue-500/10 text-blue-500',    label: 'PostgreSQL',  port: 5432 },
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded hover:bg-muted transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  )
}

export default function DatabasesPage() {
  const [tab, setTab] = useState<Tab>('databases')
  const [search, setSearch] = useState('')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Databases</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage MySQL and PostgreSQL databases and users</p>
      </div>

      {/* phpMyAdmin / pgAdmin quick links */}
      <div className="flex gap-3">
        <a href="/phpmyadmin" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
          <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center text-[9px] text-white font-bold">M</div>
          phpMyAdmin <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
        <a href="/pgadmin" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
          <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold">P</div>
          pgAdmin <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['databases', 'users'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'databases' ? 'Databases' : 'DB Users'}
          </button>
        ))}
      </div>

      {tab === 'databases' && <DatabasesTab search={search} setSearch={setSearch} />}
      {tab === 'users'     && <UsersTab search={search} setSearch={setSearch} />}
    </div>
  )
}

// ─── Databases tab ────────────────────────────────────────────────────────────
function DatabasesTab({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['databases'],
    queryFn: () => databasesApi.list(),
    select: r => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => databasesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Database deleted') },
    onError: () => toast.error('Failed to delete database'),
  })

  const dbs = (data?.databases ?? []).filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.db_name.toLowerCase().includes(search.toLowerCase())
  )
  const mysqlCount = (data?.databases ?? []).filter(d => d.db_type === 'mysql').length
  const pgCount    = (data?.databases ?? []).filter(d => d.db_type === 'postgresql').length
  const totalSize  = (data?.databases ?? []).reduce((a, d) => a + d.size_mb, 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: data?.total ?? 0,                    color: '' },
          { label: 'MySQL',      value: mysqlCount,                          color: 'text-orange-500' },
          { label: 'PostgreSQL', value: pgCount,                             color: 'text-blue-500' },
          { label: 'Total Size', value: formatBytes(totalSize * 1024 * 1024), color: '' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={cn('text-xl font-bold mt-1 truncate', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="text" placeholder="Search databases..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Create Database
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : dbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Database className="w-10 h-10 opacity-20" />
            <p>{search ? 'No databases match your search' : 'No databases yet'}</p>
          </div>
        ) : (
          <div>
            {dbs.map(db => {
              const style = DB_TYPE_STYLE[db.db_type]
              const isExpanded = expanded === db.id
              return (
                <div key={db.id} className="border-b border-border last:border-0">
                  <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', style.cls)}>
                      {db.db_type === 'mysql' ? 'MY' : 'PG'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{db.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{db.db_name}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span>{db.host}:{db.port}</span>
                        <CopyBtn text={`${db.host}:${db.port}`} />
                      </span>
                      <span>{formatBytes(db.size_mb * 1024 * 1024)}</span>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium shrink-0', style.cls)}>{style.label}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize',
                      db.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {db.status}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setExpanded(isExpanded ? null : db.id)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Connection info">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <button onClick={() => { if (confirm(`Delete database "${db.name}"? This cannot be undone.`)) deleteMutation.mutate(db.id) }}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <ConnectionInfo db={db} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <CreateDBModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Connection info panel ────────────────────────────────────────────────────
function ConnectionInfo({ db }: { db: DB }) {
  const style = DB_TYPE_STYLE[db.db_type]
  const rows = [
    { label: 'Host',     value: db.host },
    { label: 'Port',     value: String(db.port) },
    { label: 'Database', value: db.db_name },
    { label: 'Driver',   value: db.db_type === 'mysql' ? 'mysql2 / PDO_MySQL' : 'pg / PDO_PGSQL' },
  ]
  return (
    <div className="bg-muted/30 border-t border-border px-6 py-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Connection Details</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map(r => (
          <div key={r.label}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{r.label}</div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono font-medium">{r.value}</span>
              <CopyBtn text={r.value} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-card border border-border rounded-lg p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Connection String</p>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
            {db.db_type === 'mysql'
              ? `mysql://user:pass@${db.host}:${db.port}/${db.db_name}`
              : `postgresql://user:pass@${db.host}:${db.port}/${db.db_name}`}
          </code>
          <CopyBtn text={db.db_type === 'mysql'
            ? `mysql://user:pass@${db.host}:${db.port}/${db.db_name}`
            : `postgresql://user:pass@${db.host}:${db.port}/${db.db_name}`} />
        </div>
      </div>
    </div>
  )
}

// ─── DB Users tab ─────────────────────────────────────────────────────────────
function UsersTab({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['db-users'],
    queryFn: () => databasesApi.listUsers(),
    select: r => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => databasesApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['db-users'] }); toast.success('User deleted') },
    onError: () => toast.error('Failed to delete user'),
  })

  const users = (data?.users ?? []).filter(u =>
    !search || u.username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add User
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Users className="w-10 h-10 opacity-20" />
            <p>No database users yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Username</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Privileges</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-mono font-medium text-sm">{u.username}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.privileges ?? []).map(p => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { if (confirm(`Delete user "${u.username}"?`)) deleteMutation.mutate(u.id) }}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
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

      <AnimatePresence>
        {showAdd && <AddDBUserModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function CreateDBModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [showPw, setShowPw] = useState(false)
  const { register, handleSubmit } = useForm<CreateDatabaseRequest>({ defaultValues: { db_type: 'mysql' } })
  const mutation = useMutation({
    mutationFn: (data: CreateDatabaseRequest) => databasesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Database created'); onClose() },
    onError: () => toast.error('Failed to create database'),
  })
  return (
    <ModalShell title="Create Database" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Database Name</label>
          <input {...register('name', { required: true })} placeholder="my_database" className="field font-mono" />
          <p className="text-xs text-muted-foreground mt-1">Alphanumeric and underscores only, max 64 chars</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['mysql', 'postgresql'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" value={t} {...register('db_type')} className="accent-primary" />
                <div>
                  <div className="text-sm font-medium capitalize">{t === 'mysql' ? 'MySQL' : 'PostgreSQL'}</div>
                  <div className="text-xs text-muted-foreground">Port {DB_TYPE_STYLE[t].port}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Root Password</label>
          <div className="relative">
            <input {...register('password', { required: true, minLength: 8 })} type={showPw ? 'text' : 'password'} className="field pr-8" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2">
              {showPw ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Database'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function AddDBUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [showPw, setShowPw] = useState(false)
  const [selectedPrivs, setSelectedPrivs] = useState<string[]>(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
  const { register, handleSubmit } = useForm<{ username: string; password: string }>()

  const mutation = useMutation({
    mutationFn: (d: { username: string; password: string }) =>
      databasesApi.createUser({ ...d, privileges: selectedPrivs }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['db-users'] }); toast.success('User created'); onClose() },
    onError: () => toast.error('Failed to create user'),
  })

  const togglePriv = (p: string) =>
    setSelectedPrivs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  return (
    <ModalShell title="Add Database User" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
          <input {...register('username', { required: true })} placeholder="db_user" className="field font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
          <div className="relative">
            <input {...register('password', { required: true, minLength: 8 })} type={showPw ? 'text' : 'password'} className="field pr-8" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2">
              {showPw ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Privileges</label>
          <div className="flex flex-wrap gap-1.5">
            {DB_PRIVILEGES.map(p => (
              <button key={p} type="button" onClick={() => togglePriv(p)}
                className={cn('text-xs px-2 py-1 rounded font-mono border transition-colors',
                  selectedPrivs.includes(p) ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending || selectedPrivs.length === 0} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>
  )
}
