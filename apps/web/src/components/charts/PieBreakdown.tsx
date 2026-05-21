'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Segment {
  name: string
  value: number
  color?: string
}

interface PieBreakdownProps {
  data: Segment[]
  height?: number
  showLegend?: boolean
  innerRadius?: number
  formatter?: (value: number) => string
}

const DEFAULT_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
]

const CustomTooltip = ({ active, payload, formatter }: any) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: { color } } = payload[0]
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span>{name}:</span>
        <span className="font-medium font-mono">{formatter ? formatter(value) : value}</span>
      </div>
    </div>
  )
}

export function PieBreakdown({
  data,
  height = 200,
  showLegend = true,
  innerRadius = 50,
  formatter,
}: PieBreakdownProps) {
  const colored = data.map((d, i) => ({
    ...d,
    color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={colored}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={innerRadius + 28}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {colored.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        {showLegend && (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => <span className="text-muted-foreground">{v}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  )
}
