import { FileClock, Receipt, CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "../lib/status-pill";
import { EmptyState } from "../lib/empty-state";

export function PendingApprovalsWidget({ expenseCount, extensionCount, showExpenses = true }: { expenseCount: number; extensionCount: number; showExpenses?: boolean }) {
  const total = (showExpenses ? expenseCount : 0) + extensionCount;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <FileClock className="h-4 w-4 text-muted-foreground" />
          Pending approvals
        </h3>
        {total > 0 ? (
          <StatusPill tone="warning">{total} waiting</StatusPill>
        ) : (
          <StatusPill tone="success">All clear</StatusPill>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          description="Nothing needs your approval right now."
        />
      ) : (
        <div className={cn("grid gap-3", showExpenses ? "grid-cols-2" : "grid-cols-1")}>
          {showExpenses && (
            <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", expenseCount > 0 ? "border-warning/25 bg-warning/5" : "border-border")}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", expenseCount > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                <Receipt className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{expenseCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Expense requests</p>
              </div>
            </div>
          )}
          <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", extensionCount > 0 ? "border-primary/25 bg-primary/5" : "border-border")}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", extensionCount > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              <CalendarClock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-none">{extensionCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Extension requests</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}