import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

interface ComingSoonPanelProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  note: string;
}

/**
 * Shared shell for cross-plan widgets whose data requires a new aggregation
 * endpoint (tasks, deadlines, notifications are all plan-scoped today).
 * Renders the same "title + add button" header as the real panels so the
 * layout doesn't shift once real data replaces this.
 */
export function ComingSoonPanel({ title, subtitle, icon: Icon, note }: ComingSoonPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Plus className="h-4 w-4" />
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="text-xs text-muted-foreground max-w-[200px]">{note}</p>
      </div>
    </div>
  );
}
