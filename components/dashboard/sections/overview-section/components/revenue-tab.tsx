"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "../lib/relative-time";
import { CardPrimitive } from "../lib/card-primitive";
import { IncomeExpenseTrend } from "./income-expense-trend";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import { EmptyState } from "../lib/empty-state";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { CustomPieTooltip } from "./custom-pie-tooltip";
import { ChartPieTooltip } from "../lib/chart-tooltip";
import { Receipt, Store, TrendingUp, Wallet, PiggyBank, PieChart as PieIcon } from "lucide-react";
import type { FinanceTotals } from "@/lib/analytics/finance";
import type { Income, Expense } from "@/lib/types";
import { seriesColor } from "../lib/chart-palette";
import { cn } from "@/lib/utils";

interface RevenueSource {
  key: string;
  label: string;
  value: number;
}

interface StallPerformanceRow {
  id: string;
  name: string;
  income: number;
  expense: number;
  net: number;
}

interface RevenueData {
  totals?: FinanceTotals;
  expensesByCategory?: Record<string, { total: number; paid: number }>;
  incomeByType?: Record<string, { total: number; received: number }>;
  revenueSources?: RevenueSource[];
  stallPerformance?: StallPerformanceRow[];
  expenses?: (Expense & { departmentName?: string })[];
  income?: (Income & { departmentName?: string })[];
  currency?: string;
}

export function RevenueTab({ data }: { data: Record<string, unknown> }) {
  const d = data as RevenueData;
  const currency = d.currency || "USD";
  const totals = d.totals;
  const expenses = d.expenses ?? [];
  const income = d.income ?? [];
  const revenueSources = d.revenueSources ?? [];
  const stallPerformance = d.stallPerformance ?? [];
  const expensesByCategory = d.expensesByCategory ?? {};

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    return Object.keys(expensesByCategory);
  }, [expensesByCategory]);

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    return expenses.filter((e) => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const revenueSourceDonutData = useMemo(() => {
    return revenueSources.map((s, idx) => ({
      name: s.label,
      value: s.value,
      hex: seriesColor(idx),
    }));
  }, [revenueSources]);

  const totalExpenseAmount = useMemo(() => {
    return Object.values(expensesByCategory).reduce((s, c) => s + c.total, 0);
  }, [expensesByCategory]);

  const incomeTypeRows = useMemo(() => {
    return Object.entries(d.incomeByType ?? {})
      .map(([type, item]) => ({
        type,
        total: item.total,
        received: item.received,
        outstanding: Math.max(0, item.total - item.received),
      }))
      .sort((a, b) => b.total - a.total);
  }, [d.incomeByType]);

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Income"
          value={formatCurrency(totals?.totalIncomeReceived ?? 0, currency)}
          subtitle={
            (totals?.totalIncomeExpected ?? 0) > (totals?.totalIncomeReceived ?? 0)
              ? `expected ${formatCurrency(totals?.totalIncomeExpected ?? 0, currency)}`
              : "fully received"
          }
          status="healthy"
          trend="up"
          icon={<TrendingUp className="h-4 w-4" />}
          variant="emerald"
        />
        <MetricCard
          title="Expenses Paid"
          value={formatCurrency(totals?.totalExpensesPaid ?? 0, currency)}
          subtitle={`${formatCurrency(totals?.totalExpensesCommitted ?? 0, currency)} committed`}
          status="healthy"
          icon={<Receipt className="h-4 w-4" />}
          variant="amber"
        />
        <MetricCard
          title="Est. Profit / Loss"
          value={formatCurrency(totals?.estimatedProfitLoss ?? 0, currency)}
          subtitle={totals && totals.estimatedProfitLoss >= 0 ? "in the black" : "running a deficit"}
          status={totals && totals.estimatedProfitLoss >= 0 ? "healthy" : "warning"}
          trend={totals && totals.estimatedProfitLoss >= 0 ? "up" : "down"}
          icon={<Wallet className="h-4 w-4" />}
          variant="cyan"
        />
        <MetricCard
          title="Total Budget"
          value={formatCurrency(totals?.totalBudget ?? 0, currency)}
          subtitle={
            totals?.hasBudget
              ? `${Math.round(totals?.budgetUsedPct ?? 0)}% consumed`
              : "no budget set"
          }
          status="healthy"
          progressPercent={totals?.budgetUsedPct ?? 0}
          progressLabel="consumed"
          icon={<PiggyBank className="h-4 w-4" />}
          variant="violet"
        />
      </div>

      {/* Income vs Expense Trend Area Chart */}
      <CardPrimitive
        title="Income vs. Expense Trend"
        subtitle="Monthly cash flow and balance trajectory"
      >
        <IncomeExpenseTrend income={income as Income[]} expenses={expenses as Expense[]} currency={currency} />
      </CardPrimitive>

      {/* Revenue Sources and Expense Categories Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue Sources Donut */}
        <CardPrimitive
          title="Revenue by Source"
          subtitle={
            revenueSources.length > 0
              ? `Total revenue: ${formatCurrency(totals?.totalIncomeReceived ?? 0, currency)}`
              : "No income sources recorded yet"
          }
        >
          {revenueSourceDonutData.length === 0 ? (
            <EmptyState
              icon={<PieIcon className="size-5" />}
              title="No revenue streams yet"
              description="Income sources recorded on this plan will be broken down here."
            />
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 pt-2">
              <div className="relative">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={revenueSourceDonutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {revenueSourceDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.hex} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 flex-1 max-w-xs">
                {revenueSourceDonutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                      <span className="text-foreground truncate">{item.name}</span>
                    </span>
                    <span className="font-semibold text-foreground ml-2">
                      {formatCurrency(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardPrimitive>

        {/* Expenses by Category Breakdown */}
        <CardPrimitive
          title="Expense Categories"
          subtitle={`Total expenses: ${formatCurrency(totalExpenseAmount, currency)}`}
        >
          {categories.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="No expense entries yet"
              description="Expenses logged against this plan will be totalled by category here."
            />
          ) : (
            <div className="space-y-3 pt-1">
              {Object.entries(expensesByCategory).map(([cat, item], idx) => {
                const pct = totalExpenseAmount > 0 ? (item.total / totalExpenseAmount) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{cat.replace("_", " ")}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.total, currency)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, pct))}%`,
                          backgroundColor: seriesColor(idx),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardPrimitive>
      </div>

      {/* Income by Type — expected vs received per income stream */}
      {incomeTypeRows.length > 0 && (
        <CardPrimitive
          title="Income by Type"
          subtitle="Expected vs received for each income stream"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium text-right">Expected</th>
                  <th className="py-2.5 px-3 font-medium text-right">Received</th>
                  <th className="py-2.5 px-3 font-medium text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {incomeTypeRows.map((row) => (
                  <tr key={row.type} className="border-b border-border/50">
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {row.type.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCurrency(row.total, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-foreground">
                      {formatCurrency(row.received, currency)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-semibold",
                        row.outstanding > 0 ? "text-warning" : "text-success"
                      )}
                    >
                      {formatCurrency(row.outstanding, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardPrimitive>
      )}

      {/* Stall Performance Table if Stalls exist */}
      {stallPerformance.length > 0 && (
        <CardPrimitive
          title="Stall Financial Performance"
          subtitle={`${stallPerformance.length} commercial stalls participating`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2.5 px-3 font-medium">Stall Name</th>
                  <th className="py-2.5 px-3 font-medium text-right">Income</th>
                  <th className="py-2.5 px-3 font-medium text-right">Expenses</th>
                  <th className="py-2.5 px-3 font-medium text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {stallPerformance.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-primary" />
                      {s.name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-success font-medium">
                      {formatCurrency(s.income, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-destructive font-medium">
                      {formatCurrency(s.expense, currency)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${s.net >= 0 ? "text-success" : "text-destructive"}`}>
                      {s.net >= 0 ? "+" : ""}{formatCurrency(s.net, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardPrimitive>
      )}

      {/* Filtered Expenses Quick View */}
      {expenses.length > 0 && (
        <CardPrimitive
          title="Recent Expenses"
          subtitle={`${filteredExpenses.length} entries shown`}
          filters={
            categories.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Category:</span>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger size="sm" className="w-[180px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : undefined
          }
        >
          <div className="space-y-2">
            {filteredExpenses.slice(0, 8).map((exp) => (
              <div key={exp.id} className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{exp.category.replace("_", " ")}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{exp.departmentName || "General"}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-foreground">{formatCurrency(exp.amount, currency)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{exp.status.replace("_", " ")}</p>
                </div>
              </div>
            ))}
          </div>
        </CardPrimitive>
      )}
    </div>
  );
}
