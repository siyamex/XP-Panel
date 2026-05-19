'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Code2, ChevronRight } from 'lucide-react'
import { vhostApi } from '@/lib/api/domains.api'

const PHP_VERSIONS = ['8.3', '8.2', '8.1', '8.0', '7.4']

export default function PHPPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['vhosts'],
    queryFn: () => vhostApi.list(),
    select: (r) => r.data,
  })

  const phpVhosts = (data?.vhosts ?? []).filter((v) => v.php_version)
  const versionCounts: Record<string, number> = {}
  phpVhosts.forEach((v) => {
    if (v.php_version) versionCounts[v.php_version] = (versionCounts[v.php_version] ?? 0) + 1
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PHP Configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage PHP versions and per-domain settings</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* PHP Version Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">PHP Version Usage</h3>
          <div className="space-y-3">
            {PHP_VERSIONS.map((v) => {
              const count = versionCounts[v] ?? 0
              const total = phpVhosts.length || 1
              const pct = (count / total) * 100
              return (
                <div key={v} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">PHP {v}</span>
                    <span className="text-muted-foreground">{count} domains</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Global PHP settings summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Default Settings</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'memory_limit', value: '256M' },
              { label: 'max_execution_time', value: '300s' },
              { label: 'upload_max_filesize', value: '64M' },
              { label: 'post_max_size', value: '64M' },
              { label: 'max_input_vars', value: '3000' },
              { label: 'opcache.enable', value: 'On' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="font-mono text-xs text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Domains with PHP */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Domains with PHP</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : phpVhosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Code2 className="w-8 h-8 mb-2 opacity-30" />
            No domains with PHP configured
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PHP Version</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Web Server</th>
              </tr>
            </thead>
            <tbody>
              {phpVhosts.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{v.domain_name}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">PHP {v.php_version}</span></td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{v.server_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
