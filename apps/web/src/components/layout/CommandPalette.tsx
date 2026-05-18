"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Globe, Mail, FolderOpen, Database,
  Shield, Activity, Bot, Code2, Container, Zap, CreditCard,
  Store, Settings, Server, Map, HardDrive, Lock, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/lib/stores/ui.store";

const commands = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, category: "Navigation" },
  { id: "domains", label: "Domains", href: "/domains", icon: Globe, category: "Navigation" },
  { id: "email", label: "Email", href: "/email", icon: Mail, category: "Navigation" },
  { id: "files", label: "File Manager", href: "/files", icon: FolderOpen, category: "Navigation" },
  { id: "databases", label: "Databases", href: "/databases", icon: Database, category: "Navigation" },
  { id: "php", label: "PHP Settings", href: "/php", icon: Code2, category: "Navigation" },
  { id: "ssl", label: "SSL / TLS", href: "/ssl", icon: Lock, category: "Navigation" },
  { id: "backups", label: "Backups", href: "/backups", icon: HardDrive, category: "Navigation" },
  { id: "docker", label: "Docker", href: "/docker", icon: Container, category: "Navigation" },
  { id: "devops", label: "DevOps Pipelines", href: "/devops", icon: Zap, category: "Navigation" },
  { id: "security", label: "Security", href: "/security", icon: Shield, category: "Navigation" },
  { id: "monitoring", label: "Monitoring", href: "/monitoring", icon: Activity, category: "Navigation" },
  { id: "geomap", label: "GeoMap", href: "/monitoring/geomap", icon: Map, category: "Navigation" },
  { id: "billing", label: "Billing", href: "/billing", icon: CreditCard, category: "Navigation" },
  { id: "marketplace", label: "Marketplace", href: "/marketplace", icon: Store, category: "Navigation" },
  { id: "ai", label: "AI Assistant", href: "/ai", icon: Bot, category: "Navigation" },
  { id: "servers", label: "Servers", href: "/admin/servers", icon: Server, category: "Admin" },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, category: "Navigation" },
];

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        setQuery("");
      }
      if (commandPaletteOpen) {
        if (e.key === "Escape") setCommandPaletteOpen(false);
        if (e.key === "ArrowDown")
          setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
        if (e.key === "ArrowUp")
          setSelectedIdx((i) => Math.max(i - 1, 0));
        if (e.key === "Enter" && filtered[selectedIdx]) {
          router.push(filtered[selectedIdx].href);
          setCommandPaletteOpen(false);
          setQuery("");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, filtered, selectedIdx, router, setCommandPaletteOpen]);

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCommandPaletteOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, commands, settings..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  filtered.map((cmd, i) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          router.push(cmd.href);
                          setCommandPaletteOpen(false);
                          setQuery("");
                        }}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          i === selectedIdx
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon size={15} className="shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left">{cmd.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {cmd.category}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-muted border border-border rounded px-1">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-muted border border-border rounded px-1">↵</kbd> open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-muted border border-border rounded px-1">⌘K</kbd> toggle
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
