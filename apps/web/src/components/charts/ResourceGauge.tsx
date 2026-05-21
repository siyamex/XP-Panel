'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils/cn'

interface ResourceGaugeProps {
  value: number        // 0-100
  label: string
  unit?: string
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  className?: string
}

function getColor(value: number): string {
  if (value >= 90) return '#ef4444'  // red
  if (value >= 75) return '#f59e0b'  // amber
  if (value >= 50) return '#3b82f6'  // blue
  return '#22c55e'                    // green
}

const SIZE_MAP = {
  sm: { outer: 60, inner: 42, fontSize: 'text-xs', labelSize: 'text-[10px]' },
  md: { outer: 80, inner: 58, fontSize: 'text-sm',  labelSize: 'text-xs' },
  lg: { outer: 120, inner: 88, fontSize: 'text-lg', labelSize: 'text-sm' },
}

export function ResourceGauge({
  value,
  label,
  unit = '%',
  size = 'md',
  showValue = true,
  className,
}: ResourceGaugeProps) {
  const capped = Math.min(100, Math.max(0, value))
  const color = getColor(capped)
  const { outer, inner, fontSize, labelSize } = SIZE_MAP[size]
  const data = [{ value: capped }]

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div style={{ width: outer, height: outer }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius={`${Math.round((inner / outer) * 100)}%`}
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            {/* Background track */}
            <RadialBar
              dataKey="value"
              cornerRadius={4}
              fill="hsl(var(--muted))"
              background={{ fill: 'hsl(var(--muted))' }}
            />
            {/* Value arc */}
            <RadialBar
              dataKey="value"
              cornerRadius={4}
              fill={color}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={cn('font-bold tabular-nums leading-none', fontSize)} style={{ color }}>
              {Math.round(capped)}
            </span>
            <span className={cn('text-muted-foreground leading-none', labelSize)}>{unit}</span>
          </div>
        )}
      </div>

      <span className={cn('text-muted-foreground font-medium', labelSize)}>{label}</span>
    </div>
  )
}
