import type { Metadata } from "next";

export const metadata: Metadata = { title: "Databases" };

export default function DatabasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Databases</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage MySQL, PostgreSQL, and MongoDB databases</p>
      </div>
      <div className="flex items-center justify-center h-64 bg-card border border-dashed border-border rounded-xl">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium">Coming in Phase 2</p>
          <p className="text-xs text-muted-foreground/60">Databases management will be available soon</p>
        </div>
      </div>
    </div>
  );
}
