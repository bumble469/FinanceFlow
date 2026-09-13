import { FileClock, Receipt, CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PendingApprovalsWidget({ expenseCount, extensionCount }: { expenseCount: number; extensionCount: number }) {
  const total = expenseCount + extensionCount;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <FileClock className="h-4 w-4 text-muted-foreground" />
          Pending approvals
        </h3>
        {total > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-warning/12 text-warning">
            {total} waiting
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-success/12 text-success">
            All clear
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/12">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </span>
          <p className="text-sm text-muted-foreground text-center">Nothing needs your approval right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", expenseCount > 0 ? "border-warning/25 bg-warning/5" : "border-border")}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", expenseCount > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
              <Receipt className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-none">{expenseCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Expense requests</p>
            </div>
          </div>
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