'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, User, Shield, Trash2, MoreHorizontal, KeyRound } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiClient } from '@/lib/api/client'

interface ResellerUser {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  status: string
  role: string
  domains_count: number
  disk_used_mb: number
  created_at: string
}

async function fetchUsers() {
  const res = await apiClient.get('/auth/users')
  return res.data.users as ResellerUser[]
}

async function createUser(data: { email: string; username: string; password: string; role: string }) {
  const res = await apiClient.post('/auth/users', data)
  return res.data
}

async function suspendUser(id: string) {
  await apiClient.patch(`/auth/users/${id}/status`, { status: 'suspended' })
}

async function deleteUser(id: string) {
  await apiClient.delete(`/auth/users/${id}`)
}

async function resetPassword(id: string) {
  const res = await apiClient.post(`/auth/users/${id}/reset-password`)
  return res.data
}

export default function ResellerUsersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', username: '', password: '', role: 'user' })

  const { data: users = [], isLoading } = useQuery({ queryKey: ['reseller-users'], queryFn: fetchUsers })

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reseller-users'] }); setOpen(false); toast.success('User created') },
    onError: () => toast.error('Failed to create user'),
  })

  const columns: ColumnDef<ResellerUser>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="font-medium text-sm">{row.original.username}</div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm capitalize">{row.original.role}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'domains_count',
      header: 'Domains',
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.domains_count ?? 0}</span>,
    },
    {
      accessorKey: 'disk_used_mb',
      header: 'Disk Used',
      cell: ({ row }) => {
        const mb = row.original.disk_used_mb ?? 0
        return <span className="tabular-nums text-sm">{mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`}</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{format(new Date(row.original.created_at), 'MMM d, yyyy')}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={async () => { await resetPassword(row.original.id); toast.success('Password reset email sent') }}>
              <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => { await suspendUser(row.original.id); qc.invalidateQueries({ queryKey: ['reseller-users'] }); toast.success('User suspended') }}>
              Suspend
            </DropdownMenuItem>
            <ConfirmDialog
              description={`Permanently delete user "${row.original.username}"? This cannot be undone.`}
              onConfirm={async () => { await deleteUser(row.original.id); qc.invalidateQueries({ queryKey: ['reseller-users'] }); toast.success('User deleted') }}
              trigger={<DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your reseller client accounts</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add User
        </Button>
      </div>

      <DataTable columns={columns} data={users} searchKey="username" searchPlaceholder="Search users..." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="user@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input placeholder="johndoe" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="reseller">Reseller</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
