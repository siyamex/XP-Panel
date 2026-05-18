'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Globe, ArrowLeft } from 'lucide-react'
import { dnsApi } from '@/lib/api/dns.api'
import { DNSRecordTable } from '@/components/dns/DNSRecordTable'
import Link from 'next/link'

interface Props {
  params: Promise<{ zoneId: string }>
}

export default function DNSZonePage({ params }: Props) {
  const { zoneId } = use(params)

  const { data: zone, isLoading, error } = useQuery({
    queryKey: ['dns-zone', zoneId],
    queryFn: () => dnsApi.getZone(zoneId),
    select: (r) => r.data,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !zone) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load DNS zone.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/domains" className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            {zone.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            DNS Zone Editor · {zone.records?.length ?? 0} records · Serial: {zone.serial}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-muted rounded capitalize">{zone.kind}</span>
          <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded capitalize">{zone.status}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <DNSRecordTable zone={zone} />
      </div>

      {/* Nameservers */}
      {zone.nameservers && zone.nameservers.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Nameservers</h3>
          <div className="flex flex-wrap gap-2">
            {zone.nameservers.map((ns) => (
              <span key={ns} className="text-xs font-mono bg-muted px-3 py-1.5 rounded-md">{ns}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
