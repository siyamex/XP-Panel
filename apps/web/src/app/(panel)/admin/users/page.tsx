'use client'

import { useState } from 'react'
import { Search, Plus, MoreHorizontal, Shield, User, UserX, Mail, Calendar, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

interface AdminUser {
  id: string
  name: string
  email: string
  username: string
  role: 'super_admin' | 'admin' | 'reseller' | 'user' | 'developer'
  status: 'active' | 'suspended' | 'pending' | 'locked'
  organization: string
  domains: number
  last_login: Date | null
  created_at: Date
}

const MOCK_USERS: AdminUser[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@acme.com', username: 'alice', role: 'admin', status: 'active', organization: 'Acme Corp', domains: 12, last_login: new Date(Date.now() - 3600000), created_at: new Date(Date.now() - 86400000 * 90) },
  { id: '2', name: 'Bob Smith', email: 'bob@techco.io', username: 'bob', role: 'user', status: 'active', organization: 'TechCo', domains: 3, last_login: new Date(Date.now() - 86400000), created_at: new Date(Date.now() - 86400000 * 45) },
  { id: '3', name: 'Carol White', email: 'carol@hosting.net', username: 'carol', role: 'reseller', status: 'active', organization: 'Hosting.net', domains: 47, last_login: new Date(Date.now() - 7200000), created_at: new Date(Date.now() - 86400000 * 120) },
  { id: '4', name: 'Dave Brown', email: 'dave@devshop.dev', username: 'dave', role: 'developer', status: 'suspended', organization: 'DevShop', domains: 5, last_login: new Date(Date.now() - 86400000 * 10), created_at: new Date(Date.now() - 86400000 * 60) },
  { id: '5', name: 'Eve Davis', email: 'eve@startup.io', username: 'eve', role: 'user', status: 'pending', organization: 'Startup.io', domains: 0, last_login: null, created_at: new Date(Date.now() - 86400000 * 2) },
  { id: '6', name: 'Frank Miller', email: 'frank@mega.com', username: 'frank', role: 'reseller', status: 'active', organization: 'Mega Corp', domains: 89, last_login: new Date(Date.now() - 1800000), created_at: new Date(Date.now() - 86400000 * 200) },
]

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  reseller: { label: 'Reseller', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  user: { label: 'User', color: 'bg-muted text-muted-foreground' },
  developer: { label: 'Developer', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  suspended: { label: 'Suspended', color: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  locked: { label: 'Locked', color: 'bg-muted text-muted-foreground' },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.organization.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  const toggleStatus = (id: string, status: AdminUser['status']) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, status } : u))
    setOpenMenu(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} total users across all organizations</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />Invite User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Users', value: users.length, icon: User },
          { label: 'Active', value: users.filter(u => u.status === 'active').length, icon: Shield },
          { label: 'Suspended', value: users.filter(u => u.status === 'suspended').length, icon: UserX },
          { label: 'Pending', value: users.filter(u => u.status === 'pending').length, icon: Mail },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Roles</option>
          {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organization</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Domains</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Login</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{user.organization}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ROLE_CONFIG[user.role].color}`}>{ROLE_CONFIG[user.role].label}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_CONFIG[user.status].color}`}>{STATUS_CONFIG[user.status].label}</span>
                  </td>
                  <td className="py-3 px-4 font-medium">{user.domains}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">
                    {user.last_login ? format(user.last_login, 'MMM d, HH:mm') : 'Never'}
                  </td>
                  <td className="py-3 px-4 relative">
                    <button onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {openMenu === user.id && (
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          className="absolute right-4 top-10 z-10 bg-card border rounded-lg shadow-xl py-1 w-44">
                          <button onClick={() => { setOpenMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                            <Mail className="h-3.5 w-3.5" />Send Email
                          </button>
                          {user.status === 'active'
                            ? <button onClick={() => toggleStatus(user.id, 'suspended')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"><UserX className="h-3.5 w-3.5" />Suspend</button>
                            : <button onClick={() => toggleStatus(user.id, 'active')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-muted transition-colors"><User className="h-3.5 w-3.5" />Activate</button>
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No users found</div>
        )}
      </div>

      {/* Invite modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowInvite(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card border rounded-xl p-6 w-full max-w-sm space-y-4">
              <h3 className="font-semibold">Invite User</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email Address</label>
                  <input type="email" placeholder="user@example.com" className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role</label>
                  <select className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'super_admin').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowInvite(false)} className="flex-1 h-9 border rounded-md text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={() => setShowInvite(false)} className="flex-1 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">Send Invite</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
