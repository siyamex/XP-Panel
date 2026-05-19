'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Package, Plus, Trash2, CheckCircle2, Globe, HardDrive, Mail } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import Link from 'next/link'

interface Package {
  id: string
  name: string
  price: number
  domains: number
  disk_gb: number
  bandwidth_gb: number
  email_accounts: number
  databases: number
  active: boolean
}

interface ResellerUser {
  id: string
  email: string
  username: string
  package_id: string
  package_name: string
  domains_used: number
  disk_used_gb: number
  status: 'active' | 'suspended'
  created_at: string
}

const MOCK_PACKAGES: Package[] = [
  { id: '1', name: 'Starter', price: 4.99, domains: 3, disk_gb: 10, bandwidth_gb: 50, email_accounts: 10, databases: 3, active: true },
  { id: '2', name: 'Business', price: 9.99, domains: 10, disk_gb: 50, bandwidth_gb: 200, email_accounts: 50, databases: 10, active: true },
  { id: '3', name: 'Premium', price: 19.99, domains: 25, disk_gb: 100, bandwidth_gb: 500, email_accounts: 100, databases: 25, active: true },
]

const MOCK_USERS: ResellerUser[] = [
  { id: '1', email: 'alice@example.com', username: 'alice', package_id: '2', package_name: 'Business', domains_used: 4, disk_used_gb: 18.2, status: 'active', created_at: '2025-12-01' },
  { id: '2', email: 'bob@example.com', username: 'bob', package_id: '1', package_name: 'Starter', domains_used: 2, disk_used_gb: 4.1, status: 'active', created_at: '2026-01-15' },
  { id: '3', email: 'carol@company.io', username: 'carol', package_id: '3', package_name: 'Premium', domains_used: 12, disk_used_gb: 67.8, status: 'suspended', created_at: '2026-02-20' },
]

export default function ResellerPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'packages'>('overview')
  const [packages, setPackages] = useState<Package[]>(MOCK_PACKAGES)
  const [users, setUsers] = useState<ResellerUser[]>(MOCK_USERS)
  const [showAddPackage, setShowAddPackage] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)

  const totalRevenue = users.filter(u => u.status === 'active').length *
    (packages.find(p => p.id === '2')?.price ?? 9.99)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reseller</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage sub-accounts, packages, and quotas</p>
        </div>
        <div className="flex gap-2">
          {tab === 'packages' && (
            <button onClick={() => setShowAddPackage(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Package
            </button>
          )}
          {tab === 'users' && (
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['overview', 'users', 'packages'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'users' ? `Users (${users.length})` : t === 'packages' ? `Packages (${packages.length})` : 'Overview'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-500' },
              { label: 'Active Users', value: users.filter(u => u.status === 'active').length, icon: CheckCircle2, color: 'text-green-500' },
              { label: 'Packages', value: packages.length, icon: Package, color: 'text-purple-500' },
              { label: 'Monthly Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: Globe, color: 'text-amber-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
                <div className="text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Recent Users</h3>
                <button onClick={() => setTab('users')} className="text-xs text-primary hover:underline">View all →</button>
              </div>
              <div className="divide-y divide-border">
                {users.slice(0, 3).map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{u.package_name}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive')}>
                        {u.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Packages</h3>
                <button onClick={() => setTab('packages')} className="text-xs text-primary hover:underline">Manage →</button>
              </div>
              <div className="divide-y divide-border">
                {packages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.domains} domains · {p.disk_gb}GB disk</div>
                    </div>
                    <div className="font-medium">${p.price}/mo</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Package</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domains</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Disk</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const pkg = packages.find(p => p.id === u.package_id)
                const diskPct = pkg ? Math.min((u.disk_used_gb / pkg.disk_gb) * 100, 100) : 0
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.package_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{u.domains_used}</span>
                      <span className="text-xs text-muted-foreground">/{pkg?.domains ?? '?'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs mb-1">{u.disk_used_gb.toFixed(1)} / {pkg?.disk_gb ?? '?'} GB</div>
                      <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', diskPct > 80 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${diskPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive')}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => {
                          setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, status: usr.status === 'active' ? 'suspended' : 'active' } : usr))
                          toast.success(u.status === 'active' ? 'User suspended' : 'User activated')
                        }} className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button onClick={() => { if (confirm('Delete user?')) { setUsers(prev => prev.filter(usr => usr.id !== u.id)); toast.success('User deleted') }}} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'packages' && (
        <div className="grid grid-cols-3 gap-4">
          {packages.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-lg">{p.name}</div>
                <button onClick={() => { if (confirm('Delete package?')) { setPackages(prev => prev.filter(pkg => pkg.id !== p.id)); toast.success('Package deleted') }}} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
              <div className="text-3xl font-black mb-4">${p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <div className="space-y-2 flex-1">
                {[
                  { icon: Globe, label: `${p.domains} Domains` },
                  { icon: HardDrive, label: `${p.disk_gb} GB Disk` },
                  { icon: Globe, label: `${p.bandwidth_gb} GB Bandwidth` },
                  { icon: Mail, label: `${p.email_accounts} Email Accounts` },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                {users.filter(u => u.package_id === p.id).length} active users
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddPackage && <AddPackageModal onClose={() => setShowAddPackage(false)} onCreate={(p) => { setPackages(prev => [...prev, { ...p, id: Date.now().toString(), active: true }]); setShowAddPackage(false) }} />}
        {showAddUser && <AddUserModal packages={packages} onClose={() => setShowAddUser(false)} onCreate={(u) => { setUsers(prev => [...prev, { ...u, id: Date.now().toString(), domains_used: 0, disk_used_gb: 0, status: 'active', created_at: new Date().toISOString() }]); setShowAddUser(false) }} />}
      </AnimatePresence>
    </div>
  )
}

function AddPackageModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Omit<Package, 'id' | 'active'>) => void }) {
  const { register, handleSubmit } = useForm<Omit<Package, 'id' | 'active'>>({ defaultValues: { price: 9.99, domains: 10, disk_gb: 50, bandwidth_gb: 200, email_accounts: 50, databases: 10 } })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">New Package</h2></div>
        <form onSubmit={handleSubmit(onCreate)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Package Name</label>
              <input {...register('name', { required: true })} placeholder="Basic" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Price / month ($)</label>
              <input {...register('price', { required: true, valueAsNumber: true })} type="number" step="0.01" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([['domains', 'Domains'], ['disk_gb', 'Disk (GB)'], ['bandwidth_gb', 'Bandwidth (GB)'], ['email_accounts', 'Email Accounts']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <input {...register(field, { required: true, valueAsNumber: true })} type="number" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Create Package</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function AddUserModal({ packages, onClose, onCreate }: { packages: Package[]; onClose: () => void; onCreate: (u: Pick<ResellerUser, 'email' | 'username' | 'package_id' | 'package_name'>) => void }) {
  const { register, handleSubmit, watch } = useForm<{ email: string; username: string; package_id: string; password: string }>({
    defaultValues: { package_id: packages[0]?.id ?? '' }
  })
  const pkgID = watch('package_id')
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Add User</h2></div>
        <form onSubmit={handleSubmit((d) => {
          const pkg = packages.find(p => p.id === d.package_id)
          onCreate({ email: d.email, username: d.username, package_id: d.package_id, package_name: pkg?.name ?? '' })
          toast.success('User created')
        })} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
            <input {...register('username', { required: true })} placeholder="johndoe" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input {...register('email', { required: true })} type="email" placeholder="john@example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Package</label>
            <select {...register('package_id', { required: true })} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm">
              {packages.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <input {...register('password', { required: true })} type="password" placeholder="••••••••" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Create User</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

void pkgID
