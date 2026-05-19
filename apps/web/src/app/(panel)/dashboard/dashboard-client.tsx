"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Globe, Mail, Database, Shield, Activity, Server,
  FolderOpen, Lock, HardDrive, Code2, Container,
  CreditCard, Bot, Store, Users, Settings, Zap,
  Map, GitBranch, Bell, Key, BarChart3, Wifi,
  FileText, RefreshCw, Package, Terminal, AlertTriangle,
  CheckCircle, Clock, TrendingUp,
} from "lucide-react";
import { MetricsChart } from "@/components/charts/MetricsChart";
import { getUsageBgColor, formatPercent } from "@/lib/utils/format";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

// cPanel-style app sections with colorful icons
const appSections = [
  {
    title: "Domains",
    apps: [
      { label: "Domains", icon: Globe, href: "/domains", bg: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/30" },
      { label: "DNS Zone", icon: Wifi, href: "/dns/default", bg: "from-cyan-500 to-cyan-600", shadow: "shadow-cyan-500/30" },
      { label: "SSL / TLS", icon: Lock, href: "/ssl", bg: "from-green-500 to-green-600", shadow: "shadow-green-500/30" },
      { label: "Subdomains", icon: Globe, href: "/domains", bg: "from-teal-500 to-teal-600", shadow: "shadow-teal-500/30" },
    ],
  },
  {
    title: "Email",
    apps: [
      { label: "Mailboxes", icon: Mail, href: "/email", bg: "from-purple-500 to-purple-600", shadow: "shadow-purple-500/30" },
      { label: "Forwarders", icon: RefreshCw, href: "/email/forwarders", bg: "from-violet-500 to-violet-600", shadow: "shadow-violet-500/30" },
      { label: "DKIM / SPF", icon: Key, href: "/email/dkim", bg: "from-indigo-500 to-indigo-600", shadow: "shadow-indigo-500/30" },
    ],
  },
  {
    title: "Files",
    apps: [
      { label: "File Manager", icon: FolderOpen, href: "/files", bg: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/30" },
      { label: "Backups", icon: HardDrive, href: "/backups", bg: "from-orange-500 to-orange-600", shadow: "shadow-orange-500/30" },
    ],
  },
  {
    title: "Databases",
    apps: [
      { label: "Databases", icon: Database, href: "/databases", bg: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/30" },
      { label: "phpMyAdmin", icon: FileText, href: "/databases", bg: "from-lime-600 to-lime-700", shadow: "shadow-lime-500/30" },
    ],
  },
  {
    title: "Web Server",
    apps: [
      { label: "Web Server", icon: Server, href: "/webserver", bg: "from-sky-500 to-sky-600", shadow: "shadow-sky-500/30" },
      { label: "PHP Config", icon: Code2, href: "/php", bg: "from-blue-600 to-indigo-600", shadow: "shadow-blue-600/30" },
    ],
  },
  {
    title: "Security",
    apps: [
      { label: "Security", icon: Shield, href: "/security", bg: "from-red-500 to-red-600", shadow: "shadow-red-500/30" },
      { label: "Firewall", icon: Zap, href: "/security/firewall", bg: "from-rose-500 to-rose-600", shadow: "shadow-rose-500/30" },
      { label: "Scanner", icon: AlertTriangle, href: "/security/scanner", bg: "from-pink-500 to-pink-600", shadow: "shadow-pink-500/30" },
    ],
  },
  {
    title: "Monitoring",
    apps: [
      { label: "Monitoring", icon: Activity, href: "/monitoring", bg: "from-cyan-600 to-blue-600", shadow: "shadow-cyan-600/30" },
      { label: "Alerts", icon: Bell, href: "/monitoring/alerts", bg: "from-yellow-500 to-orange-500", shadow: "shadow-yellow-500/30" },
      { label: "Threat Map", icon: Map, href: "/monitoring/geomap", bg: "from-fuchsia-500 to-purple-600", shadow: "shadow-fuchsia-500/30" },
      { label: "Logs", icon: FileText, href: "/monitoring/logs", bg: "from-slate-500 to-slate-600", shadow: "shadow-slate-500/30" },
    ],
  },
  {
    title: "DevOps & Apps",
    apps: [
      { label: "Docker", icon: Container, href: "/docker", bg: "from-blue-500 to-cyan-500", shadow: "shadow-blue-500/30" },
      { label: "Pipelines", icon: GitBranch, href: "/devops", bg: "from-violet-600 to-purple-700", shadow: "shadow-violet-600/30" },
      { label: "Marketplace", icon: Store, href: "/marketplace", bg: "from-green-500 to-teal-600", shadow: "shadow-green-500/30" },
      { label: "AI Assistant", icon: Bot, href: "/ai", bg: "from-pink-500 to-rose-600", shadow: "shadow-pink-500/30" },
    ],
  },
  {
    title: "Account",
    apps: [
      { label: "Billing", icon: CreditCard, href: "/billing", bg: "from-emerald-600 to-green-700", shadow: "shadow-emerald-600/30" },
      { label: "Reseller", icon: Users, href: "/reseller", bg: "from-orange-500 to-amber-600", shadow: "shadow-orange-500/30" },
      { label: "Statistics", icon: BarChart3, href: "/monitoring", bg: "from-blue-400 to-blue-600", shadow: "shadow-blue-400/30" },
      { label: "Settings", icon: Settings, href: "/settings/profile", bg: "from-gray-500 to-gray-600", shadow: "shadow-gray-500/30" },
    ],
  },
  {
    title: "Advanced",
    apps: [
      { label: "Terminal", icon: Terminal, href: "/admin/servers", bg: "from-gray-800 to-gray-900", shadow: "shadow-gray-800/30" },
      { label: "Admin", icon: Package, href: "/admin/users", bg: "from-red-600 to-red-700", shadow: "shadow-red-600/30" },
    ],
  },
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

function AppIcon({ app, index }: { app: typeof appSections[0]["apps"][0]; index: number }) {
  const Icon = app.icon;
  return (
    <motion.div
      variants={fadeUp}
      transition={{ delay: index * 0.03 }}
      whileHover={{ scale: 1.08, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      <Link href={app.href} className="flex flex-col items-center gap-2 group cursor-pointer">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.bg} shadow-lg ${app.shadow} flex items-center justify-center transition-all duration-200 group-hover:shadow-xl group-hover:${app.shadow}`}>
          <Icon className="w-7 h-7 text-white drop-shadow" strokeWidth={1.8} />
        </div>
        <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors leading-tight max-w-[64px]">
          {app.label}
        </span>
      </Link>
    </motion.div>
  );
}

export function DashboardClient() {
  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back — manage your hosting environment.
        </p>
      </motion.div>

      {/* App Icon Grid — cPanel style */}
      <motion.div variants={fadeUp} className="bg-card border rounded-xl overflow-hidden">
        {appSections.map((section, si) => (
          <div key={section.title} className={si !== 0 ? "border-t" : ""}>
            {/* Section header */}
            <div className="px-5 py-2.5 bg-muted/40">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h2>
            </div>
            {/* Icons */}
            <div className="px-5 py-5">
              <motion.div
                variants={stagger}
                className="flex flex-wrap gap-x-6 gap-y-5"
              >
                {section.apps.map((app, ai) => (
                  <AppIcon key={app.label} app={app} index={si * 10 + ai} />
                ))}
              </motion.div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Resource Usage + Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <div className="bg-card border rounded-xl p-5">
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

        <motion.div variants={fadeUp}>
          <div className="bg-card border rounded-xl p-5 h-full">
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
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
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
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <Clock size={16} className="text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${item.color}`} />
                  <p className="text-sm flex-1 min-w-0 truncate">{item.msg}</p>
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
