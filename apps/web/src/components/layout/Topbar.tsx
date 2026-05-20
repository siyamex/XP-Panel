"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search, Sun, Moon, Bell, ChevronRight, LogOut,
  User, Settings, ChevronsUpDown,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/ui.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { cn } from "@/lib/utils/cn";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/domains": "Domains",
  "/email": "Email",
  "/files": "File Manager",
  "/databases": "Databases",
  "/php": "PHP",
  "/webserver": "Web Server",
  "/ssl": "SSL / TLS",
  "/backups": "Backups",
  "/docker": "Docker",
  "/devops": "DevOps",
  "/security": "Security",
  "/monitoring": "Monitoring",
  "/billing": "Billing",
  "/marketplace": "Marketplace",
  "/reseller": "Reseller",
  "/ai": "AI Assistant",
  "/settings": "Settings",
  "/admin/servers": "Servers",
};

export function Topbar() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const { toggleCommandPalette, locale, setLocale } = useUIStore();
  const { user, logout } = useAuthStore();

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    return { label: breadcrumbMap[path] ?? seg, path };
  });

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
      {/* Left: Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <span className="text-foreground font-medium">XP-Panel</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-muted-foreground/50" />
            <span
              className={cn(
                i === breadcrumbs.length - 1
                  ? "text-foreground font-medium"
                  : "hover:text-foreground cursor-pointer"
              )}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          title={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-bold"
        >
          {locale === 'en' ? 'ع' : 'EN'}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={16} />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* User menu */}
        <UserMenu user={user} onLogout={logout} />
      </div>
    </header>
  );
}

function UserMenu({
  user,
  onLogout,
}: {
  user: { email?: string; username?: string } | null;
  onLogout: () => void;
}) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
          {user?.username?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="hidden md:block text-sm font-medium max-w-24 truncate">
          {user?.username ?? "User"}
        </span>
        <ChevronsUpDown size={14} className="text-muted-foreground" />
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg py-1 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-medium truncate">{user?.username}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <a
          href="/settings/profile"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <User size={14} /> Profile
        </a>
        <a
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <Settings size={14} /> Settings
        </a>
        <div className="border-t border-border mt-1" />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
