import { ReactNode } from 'react'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StatsCardProps {
  title: string
  value: string | number
  unit?: string
  icon: LucideIcon
  trend?: number        // percent change, positive = up
  trendLabel?: string
  description?: string
  color?: 'default' | 'green' | 'blue' | 'amber' | 'red' | 'purple'
  loading?: boolean
  className?: string
  onClick?: () => void
}

const COLOR_MAP = {
  default: { icon: 'text-muted-foreground', bg: 'bg-muted/50' },
  green:   { icon: 'text-green-500',        bg: 'bg-green-500/10' },
  blue:    { icon: 'text-blue-500',         bg: 'bg-blue-500/10' },
  amber:   { icon: 'text-amber-500',        bg: 'bg-amber-500/10' },
  red:     { icon: 'text-red-500',          bg: 'bg-red-500/10' },
  purple:  { icon: 'text-purple-500',       bg: 'bg-purple-500/10' },
}

export function StatsCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendLabel,
  description,
  color = 'default',
  loading = false,
  className,
  onClick,
}: StatsCardProps) {
  const { icon: iconColor, bg } = COLOR_MAP[color]

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 space-y-3 transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className={cn('rounded-lg p-2', bg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-end gap-1">
          <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
          {unit && <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>}
        </div>
      )}

      {(trend !== undefined || description) && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend !== undefined && (
            <>
              {trend > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              ) : trend < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={cn(
                'font-medium',
                trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground'
              )}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </>
          )}
          <span className="text-muted-foreground">
            {trendLabel ?? description ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}
