import Link from "next/link";
import { Briefcase, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/lib/types";

export function MiniPlanCard({ plan }: { plan: Plan }) {
  const spent = plan.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const pct = plan.budget > 0 ? (spent / plan.budget) * 100 : 0;
  const isRisk = pct > 90;
  const isWarning = pct > 75;

  const statusColor = plan.status === "completed"
    ? "bg-muted text-muted-foreground"
    : isRisk ? "bg-danger/10 text-danger"
    : isWarning ? "bg-warning/10 text-warning"
    : "bg-success/10 text-success";

  const statusLabel = plan.status === "completed" ? "Done" : isRisk ? "At Risk" : isWarning ? "Warning" : "On Track";
  const TypeIcon = plan.type === "project" ? Briefcase : CalendarDays;

  return (
    <Link href={`/plans/${plan.id}`}>
      <div className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:-translate-y-0.5">
        {/* Compact banner placeholder */}
        <div
          className="relative h-16 w-full"
          style={{ background: "linear-gradient(135deg, var(--secondary) 0%, var(--muted) 45%, var(--secondary) 100%)" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <TypeIcon className="h-5 w-5 text-muted-foreground/30" />
          </div>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
            <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${statusColor}`}>{statusLabel}</Badge>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${isRisk ? "bg-danger" : isWarning ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}