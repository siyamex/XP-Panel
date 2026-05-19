'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Loader2, Code2, ChevronDown, Check, Globe, RefreshCw } from 'lucide-react'
import { webserverApi, type Vhost } from '@/lib/api/webserver.api'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const PHP_VERSIONS = ['8.3', '8.2', '8.1', '8.0', '7.4']

const VERSION_COLORS: Record<string, string> = {
  '8.3': 'from-violet-500 to-purple-600',
  '8.2': 'from-blue-500 to-indigo-600',
  '8.1': 'from-cyan-500 to-blue-500',
  '8.0': 'from-teal-500 to-cyan-600',
  '7.4': 'from-slate-500 to-gray-600',
}

const PHP_DEFAULTS = [
  { label: 'memory_limit',        value: '256M' },
  { label: 'max_execution_time',  value: '300s' },
  { label: 'upload_max_filesize', value: '64M' },
  { label: 'post_max_size',       value: '64M' },
  { label: 'max_input_vars',      value: '3000' },
  { label: 'opcache.enable',      value: 'On' },
  { label: 'opcache.memory',      value: '256M' },
  { label: 'session.gc_maxlife',  value: '1440s' },
]

function VersionSelect({ vhost, onSave }: { vhost: Vhost; onSave: (id: string, version: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const current = vhost.php_version

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
          current
            ? 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
        )}
      >
        <Code2 className="w-3.5 h-3.5" />
        {current ? `PHP ${current}` : 'No PHP'}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden w-36">
          <button
            onClick={() => { onSave(vhost.id, null); setOpen(false) }}
            className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
          >
            <span className="text-muted-foreground">Disabled</span>
            {!current && <Check className="w-3 h-3 text-primary" />}
          </button>
          <div className="border-t border-border" />
          {PHP_VERSIONS.map(v => (
            <button
              key={v}
              onClick={() => { onSave(vhost.id, v); setOpen(false) }}
              className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-muted transition-colors font-mono"
            >
              <span>PHP {v}</span>
              {current === v && <Check className="w-3 h-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PHPPage() {
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vhosts'],
    queryFn: () => webserverApi.listVhosts(),
    select: r => r.data,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: string | null }) =>
      webserverApi.updatePHP(id, version),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vhosts'] }); toast.success('PHP version updated') },
    onError: () => toast.error('Failed to update PHP version'),
  })

  const vhosts = data?.vhosts ?? []
  const phpVhosts = vhosts.filter(v => v.php_version)

  // count per version
  const versionCounts: Record<string, number> = {}
  phpVhosts.forEach(v => {
    if (v.php_version) versionCounts[v.php_version] = (versionCounts[v.php_version] ?? 0) + 1
  })
  const total = phpVhosts.length || 1

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PHP Configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage PHP-FPM versions per virtual host</p>
      </div>

      {/* Version distribution cards */}
      <div className="grid grid-cols-5 gap-3">
        {PHP_VERSIONS.map(v => {
          const count = versionCounts[v] ?? 0
          return (
            <motion.div
              key={v}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('rounded-xl p-4 bg-gradient-to-br text-white', VERSION_COLORS[v])}
            >
              <div className="text-xs font-medium opacity-80">PHP</div>
              <div className="text-2xl font-bold font-mono">{v}</div>
              <div className="text-xs opacity-70 mt-1">{count} domain{count !== 1 ? 's' : ''}</div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Version usage bar chart */}
        <div className="col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Version Distribution</h3>
          <div className="space-y-3">
            {PHP_VERSIONS.map(v => {
              const count = versionCounts[v] ?? 0
              const pct = (count / total) * 100
              return (
                <div key={v} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-medium">PHP {v}</span>
                    <span className="text-muted-foreground text-xs">{count} domain{count !== 1 ? 's' : ''} — {Math.round(pct)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={cn('h-full rounded-full bg-gradient-to-r', VERSION_COLORS[v])}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Global defaults */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Default php.ini</h3>
          <div className="space-y-0">
            {PHP_DEFAULTS.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
                <span className="font-mono text-xs font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-domain PHP version manager */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Per-Domain PHP Version</h3>
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : vhosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <Code2 className="w-8 h-8 opacity-20" />
            <p className="text-sm">No virtual hosts found — create one in <a href="/webserver" className="text-primary hover:underline">Web Server</a></p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Server</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">PHP Version</th>
              </tr>
            </thead>
            <tbody>
              {vhosts.map(v => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{v.domain_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-muted-foreground">{v.server_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                      v.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex justify-end">
                    <VersionSelect
                      vhost={v}
                      onSave={(id, version) => updateMutation.mutate({ id, version })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
