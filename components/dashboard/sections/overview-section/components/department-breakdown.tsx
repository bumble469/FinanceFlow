import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../lib/relative-time";
import { seriesColor } from "../lib/chart-palette";
import { ChartTooltip } from "../lib/chart-tooltip";
import { EmptyState } from "../lib/empty-state";
import { PieChart as PieIcon } from "lucide-react";

interface DeptStat {
  name: string;
  budget: number;
  budgetUsedPct: number;
  completionPct: number;
  openTasks: number;
}

export function DepartmentBreakdown({ departmentStats, currency }: { departmentStats: DeptStat[]; currency: string }) {
  if (departmentStats.length === 0) {
    return (
      <EmptyState
        icon={<PieIcon className="size-5" />}
        title="No departments yet"
        description="Department budgets will be broken down here once departments are added."
      />
    );
  }

  const withBudget = departmentStats.filter((d) => d.budget > 0);
  const totalBudget = withBudget.reduce((s, d) => s + d.budget, 0);
  const donutData = withBudget.map((d, i) => ({ ...d, hex: seriesColor(i) }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 flex flex-col items-center justify-center">
        {donutData.length === 0 ? (
          <EmptyState
            icon={<PieIcon className="size-5" />}
            title="No department budgets allocated yet"
            description="Assign a budget to a department to see the allocation split."
          />
        ) : (
          <div className="relative">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="budget" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3} stroke="none">
                  {donutData.map((d, i) => <Cell key={i} fill={d.hex} />)}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip
                      currency={currency}
                      formatValue={(v) => formatCurrency(v, currency)}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold text-foreground">{formatCurrency(totalBudget, currency)}</p>
              <p className="text-[10px] text-muted-foreground">Total allocated</p>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-3 space-y-2.5">
        {donutData
          .sort((a, b) => b.budget - a.budget)
          .map((d) => {
            const share = totalBudget > 0 ? (d.budget / totalBudget) * 100 : 0;
            return (
              <div key={d.name} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.hex }} />
                    <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0">{share.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground pl-4.5">
                  <span>{formatCurrency(d.budget, currency)} · {d.completionPct.toFixed(0)}% done</span>
                  <span className={cn(d.budgetUsedPct > 100 && "text-destructive font-medium")}>
                    {d.openTasks} open{d.budgetUsedPct > 0 ? ` · ${d.budgetUsedPct.toFixed(0)}% spent` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        {departmentStats.some((d) => d.budget === 0) && (
          <p className="text-[11px] text-muted-foreground pt-1">
            {departmentStats.filter((d) => d.budget === 0).length} department(s) have no budget allocated and aren't shown in the chart.
          </p>
        )}
      </div>
    </div>
  );
}