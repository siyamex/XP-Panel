'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Globe, ShieldCheck, Server, Database, Code2, ArrowLeft, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { domainsApi, sslApi, vhostApi } from '@/lib/api/domains.api'
import { dnsApi } from '@/lib/api/dns.api'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import Link from 'next/link'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Globe },
  { id: 'dns', label: 'DNS', icon: Server },
  { id: 'ssl', label: 'SSL', icon: ShieldCheck },
  { id: 'php', label: 'PHP', icon: Code2 },
]

export default function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tab, setTab] = useState('overview')
  const router = useRouter()
  const qc = useQueryClient()

  const { data: domain, isLoading } = useQuery({
    queryKey: ['domain', id],
    queryFn: () => domainsApi.get(id),
    select: (r) => r.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => domainsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domains'] }); toast.success('Domain deleted'); router.push('/domains') },
    onError: () => toast.error('Failed to delete domain'),
  })

  const suspendMutation = useMutation({
    mutationFn: () => domainsApi.suspend(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domain', id] }); toast.success('Domain suspended') },
    onError: () => toast.error('Failed to suspend domain'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (!domain) return (
    <div className="p-6 text-center text-muted-foreground">Domain not found</div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/domains" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{domain.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-xs px-2 py-0.5 rounded-full', domain.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                {domain.status}
              </span>
              <span className="text-xs text-muted-foreground">{domain.webserver_type}</span>
              {domain.php_version && <span className="text-xs text-muted-foreground">PHP {domain.php_version}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { if (confirm('Suspend domain?')) suspendMutation.mutate() }} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted transition-colors">
            Suspend
          </button>
          <button onClick={() => { if (confirm(`Delete ${domain.name}? This cannot be undone.`)) deleteMutation.mutate() }} className="px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {tab === 'overview' && <OverviewTab domain={domain} />}
        {tab === 'dns' && <DNSTab domainName={domain.name} />}
        {tab === 'ssl' && <SSLTab domainName={domain.name} />}
        {tab === 'php' && <PHPTab domainName={domain.name} phpVersion={domain.php_version} />}
      </motion.div>
    </div>
  )
}

function OverviewTab({ domain }: { domain: any }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Domain Details</h3>
        {[
          { label: 'Domain Name', value: domain.name },
          { label: 'Status', value: domain.status },
          { label: 'Web Server', value: domain.webserver_type },
          { label: 'PHP Version', value: domain.php_version ?? 'None' },
          { label: 'SSL', value: domain.ssl_enabled ? 'Enabled' : 'Disabled' },
          { label: 'Document Root', value: domain.document_root ?? '/var/www/' + domain.name },
          { label: 'Created', value: formatDate(domain.created_at) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium font-mono text-xs">{value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Resource Usage</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{domain.disk_used_mb ?? 0} MB</div>
              <div className="text-xs text-muted-foreground mt-0.5">Disk Used</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{domain.bandwidth_used_mb ?? 0} MB</div>
              <div className="text-xs text-muted-foreground mt-0.5">Bandwidth</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Quick Links</h3>
          <div className="space-y-2">
            {[
              { label: 'File Manager', href: '/files' },
              { label: 'DNS Records', href: '#', onClick: () => {} },
              { label: 'SSL Certificate', href: '/ssl' },
              { label: 'Email Accounts', href: '/email' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                <span>{label}</span>
                <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DNSTab({ domainName }: { domainName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dns-zones'],
    queryFn: () => dnsApi.listZones(),
    select: (r) => r.data,
  })

  const zone = data?.zones?.find((z: any) => z.name === domainName + '.' || z.name === domainName)

  if (isLoading) return <div className="flex justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-8" /></div>

  if (!zone) return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-muted-foreground">No DNS zone found for this domain</p>
      <p className="text-xs text-muted-foreground/70 mt-1">Create a DNS zone from the DNS section</p>
    </div>
  )

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">DNS Records</h3>
        <Link href={`/dns/${zone.id}`} className="text-xs text-primary hover:underline">Edit in DNS Manager →</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Value</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">TTL</th>
          </tr>
        </thead>
        <tbody>
          {(zone.records ?? []).slice(0, 10).map((r: any) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs">{r.name}</td>
              <td className="px-4 py-2.5"><span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{r.type}</span></td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-xs">{r.content}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.ttl}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SSLTab({ domainName }: { domainName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ssl-certs'],
    queryFn: () => sslApi.list(),
    select: (r) => r.data,
  })

  const cert = data?.certificates?.find((c: any) => c.domain === domainName)
  const qc = useQueryClient()

  const renewMutation = useMutation({
    mutationFn: (id: string) => sslApi.renew(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ssl-certs'] }); toast.success('Renewal initiated') },
  })

  if (isLoading) return <div className="flex justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-8" /></div>

  if (!cert) return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-muted-foreground">No SSL certificate for this domain</p>
      <Link href="/ssl" className="mt-3 inline-block text-xs text-primary hover:underline">Issue certificate →</Link>
    </div>
  )

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">SSL Certificate</h3>
        <button onClick={() => renewMutation.mutate(cert.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <RefreshCw className="w-3 h-3" />Renew
        </button>
      </div>
      {[
        { label: 'Status', value: cert.status },
        { label: 'Provider', value: cert.provider },
        { label: 'Issuer', value: cert.issuer ?? '—' },
        { label: 'Expires', value: cert.expires_at ? formatDate(cert.expires_at) : '—' },
        { label: 'SANs', value: cert.san_domains?.length > 0 ? cert.san_domains.join(', ') : 'None' },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono text-xs">{value}</span>
        </div>
      ))}
    </div>
  )
}

function PHPTab({ domainName, phpVersion }: { domainName: string; phpVersion?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold mb-4">PHP Configuration</h3>
      {phpVersion ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="font-medium">PHP {phpVersion} active</span>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: 'PHP Version', value: phpVersion },
              { label: 'FPM Pool', value: domainName.replace(/\./g, '_') },
              { label: 'Socket', value: `/run/php/php${phpVersion}-fpm-${domainName}.sock` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Code2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No PHP configured for this domain</p>
          <Link href="/php" className="text-xs text-primary hover:underline mt-1 block">Configure PHP →</Link>
        </div>
      )}
    </div>
  )
}
