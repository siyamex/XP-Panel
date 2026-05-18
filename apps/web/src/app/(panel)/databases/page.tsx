'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, Plus, Trash2, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { databasesApi } from '@/lib/api/databases.api'
import type { CreateDatabaseRequest, CreateDBUserRequest } from '@/types/database.types'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

export default function DatabasesPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['databases'],
    queryFn: () => databasesApi.list(),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => databasesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Database deleted') },
    onError: () => toast.error('Failed to delete database'),
  })

  const dbs = data?.databases ?? []
  const mysqlCount = dbs.filter((d) => d.db_type === 'mysql').length
  const pgCount = dbs.filter((d) => d.db_type === 'postgresql').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Databases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage MySQL and PostgreSQL databases</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Create Database
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{dbs.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">MySQL</div>
          <div className="text-2xl font-bold mt-1 text-orange-500">{mysqlCount}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">PostgreSQL</div>
          <div className="text-2xl font-bold mt-1 text-blue-500">{pgCount}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : dbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Database className="w-10 h-10 mb-2 opacity-30" />
            No databases yet
          </div>
        ) : (
          <div>
            {dbs.map((db) => (
              <div key={db.id} className="border-b border-border last:border-0">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{db.name}</div>
                      <div className="text-xs text-muted-foreground">{db.host}:{db.port} · {formatBytes(db.size_mb * 1024 * 1024)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', db.db_type === 'mysql' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500')}>
                      {db.db_type === 'mysql' ? 'MySQL' : 'PostgreSQL'}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', db.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {db.status}
                    </span>
                    <button onClick={() => setExpanded(expanded === db.id ? null : db.id)} className="p-1.5 rounded hover:bg-muted transition-colors">
                      {expanded === db.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { if (confirm(`Delete database ${db.name}?`)) deleteMutation.mutate(db.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {expanded === db.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <DBUserPanel dbId={db.id} dbName={db.name} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <CreateDBModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function DBUserPanel({ dbId, dbName }: { dbId: string; dbName: string }) {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['db-users', dbId],
    queryFn: () => databasesApi.listUsers(dbId),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (uid: string) => databasesApi.deleteUser(dbId, uid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['db-users', dbId] }); toast.success('User removed') },
  })

  const users = data?.users ?? []

  return (
    <div className="bg-muted/20 border-t border-border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="w-3.5 h-3.5" />Database Users
        </div>
        <button onClick={() => setShowAdd(true)} className="text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          + Add User
        </button>
      </div>

      {users.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No additional users</p>
      ) : (
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 text-xs">
              <div>
                <span className="font-medium font-mono">{u.username}</span>
                <span className="text-muted-foreground ml-2">{u.privileges.join(', ')}</span>
              </div>
              <button onClick={() => deleteMutation.mutate(u.id)} className="p-1 hover:bg-destructive/10 rounded transition-colors">
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddDBUserModal dbId={dbId} dbName={dbName} onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  )
}

function CreateDBModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateDatabaseRequest>()
  const mutation = useMutation({
    mutationFn: (data: CreateDatabaseRequest) => databasesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Database created'); onClose() },
    onError: () => toast.error('Failed to create database'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Create Database</h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Database Name</label>
            <input {...register('name', { required: true })} placeholder="my_database" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select {...register('db_type')} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
            </select>
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

function AddDBUserModal({ dbId, dbName, onClose }: { dbId: string; dbName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<CreateDBUserRequest>()
  const mutation = useMutation({
    mutationFn: (data: CreateDBUserRequest) => databasesApi.createUser(dbId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['db-users', dbId] }); toast.success('User created'); onClose() },
    onError: () => toast.error('Failed to create user'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-4 border-b border-border"><h2 className="font-semibold text-sm">Add User to <span className="font-mono">{dbName}</span></h2></div>
        <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, privileges: ['ALL PRIVILEGES'] }))} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
            <input {...register('username', { required: true })} placeholder="db_user" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <input {...register('password', { required: true })} type="password" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">{mutation.isPending ? 'Creating...' : 'Add'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
