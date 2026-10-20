"use client";

import { useMemo } from "react";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import { DepartmentBreakdown } from "./department-breakdown";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeptStat {
  id: string;
  name: string;
  budget: number;
  actualExpenses: number;
  actualPaid: number;
  budgetUsedPct: number;
  completionPct: number;
  openTasks: number;
  totalTasks: number;
  memberCount: number;
}

interface WorkspaceData {
  departmentStats?: DeptStat[];
  currency?: string;
  financeEnabled?: boolean;
}

export function WorkspaceTab({ data }: { data: Record<string, unknown> }) {
  const d = data as WorkspaceData;
  const currency = d.currency || "USD";
  const departmentStats = d.departmentStats ?? [];
  const financeEnabled = d.financeEnabled !== false;

  const barData = useMemo(() => {
    return departmentStats.map((dept) => ({
      name: dept.name,
      budget: dept.budget,
      actual: dept.actualExpenses,
      over: dept.budget > 0 && dept.actualExpenses > dept.budget,
    }));
  }, [departmentStats]);

  const totalAllocated = useMemo(() => {
    return departmentStats.reduce((s, dept) => s + dept.budget, 0);
  }, [departmentStats]);

  const totalSpent = useMemo(() => {
    return departmentStats.reduce((s, dept) => s + dept.actualExpenses, 0);
  }, [departmentStats]);

  if (departmentStats.length === 0) {
    return (
      <CardPrimitive title="Department Overview">
        <p className="text-sm text-muted-foreground text-center py-12">
          No departments configured in this workspace yet.
        </p>
      </CardPrimitive>
    );
  }

  return (
    <div className="space-y-4">
      {/* Department Breakdown Pie + Summary */}
      {financeEnabled && (
        <CardPrimitive
          title="Department Budget Allocation"
          subtitle={`Total allocated: ${formatCurrency(totalAllocated, currency)} · Spent: ${formatCurrency(totalSpent, currency)}`}
        >
          <DepartmentBreakdown departmentStats={departmentStats} currency={currency} />
        </CardPrimitive>
      )}

      {/* Budget vs Actual Horizontal Bar Chart */}
      {financeEnabled && barData.length > 0 && (
        <CardPrimitive
          title="Budget vs. Actual Spend"
          subtitle="Comparison of department budget allocation against incurred expenses"
        >
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 48)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCurrency(v, currency)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="budget" fill="var(--muted-foreground)" radius={[0, 4, 4, 0]} name="Budget" />
                <Bar dataKey="actual" radius={[0, 4, 4, 0]} name="Actual Spend">
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.over ? "var(--destructive)" : "var(--success)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardPrimitive>
      )}

      {/* Department Table / Cards Grid */}
      <CardPrimitive
        title="Department Performance & Metrics"
        subtitle={`${departmentStats.length} active departments`}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {departmentStats.map((dept) => {
            const isOverBudget = financeEnabled && dept.budget > 0 && dept.actualExpenses > dept.budget;
            return (
              <div
                key={dept.id}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  isOverBudget ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-semibold text-foreground text-sm truncate">{dept.name}</h4>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {dept.memberCount}
                  </span>
                </div>

                {financeEnabled && (
                  <div className="mb-3 space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Budget:</span>
                      <span className="font-medium text-foreground">{formatCurrency(dept.budget, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Spent:</span>
                      <span className={cn("font-medium", isOverBudget ? "text-destructive" : "text-foreground")}>
                        {formatCurrency(dept.actualExpenses, currency)}
                        {dept.budget > 0 && ` (${dept.budgetUsedPct.toFixed(0)}%)`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-border pt-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Task Completion</span>
                    <span className="font-semibold text-foreground">{dept.completionPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, dept.completionPct))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>{dept.openTasks} open</span>
                    <span>{dept.totalTasks} total</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardPrimitive>
    </div>
  );
}
