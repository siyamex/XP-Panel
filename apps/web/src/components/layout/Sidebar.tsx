"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Globe, Server, Mail, FolderOpen, Database,
  Shield, Activity, Package, CreditCard, Bot, Code2, Container,
  Settings, Users, ChevronLeft, ChevronRight, Store, Bell,
  Map, Zap, HardDrive, Lock, Clock, Wifi, ArrowRight, KeyRound,
  Terminal, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/lib/stores/ui.store";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/monitoring", icon: Activity, label: "Monitoring" },
      { href: "/ai", icon: Bot, label: "AI Assistant" },
    ],
  },
  {
    label: "Hosting",
    items: [
      { href: "/domains", icon: Globe, label: "Domains" },
      { href: "/subdomains", icon: Globe, label: "Subdomains" },
      { href: "/email", icon: Mail, label: "Email" },
      { href: "/email/autoresponders", icon: Mail, label: "Autoresponders" },
      { href: "/email/filters", icon: Mail, label: "Email Filters" },
      { href: "/email/queue", icon: Mail, label: "Mail Queue" },
      { href: "/email/webmail", icon: Globe, label: "Webmail" },
      { href: "/files", icon: FolderOpen, label: "File Manager" },
      { href: "/databases", icon: Database, label: "Databases" },
      { href: "/php", icon: Code2, label: "PHP" },
      { href: "/webserver", icon: Server, label: "Web Server" },
      { href: "/ssl", icon: Lock, label: "SSL / TLS" },
    ],
  },
  {
    label: "Domain Tools",
    items: [
      { href: "/redirects", icon: ArrowRight, label: "Redirects" },
      { href: "/cron", icon: Clock, label: "Cron Jobs" },
      { href: "/ftp", icon: Wifi, label: "FTP Accounts" },
      { href: "/ssh-keys", icon: KeyRound, label: "SSH Keys" },
      { href: "/terminal", icon: Terminal, label: "SSH Terminal" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/backups", icon: HardDrive, label: "Backups" },
      { href: "/docker", icon: Container, label: "Docker" },
      { href: "/devops", icon: Zap, label: "DevOps" },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/security", icon: Shield, label: "Security" },
      { href: "/security/geoip", icon: Map, label: "GeoIP Blocking" },
      { href: "/security/waf", icon: Shield, label: "WAF / ModSec" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/billing", icon: CreditCard, label: "Billing" },
      { href: "/marketplace", icon: Store, label: "Marketplace" },
      { href: "/reseller", icon: Users, label: "Reseller" },
      { href: "/reseller/users", icon: Users, label: "Reseller Users" },
      { href: "/reseller/packages", icon: Package, label: "Packages" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/monitoring/servers", icon: Server, label: "Servers" },
      { href: "/monitoring/bandwidth", icon: BarChart2, label: "Bandwidth" },
      { href: "/monitoring/disk", icon: HardDrive, label: "Disk Usage" },
      { href: "/monitoring/geomap", icon: Map, label: "GeoMap" },
      { href: "/notifications", icon: Bell, label: "Notifications" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/dns/propagation", icon: Zap, label: "DNS Propagation" },
      { href: "/email/dmarc", icon: Shield, label: "DMARC" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/servers", icon: Package, label: "Servers" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">X</span>
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-bold text-sidebar-foreground whitespace-nowrap overflow-hidden"
            >
              XP-Panel
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40"
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shadow-sm z-10"
      >
        {sidebarCollapsed ? (
          <ChevronRight size={12} />
        ) : (
          <ChevronLeft size={12} />
        )}
      </button>
    </motion.aside>
  );
}

function NavItem({
  item,
  isActive,
  collapsed,
}: {
  item: { href: string; icon: React.ElementType; label: string };
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-all duration-150",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon size={16} className="shrink-0" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            className="whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
