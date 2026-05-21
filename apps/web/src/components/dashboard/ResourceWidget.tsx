'use client'

import { ResourceGauge } from '@/components/charts/ResourceGauge'
import { cn } from '@/lib/utils/cn'

interface ResourceMetrics {
  cpu: number
  ram: number
  disk: number
  network_in?: number  // MB/s
  network_out?: number // MB/s
}

interface ResourceWidgetProps {
  metrics: ResourceMetrics
  loading?: boolean
  className?: string
}

function NetStat({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">
        {value < 1 ? `${(value * 1024).toFixed(0)} KB/s` : `${value.toFixed(1)} MB/s`}
      </span>
    </div>
  )
}

export function ResourceWidget({ metrics, loading = false, className }: ResourceWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
        <div className="flex items-center justify-around">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
              <div className="w-10 h-3 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-4', className)}>
      <div className="text-sm font-medium text-muted-foreground">System Resources</div>

      <div className="flex items-center justify-around">
        <ResourceGauge value={metrics.cpu}  label="CPU"  size="md" />
        <ResourceGauge value={metrics.ram}  label="RAM"  size="md" />
        <ResourceGauge value={metrics.disk} label="Disk" size="md" />
      </div>

      {(metrics.network_in !== undefined || metrics.network_out !== undefined) && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <NetStat label="↓ Inbound"  value={metrics.network_in} />
          <NetStat label="↑ Outbound" value={metrics.network_out} />
        </div>
      )}
    </div>
  )
}
