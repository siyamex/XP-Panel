import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

type StatusVariant = 'active' | 'inactive' | 'pending' | 'running' | 'failed' | 'success' | 'warning' | 'error' | 'offline' | 'disabled'

const variantStyles: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  success:  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  running:  'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  pending:  'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  warning:  'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  failed:   'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  error:    'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  inactive: 'bg-muted text-muted-foreground border-border',
  offline:  'bg-muted text-muted-foreground border-border',
  disabled: 'bg-muted text-muted-foreground border-border',
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const styles = variantStyles[status.toLowerCase()] ?? variantStyles.inactive
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium capitalize', styles, className)}
    >
      {label ?? status}
    </Badge>
  )
}
