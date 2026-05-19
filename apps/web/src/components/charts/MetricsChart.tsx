"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Mock 24-hour data — will be replaced by real WebSocket stream
const generateData = () => {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return {
      time: hour.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      cpu: Math.floor(20 + Math.random() * 50),
      ram: Math.floor(40 + Math.random() * 30),
      network: Math.floor(10 + Math.random() * 40),
    };
  });
};

const data = generateData();

export function MetricsChart({ compact }: { compact?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={compact ? 140 : 220}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--foreground))",
          }}
          itemStyle={{ color: "hsl(var(--foreground))" }}
        />
        {!compact && <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" iconSize={8} />}
        <Area
          type="monotone"
          dataKey="cpu"
          name="CPU"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#cpuGrad)"
        />
        <Area
          type="monotone"
          dataKey="ram"
          name="RAM"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#ramGrad)"
        />
        <Area
          type="monotone"
          dataKey="network"
          name="Network"
          stroke="#06b6d4"
          strokeWidth={2}
          fill="url(#netGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
