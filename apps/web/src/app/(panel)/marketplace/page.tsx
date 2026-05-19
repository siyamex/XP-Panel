'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Store, Star, Download, Loader2, CheckCircle2, Trash2, Search } from 'lucide-react'
import { marketplaceApi } from '@/lib/api/marketplace.api'
import type { InstallRequest, MarketplaceApp } from '@/types/marketplace.types'
import { APP_CATEGORIES } from '@/types/marketplace.types'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const CATEGORY_COLORS: Record<string, string> = {
  cms:        'bg-blue-500/10 text-blue-500',
  framework:  'bg-purple-500/10 text-purple-500',
  storage:    'bg-amber-500/10 text-amber-500',
  automation: 'bg-green-500/10 text-green-500',
  analytics:  'bg-pink-500/10 text-pink-500',
  community:  'bg-orange-500/10 text-orange-500',
}

const APP_ICONS: Record<string, string> = {
  wordpress:  '🔵',
  laravel:    '🔴',
  nextjs:     '⬛',
  ghost:      '👻',
  minio:      '🪣',
  n8n:        '🔄',
  matomo:     '📊',
  discourse:  '💬',
}

export default function MarketplacePage() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null)
  const [tab, setTab] = useState<'apps' | 'installed'>('apps')
  const qc = useQueryClient()

  const { data: appsData, isLoading } = useQuery({
    queryKey: ['marketplace-apps'],
    queryFn: () => marketplaceApi.listApps(),
    select: (r) => r.data?.apps ?? [],
  })

  const { data: installations } = useQuery({
    queryKey: ['marketplace-installations'],
    queryFn: () => marketplaceApi.listInstallations(),
    select: (r) => r.data?.installations ?? [],
  })

  const uninstallMutation = useMutation({
    mutationFn: (id: string) => marketplaceApi.uninstallApp(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketplace-installations'] }); toast.success('App uninstalled') },
    onError: () => toast.error('Failed to uninstall'),
  })

  const apps = (appsData ?? []).filter((a) => {
    if (category !== 'all' && a.category !== category) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const featured = apps.filter((a) => a.is_featured)
  const rest = apps.filter((a) => !a.is_featured)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">One-click app installers and plugins</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['apps', 'installed'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors', tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'installed' ? `Installed (${installations?.length ?? 0})` : 'Browse Apps'}
          </button>
        ))}
      </div>

      {tab === 'apps' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search apps..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              {APP_CATEGORIES.map((cat) => (
                <button key={cat.value} onClick={() => setCategory(cat.value)} className={cn('px-3 py-1 text-xs rounded-md transition-colors whitespace-nowrap', category === cat.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-6">
              {featured.length > 0 && category === 'all' && !search && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Featured</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {featured.map((app) => <AppCard key={app.id} app={app} onInstall={() => setSelectedApp(app)} />)}
                  </div>
                </div>
              )}
              {rest.length > 0 && (
                <div>
                  {category === 'all' && !search && <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">All Apps</h3>}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(category === 'all' && !search ? rest : apps).map((app) => <AppCard key={app.id} app={app} onInstall={() => setSelectedApp(app)} />)}
                  </div>
                </div>
              )}
              {apps.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Store className="w-10 h-10 mb-2 opacity-30" />
                  No apps found
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'installed' && (
        <div className="space-y-3">
          {!installations?.length ? (
            <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-xl text-muted-foreground">
              <Store className="w-10 h-10 mb-2 opacity-30" />
              No apps installed yet
            </div>
          ) : (
            installations.map((inst) => (
              <div key={inst.id} className="bg-card border border-border rounded-xl flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{APP_ICONS[inst.app?.slug ?? ''] ?? '📦'}</span>
                  <div>
                    <div className="font-medium text-sm">{inst.app?.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{inst.install_path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', inst.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                    {inst.status}
                  </span>
                  <button onClick={() => { if (confirm('Uninstall app?')) uninstallMutation.mutate(inst.id) }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedApp && <InstallModal app={selectedApp} onClose={() => setSelectedApp(null)} />}
      </AnimatePresence>
    </div>
  )
}

function AppCard({ app, onInstall }: { app: MarketplaceApp; onInstall: () => void }) {
  const CATEGORY_COLORS: Record<string, string> = {
    cms:        'bg-blue-500/10 text-blue-500',
    framework:  'bg-purple-500/10 text-purple-500',
    storage:    'bg-amber-500/10 text-amber-500',
    automation: 'bg-green-500/10 text-green-500',
    analytics:  'bg-pink-500/10 text-pink-500',
    community:  'bg-orange-500/10 text-orange-500',
  }
  const APP_ICONS: Record<string, string> = {
    wordpress: '🔵', laravel: '🔴', nextjs: '⬛', ghost: '👻',
    minio: '🪣', n8n: '🔄', matomo: '📊', discourse: '💬',
  }
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{APP_ICONS[app.slug] ?? '📦'}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLORS[app.category] ?? 'bg-muted text-muted-foreground')}>
          {app.category}
        </span>
      </div>
      <div className="font-semibold text-sm">{app.name}</div>
      <div className="text-xs text-muted-foreground mt-1 flex-1 line-clamp-2">{app.description}</div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500 fill-amber-500" />{app.rating}</span>
          <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{app.install_count.toLocaleString()}</span>
        </div>
        <span className="text-xs text-muted-foreground">v{app.version}</span>
      </div>
      <button onClick={onInstall} className="mt-3 w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
        Install
      </button>
    </div>
  )
}

function InstallModal({ app, onClose }: { app: MarketplaceApp; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm<InstallRequest>({
    defaultValues: { app_slug: app.slug, install_path: `/var/www/${app.slug}` }
  })
  const mutation = useMutation({
    mutationFn: (data: InstallRequest) => marketplaceApi.installApp(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-installations'] })
      toast.success(`${app.name} installed successfully!`)
      onClose()
    },
    onError: () => toast.error('Installation failed'),
  })
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <span className="text-2xl">{{'wordpress':'🔵','laravel':'🔴','nextjs':'⬛','ghost':'👻','minio':'🪣','n8n':'🔄','matomo':'📊','discourse':'💬'}[app.slug] ?? '📦'}</span>
          <div>
            <h2 className="font-semibold">Install {app.name}</h2>
            <p className="text-xs text-muted-foreground">v{app.version} by {app.author}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Install Path</label>
            <input {...register('install_path', { required: true })} className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Site Name</label>
              <input {...register('site_name')} placeholder="My Website" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Email</label>
              <input {...register('admin_email')} type="email" placeholder="admin@example.com" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Username</label>
              <input {...register('admin_user')} placeholder="admin" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Password</label>
              <input {...register('admin_pass')} type="password" placeholder="••••••••" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span>Database will be provisioned automatically</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Installing...' : `Install ${app.name}`}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const _ = { CATEGORY_COLORS, APP_ICONS }
void _
