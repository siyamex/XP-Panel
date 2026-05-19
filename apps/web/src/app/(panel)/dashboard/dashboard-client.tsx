"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Globe, Mail, Database, Shield, Activity, Server,
  FolderOpen, Lock, HardDrive, Code2, Container,
  CreditCard, Bot, Store, Users, Settings, Zap,
  Map, GitBranch, Bell, Key, BarChart3, Wifi,
  FileText, RefreshCw, Package, Terminal, AlertTriangle,
  CheckCircle, Clock, ExternalLink, ChevronRight,
  ArrowRight, Info,
} from "lucide-react";
import { MetricsChart } from "@/components/charts/MetricsChart";
import { cn } from "@/lib/utils/cn";

// ─── App sections (main grid) ─────────────────────────────────────────────────
const appSections = [
  {
    title: "Account Manager",
    color: "bg-blue-600",
    items: [
      { label: "Domains",        icon: Globe,     href: "/domains",     bg: "from-blue-500 to-blue-600" },
      { label: "Subdomains",     icon: Globe,     href: "/domains",     bg: "from-cyan-500 to-cyan-600" },
      { label: "DNS Management", icon: Wifi,      href: "/dns",         bg: "from-indigo-500 to-indigo-600" },
      { label: "SSL Certificates",icon: Lock,     href: "/ssl",         bg: "from-green-500 to-emerald-600" },
      { label: "FTP Management", icon: FolderOpen,href: "/files",       bg: "from-amber-500 to-orange-500" },
      { label: "Databases",      icon: Database,  href: "/databases",   bg: "from-emerald-500 to-teal-600" },
      { label: "Web Server",     icon: Server,    href: "/webserver",   bg: "from-sky-500 to-blue-600" },
      { label: "PHP Settings",   icon: Code2,     href: "/php",         bg: "from-violet-500 to-purple-600" },
      { label: "Redirects",      icon: ArrowRight,href: "/webserver",   bg: "from-orange-400 to-orange-500" },
      { label: "Statistics",     icon: BarChart3, href: "/monitoring",  bg: "from-blue-400 to-cyan-500" },
    ],
  },
  {
    title: "E-mail Manager",
    color: "bg-blue-600",
    items: [
      { label: "E-mail Accounts",  icon: Mail,       href: "/email",            bg: "from-purple-500 to-violet-600" },
      { label: "Forwarders",       icon: RefreshCw,  href: "/email/forwarders", bg: "from-fuchsia-500 to-pink-600" },
      { label: "DKIM / SPF",       icon: Key,        href: "/email/dkim",       bg: "from-indigo-500 to-blue-600" },
      { label: "Catch-All",        icon: Mail,       href: "/email",            bg: "from-teal-500 to-cyan-600" },
      { label: "Autoresponders",   icon: Mail,       href: "/email",            bg: "from-rose-500 to-red-600" },
      { label: "Vacation Messages",icon: Mail,       href: "/email",            bg: "from-amber-500 to-yellow-500" },
      { label: "SPAM Filters",     icon: Shield,     href: "/security",         bg: "from-red-500 to-rose-600" },
      { label: "MX Records",       icon: Wifi,       href: "/dns",              bg: "from-sky-500 to-indigo-500" },
      { label: "Webmail",          icon: ExternalLink,href: "/email",           bg: "from-emerald-500 to-green-600" },
    ],
  },
  {
    title: "Files & Backups",
    color: "bg-blue-600",
    items: [
      { label: "File Manager",   icon: FolderOpen, href: "/files",   bg: "from-amber-500 to-orange-600" },
      { label: "Backups",        icon: HardDrive,  href: "/backups", bg: "from-blue-500 to-indigo-600" },
      { label: "Backup Restore", icon: RefreshCw,  href: "/backups", bg: "from-teal-500 to-emerald-600" },
      { label: "Archiver",       icon: Package,    href: "/files",   bg: "from-violet-500 to-fuchsia-600" },
    ],
  },
  {
    title: "Security",
    color: "bg-blue-600",
    items: [
      { label: "Security Center", icon: Shield,        href: "/security",         bg: "from-red-500 to-rose-600" },
      { label: "Firewall",        icon: Zap,           href: "/security/firewall",bg: "from-orange-500 to-red-500" },
      { label: "Malware Scanner", icon: AlertTriangle, href: "/security/scanner", bg: "from-yellow-500 to-orange-500" },
      { label: "Security Events", icon: Bell,          href: "/security/events",  bg: "from-pink-500 to-rose-600" },
    ],
  },
  {
    title: "Monitoring",
    color: "bg-blue-600",
    items: [
      { label: "Live Metrics", icon: Activity, href: "/monitoring",        bg: "from-cyan-500 to-blue-600" },
      { label: "Alerts",       icon: Bell,     href: "/monitoring/alerts", bg: "from-yellow-500 to-amber-600" },
      { label: "Access Logs",  icon: FileText, href: "/monitoring/logs",   bg: "from-slate-500 to-gray-600" },
      { label: "Threat Map",   icon: Map,      href: "/monitoring/geomap", bg: "from-fuchsia-500 to-purple-700" },
    ],
  },
  {
    title: "Advanced Features",
    color: "bg-blue-600",
    items: [
      { label: "Docker",      icon: Container, href: "/docker",            bg: "from-blue-500 to-cyan-500" },
      { label: "Pipelines",   icon: GitBranch, href: "/devops",            bg: "from-violet-600 to-purple-700" },
      { label: "Marketplace", icon: Store,     href: "/marketplace",       bg: "from-emerald-500 to-teal-600" },
      { label: "AI Assistant",icon: Bot,       href: "/ai",                bg: "from-pink-500 to-fuchsia-600" },
      { label: "Cron Jobs",   icon: Clock,     href: "/admin/servers",     bg: "from-amber-600 to-orange-600" },
      { label: "Terminal",    icon: Terminal,  href: "/admin/servers",     bg: "from-gray-700 to-gray-900" },
      { label: "Admin Panel", icon: Package,   href: "/admin/users",       bg: "from-red-600 to-rose-700" },
      { label: "Settings",    icon: Settings,  href: "/settings/profile",  bg: "from-slate-500 to-slate-700" },
    ],
  },
];

// ─── Account stats (right sidebar) ───────────────────────────────────────────
const limits = [
  { label: "Disk Space", used: 528.3, total: 2048, unit: "MB" },
  { label: "Bandwidth", used: 54.8, total: 1000, unit: "MB" },
  { label: "Inode", used: 469, total: null, unit: "" },
];

const usage = [
  { label: "E-mails", used: 4, total: 10 },
  { label: "FTP Accounts", used: 2, total: 2 },
  { label: "Databases", used: 2, total: 2 },
  { label: "Subdomains", used: 5, total: 50 },
  { label: "Addon Domains", used: 1, total: 5 },
];

const recentActivity = [
  { icon: CheckCircle, color: "text-green-500", msg: "SSL renewed for example.com", time: "2m ago" },
  { icon: AlertTriangle, color: "text-yellow-500", msg: "High CPU on server-01", time: "15m ago" },
  { icon: Globe, color: "text-blue-500", msg: "Domain newsite.io created", time: "1h ago" },
  { icon: Shield, color: "text-purple-500", msg: "247 brute-force attempts blocked", time: "2h ago" },
  { icon: HardDrive, color: "text-cyan-500", msg: "Backup completed for all domains", time: "4h ago" },
];

// ─── Section icon grid ────────────────────────────────────────────────────────
function AppSection({ section }: { section: typeof appSections[0] }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Section header — blue bar like DirectAdmin */}
      <div className={cn("px-4 py-2.5", section.color)}>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{section.title}</h2>
      </div>

      {/* Icon grid */}
      <div className="bg-card p-5">
        <div className="flex flex-wrap gap-1">
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col items-center gap-2.5 w-[90px] py-3 px-1 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg",
                  item.bg
                )}>
                  <Icon className="w-7 h-7 text-white drop-shadow-sm" strokeWidth={1.5} />
                </div>
                <span className="text-[10.5px] font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Resource bar ─────────────────────────────────────────────────────────────
function ResourceBar({ label, used, total, unit }: { label: string; used: number; total: number | null; unit: string }) {
  const pct = total ? (used / total) * 100 : 0;
  const isOverLimit = pct >= 100;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
        isOverLimit ? "bg-orange-500/20" : "bg-green-500/20")}>
        <div className={cn("w-2.5 h-2.5 rounded-full", isOverLimit ? "bg-orange-500" : "bg-green-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {used}{unit} {total ? `/ ${total}${unit}` : "/ Unlimited"}
          </span>
        </div>
        {total && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", isOverLimit ? "bg-orange-500" : "bg-green-500")}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Usage counter ────────────────────────────────────────────────────────────
function UsageRow({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = (used / total) * 100;
  const isOver = pct >= 100;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
        isOver ? "bg-orange-500/20" : "bg-green-500/20")}>
        <div className={cn("w-2.5 h-2.5 rounded-full", isOver ? "bg-orange-500" : "bg-green-500")} />
      </div>
      <span className="text-xs font-medium flex-1">{label}</span>
      <span className="text-xs font-mono tabular-nums text-muted-foreground">{used} / {total}</span>
    </div>
  );
}

// ─── Right sidebar ────────────────────────────────────────────────────────────
function AccountSidebar() {
  return (
    <div className="space-y-4">
      {/* Your Account card */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-card px-4 py-3 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="font-semibold text-sm">Your Account</h2>
            <p className="text-xs text-muted-foreground">Statistics for your account</p>
          </div>
          <Link href="/settings/profile" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View More <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-card px-4 py-1">
          {/* Limits */}
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Limits</p>
          {limits.map((l) => (
            <ResourceBar key={l.label} {...l} />
          ))}

          {/* Usage */}
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Usage</p>
          {usage.map((u) => (
            <UsageRow key={u.label} {...u} />
          ))}

          {/* Account info */}
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Account Info</p>
          <div className="space-y-2 pb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5"><Globe className="w-3 h-3" />Domain</span>
              <span className="text-primary font-medium">demouser.example.com</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3" />Active Since</span>
              <span>Jan 15, 2024</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5"><Info className="w-3 h-3" />Plan</span>
              <span className="text-green-500 font-medium">Business Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Server performance mini chart */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-card px-4 py-3 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="font-semibold text-sm">Server Performance</h2>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </div>
          <Link href="/monitoring" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View More <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="bg-card p-4">
          <MetricsChart compact />
        </div>
      </div>

      {/* Recent activity */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-card px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Recent Activity</h2>
        </div>
        <div className="bg-card px-4 py-2 divide-y divide-border">
          {recentActivity.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-2.5 py-2.5">
                <Icon size={13} className={cn("mt-0.5 shrink-0", item.color)} />
                <p className="text-xs flex-1 min-w-0 leading-snug">{item.msg}</p>
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{item.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function DashboardClient() {
  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Control Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — manage your hosting environment</p>
      </div>

      {/* Two-column layout: main grid + sidebar */}
      <div className="flex gap-5 items-start">
        {/* Left: app sections */}
        <div className="flex-1 min-w-0 space-y-4">
          {appSections.map((section) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AppSection section={section} />
            </motion.div>
          ))}
        </div>

        {/* Right: account sidebar */}
        <div className="w-72 shrink-0">
          <AccountSidebar />
        </div>
      </div>
    </div>
  );
}
