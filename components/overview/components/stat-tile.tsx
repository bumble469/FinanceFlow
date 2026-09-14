import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "primary" | "warning" | "danger" | "muted";
}

const ACCENT_CONFIG: Record<NonNullable<StatTileProps["accent"]>, { icon: string; wash: string }> = {
  primary: { icon: "bg-primary text-primary-foreground", wash: "rgba(52,211,153,0.05)" },
  warning: { icon: "bg-warning text-warning-foreground", wash: "rgba(251,191,36,0.05)" },
  danger: { icon: "bg-destructive text-destructive-foreground", wash: "rgba(248,113,113,0.05)" },
  muted: { icon: "bg-muted-foreground/20 text-muted-foreground", wash: "rgba(148,163,184,0.03)" },
};

export function StatTile({ label, value, icon: Icon, accent = "muted" }: StatTileProps) {
  const cfg = ACCENT_CONFIG[accent];
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-5 flex items-start justify-between"
      style={{ background: `linear-gradient(135deg, ${cfg.wash} 0%, transparent 60%)` }}
    >
      <div>
        <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm", cfg.icon)}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}