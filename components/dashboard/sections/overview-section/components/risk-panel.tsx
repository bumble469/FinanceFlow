import { AlertTriangle, ShieldCheck, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskItem {
  label: string;
  sublabel: string;
  count: number;
  icon: LucideIcon;
}

export function RiskPanel({ items }: { items: RiskItem[] }) {
  const totalRisks = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Risks & flags
        </h3>
        {totalRisks > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-destructive/12 text-destructive">
            {totalRisks} issue{totalRisks !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-success/12 text-success">
            All clear
          </span>
        )}
      </div>

      {totalRisks === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/12">
            <ShieldCheck className="h-5 w-5 text-success" />
          </span>
          <p className="text-sm text-muted-foreground text-center">No budget, schedule, or task risks detected.</p>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {items.map((item) => {
            const Icon = item.icon;
            const flagged = item.count > 0;
            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-lg border px-3 py-2.5 flex items-center gap-2.5",
                  flagged ? "border-destructive/25 bg-destructive/5" : "border-border"
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", flagged ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.count} {item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}