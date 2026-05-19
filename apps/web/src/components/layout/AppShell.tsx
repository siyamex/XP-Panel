"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { useUIStore } from "@/lib/stores/ui.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0 transition-all duration-200",
          sidebarCollapsed ? "ml-0" : "ml-0"
        )}
      >
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-2xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Global command palette */}
      <CommandPalette />
    </div>
  );
}
