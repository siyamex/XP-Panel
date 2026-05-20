'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Package, Trash2, Edit, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/api/client'

interface HostingPackage {
  id: string
  name: string
  price: number
  domains: number
  disk_gb: number
  bandwidth_gb: number
  email_accounts: number
  databases: number
  active: boolean
  users_count: number
}

const emptyPackage = { name: '', price: 0, domains: 1, disk_gb: 10, bandwidth_gb: 100, email_accounts: 10, databases: 5, active: true }

async function fetchPackages() {
  const res = await apiClient.get('/reseller/packages')
  return res.data.packages as HostingPackage[]
}

async function savePackage(pkg: typeof emptyPackage & { id?: string }) {
  if (pkg.id) {
    return apiClient.put(`/reseller/packages/${pkg.id}`, pkg)
  }
  return apiClient.post('/reseller/packages', pkg)
}

async function deletePackage(id: string) {
  await apiClient.delete(`/reseller/packages/${id}`)
}

function ResourceCell({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="tabular-nums text-sm">
      {value < 0 ? <span className="text-emerald-500">∞</span> : value} <span className="text-muted-foreground text-xs">{unit}</span>
    </span>
  )
}

export default function ResellerPackagesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<(typeof emptyPackage & { id?: string }) | null>(null)

  const { data: packages = [] } = useQuery({ queryKey: ['reseller-packages'], queryFn: fetchPackages })

  const saveMut = useMutation({
    mutationFn: savePackage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reseller-packages'] })
      setOpen(false)
      setEditing(null)
      toast.success(editing?.id ? 'Package updated' : 'Package created')
    },
    onError: () => toast.error('Failed to save package'),
  })

  function openCreate() {
    setEditing({ ...emptyPackage })
    setOpen(true)
  }

  function openEdit(pkg: HostingPackage) {
    setEditing({ ...pkg })
    setOpen(true)
  }

  const columns: ColumnDef<HostingPackage>[] = [
    {
      accessorKey: 'name',
      header: 'Package',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <div>
            <div className="font-medium text-sm">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.users_count ?? 0} users</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price/mo',
      cell: ({ row }) => <span className="font-medium text-sm">${row.original.price.toFixed(2)}</span>,
    },
    { accessorKey: 'domains', header: 'Domains', cell: ({ row }) => <ResourceCell value={row.original.domains} unit="domains" /> },
    { accessorKey: 'disk_gb', header: 'Disk', cell: ({ row }) => <ResourceCell value={row.original.disk_gb} unit="GB" /> },
    { accessorKey: 'bandwidth_gb', header: 'Bandwidth', cell: ({ row }) => <ResourceCell value={row.original.bandwidth_gb} unit="GB/mo" /> },
    { accessorKey: 'email_accounts', header: 'Email', cell: ({ row }) => <ResourceCell value={row.original.email_accounts} unit="accounts" /> },
    { accessorKey: 'databases', header: 'DBs', cell: ({ row }) => <ResourceCell value={row.original.databases} unit="dbs" /> },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => row.original.active
        ? <span className="flex items-center gap-1 text-emerald-500 text-sm"><CheckCircle2 className="h-3.5 w-3.5" /> Active</span>
        : <span className="flex items-center gap-1 text-muted-foreground text-sm"><XCircle className="h-3.5 w-3.5" /> Inactive</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <ConfirmDialog
            description={`Delete package "${row.original.name}"? Users on this plan won't be affected immediately.`}
            onConfirm={async () => { await deletePackage(row.original.id); qc.invalidateQueries({ queryKey: ['reseller-packages'] }); toast.success('Package deleted') }}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hosting Packages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define plans to assign to your reseller clients</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Package
        </Button>
      </div>

      <DataTable columns={columns} data={packages} searchKey="name" searchPlaceholder="Search packages..." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Package' : 'New Package'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Package Name</Label>
                <Input value={editing.name} onChange={e => setEditing(p => p ? { ...p, name: e.target.value } : p)} placeholder="Basic, Pro, Enterprise..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price ($/mo)</Label>
                  <Input type="number" min="0" step="0.01" value={editing.price} onChange={e => setEditing(p => p ? { ...p, price: +e.target.value } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Domains</Label>
                  <Input type="number" min="1" value={editing.domains} onChange={e => setEditing(p => p ? { ...p, domains: +e.target.value } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Disk (GB)</Label>
                  <Input type="number" min="1" value={editing.disk_gb} onChange={e => setEditing(p => p ? { ...p, disk_gb: +e.target.value } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bandwidth (GB/mo)</Label>
                  <Input type="number" min="1" value={editing.bandwidth_gb} onChange={e => setEditing(p => p ? { ...p, bandwidth_gb: +e.target.value } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Accounts</Label>
                  <Input type="number" min="0" value={editing.email_accounts} onChange={e => setEditing(p => p ? { ...p, email_accounts: +e.target.value } : p)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Databases</Label>
                  <Input type="number" min="0" value={editing.databases} onChange={e => setEditing(p => p ? { ...p, databases: +e.target.value } : p)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active} onCheckedChange={v => setEditing(p => p ? { ...p, active: v } : p)} />
                <Label>Active (available for new sign-ups)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>Cancel</Button>
            <Button onClick={() => editing && saveMut.mutate(editing)} disabled={saveMut.isPending || !editing?.name}>
              {saveMut.isPending ? 'Saving...' : 'Save Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
