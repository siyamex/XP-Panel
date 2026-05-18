"use client";

import { motion } from "framer-motion";
import {
  Globe, Mail, Database, Shield, Activity, Server,
  TrendingUp, AlertTriangle, CheckCircle, Clock,
} from "lucide-react";
import { formatBytes, formatPercent, getUsageBgColor } from "@/lib/utils/format";
import { MetricsChart } from "@/components/charts/MetricsChart";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// Mock data — will be replaced by real API/WebSocket data
const stats = [
  { label: "Domains", value: "24", sub: "+2 this week", icon: Globe, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Email Accounts", value: "186", sub: "12.4 GB used", icon: Mail, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Databases", value: "31", sub: "MySQL + PostgreSQL", icon: Database, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "Security Score", value: "94/100", sub: "Excellent", icon: Shield, color: "text-green-500", bg: "bg-green-500/10" },
];

const resources = [
  { label: "CPU", used: 34, total: 100, unit: "%" },
  { label: "RAM", used: 6.2, total: 16, unit: "GB" },
  { label: "Disk", used: 142, total: 500, unit: "GB" },
  { label: "Bandwidth", used: 234, total: 1000, unit: "GB" },
];

const recentActivity = [
  { icon: CheckCircle, color: "text-green-500", msg: "SSL certificate renewed for example.com", time: "2m ago" },
  { icon: AlertTriangle, color: "text-yellow-500", msg: "High CPU usage detected on server-01", time: "15m ago" },
  { icon: Globe, color: "text-blue-500", msg: "Domain newsite.io created successfully", time: "1h ago" },
  { icon: Shield, color: "text-purple-500", msg: "Blocked 247 brute-force attempts", time: "2h ago" },
  { icon: Activity, color: "text-cyan-500", msg: "Backup completed for all domains", time: "4h ago" },
];

export function DashboardClient() {
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back — here&apos;s what&apos;s happening on your servers.
        </p>
      </motion.div>

      {/* KPI Stats */}
      <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={fadeUp}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <TrendingUp size={11} />
                      {stat.sub}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon size={18} className={stat.color} />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Resource Usage + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Server Performance</h2>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </div>
              <Activity size={16} className="text-muted-foreground" />
            </div>
            <MetricsChart />
          </div>
        </motion.div>

        {/* Resource gauges */}
        <motion.div variants={fadeUp}>
          <div className="bg-card border border-border rounded-xl p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Resource Usage</h2>
              <Server size={16} className="text-muted-foreground" />
            </div>
            <div className="space-y-4">
              {resources.map((res) => {
                const pct = (res.used / res.total) * 100;
                return (
                  <div key={res.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{res.label}</span>
                      <span className="font-medium tabular-nums">
                        {res.used}{res.unit} / {res.total}{res.unit}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        className={`h-full rounded-full ${getUsageBgColor(pct)}`}
                      />
                    </div>
                    <p className="text-xs text-right text-muted-foreground mt-0.5">
                      {formatPercent(pct)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={fadeUp}>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <Clock size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Icon size={15} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.msg}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
