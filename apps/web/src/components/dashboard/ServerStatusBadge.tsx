import { cn } from '@/lib/utils/cn'

type ServerStatus = 'active' | 'offline' | 'maintenance' | 'provisioning' | 'error'

interface ServerStatusBadgeProps {
  status: ServerStatus
  pulse?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const STATUS_CONFIG: Record<ServerStatus, { dot: string; label: string; text: string }> = {
  active:       { dot: 'bg-green-500',   label: 'Online',       text: 'text-green-600' },
  offline:      { dot: 'bg-red-500',     label: 'Offline',      text: 'text-red-600' },
  maintenance:  { dot: 'bg-amber-500',   label: 'Maintenance',  text: 'text-amber-600' },
  provisioning: { dot: 'bg-blue-500',    label: 'Provisioning', text: 'text-blue-600' },
  error:        { dot: 'bg-red-500',     label: 'Error',        text: 'text-red-600' },
}

export function ServerStatusBadge({
  status,
  pulse = true,
  showLabel = true,
  size = 'md',
  className,
}: ServerStatusBadgeProps) {
  const { dot, label, text } = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('rounded-full shrink-0', dotSize, dot, pulse && status === 'active' && 'animate-pulse')} />
      {showLabel && (
        <span className={cn('font-medium', textSize, text)}>{label}</span>
      )}
    </div>
  )
}
