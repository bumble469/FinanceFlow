"use client";

import { useState, useEffect } from "react";
import { useFinancialStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Wrench,
  Megaphone,
  Building2,
  PartyPopper,
  RefreshCw,
  Ticket,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";
import type { Expense, Income, ExpenseCategory, FinancialStatus, IncomeType, IncomeStatus } from "@/lib/types";
import { AddIncomeDialog } from "./components/add-income-dialog";
import { AddExpenseDialog } from "./components/add-expense-dialog";
import { TicketingSection } from "./components/ticketing-section/ticketing-section";
import type { PlanPermissions } from "@/lib/permissions";
import { useSnackbar } from '@/lib/useSnackbar';

// ─── config ────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  {
    label: string;
    icon: typeof Users;
    colorClass: string;
    badgeClass: string;
    hex: string;
  }
> = {
  SALARY: {
    label: "Salary",
    icon: Users,
    colorClass: "bg-chart-1/15 text-chart-1",
    badgeClass: "bg-chart-1/10 text-chart-1",
    hex: "#6366f1",
  },
  MARKETING: {
    label: "Marketing",
    icon: Megaphone,
    colorClass: "bg-chart-2/15 text-chart-2",
    badgeClass: "bg-chart-2/10 text-chart-2",
    hex: "#ec4899",
  },
  TOOLS: {
    label: "Tools",
    icon: Wrench,
    colorClass: "bg-chart-3/15 text-chart-3",
    badgeClass: "bg-chart-3/10 text-chart-3",
    hex: "#0ea5e9",
  },
  OPERATIONS: {
    label: "Operations",
    icon: Building2,
    colorClass: "bg-chart-4/15 text-chart-4",
    badgeClass: "bg-chart-4/10 text-chart-4",
    hex: "#f59e0b",
  },
  EVENT: {
    label: "Event",
    icon: PartyPopper,
    colorClass: "bg-chart-5/15 text-chart-5",
    badgeClass: "bg-chart-5/10 text-chart-5",
    hex: "#8b5cf6",
  },
  EQUIPMENT: {
    label: "Equipment",
    icon: PartyPopper,
    colorClass: "bg-chart-5/15 text-chart-5",
    badgeClass: "bg-chart-5/10 text-chart-5",
    hex: "#8b5cf6",
  },
  OTHER: {
    label: "Other",
    icon: Wallet,
    colorClass: "bg-muted text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
    hex: "#9ca3af",
  },
};

const EXPENSE_CATEGORIES = Object.keys(CATEGORY_CONFIG) as ExpenseCategory[];

const INCOME_TYPES = [
  "REVENUE",
  "INVESTMENT",
  "SPONSORSHIP",
  "DONATION",
  "GRANT",
  "CLIENT_PAYMENT",
  "MERCHANDISE",
  "REFUND",
  "OTHER",
] as const;

const INCOME_TYPE_BADGE_CLASS: Record<string, string> = {
  INVESTMENT: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  REVENUE: "bg-green-500/10 text-green-600 dark:text-green-400",
  SPONSORSHIP: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  DONATION: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  GRANT: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  CLIENT_PAYMENT: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  MERCHANDISE: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  REFUND: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  OTHER: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const INCOME_STATUS_BADGE_CLASS: Record<string, string> = {
  EXPECTED: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PARTIAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  RECEIVED: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const PAYMENT_STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  PARTIAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
  OVERDUE: "bg-red-500/10 text-red-600 dark:text-red-400",
};

type IncomeFilter = "ALL" | typeof INCOME_TYPES[number];

type Tab = "income" | "expenses" | "breakdown" | "phases" | "resources" | "variance" | "analytics" | "transactions";

// ─── helpers ───────────────────────────────────────────────────────────────

function fmt(value: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${value.toLocaleString("en-IN")}`;
}

function getStatus(spent: number, budget: number): FinancialStatus {
  const r = spent / budget;
  if (r <= 0.7) return "healthy";
  if (r <= 1) return "warning";
  return "risk";
}

function formatLabel(v: string) {
  return v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
}

// ─── sub-components ────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", valueClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionHeader({
  title,
  onAdd,
  addLabel,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <Button size="sm" variant="outline" className="gap-1.5 h-8 hover:text-gray-600 cursor-pointer" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

// ─── Income Tab ────────────────────────────────────────────────────────────

function IncomeTab({
  income,
  currency,
  onAdd,
  onEdit,
  onDelete,
  canAdd,
  canEdit,
  canDelete,
}: {
  income: Income[];
  currency: string;
  onAdd: () => void;
  onEdit: (i: Income) => void;
  onDelete: (id: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [filter, setFilter] = useState<IncomeFilter>("ALL");
  const filtered = income.filter((i) => filter === "ALL" || i.type === filter);

  return (
    <div className="space-y-4">
      {canAdd ? (
        <SectionHeader title="Income entries" onAdd={onAdd} addLabel="Add income" />
      ) : (
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Income entries</h3>
      )}

      {/* filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide custom-scrollbar">
        {(["ALL", ...INCOME_TYPES] as IncomeFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs border transition-colors whitespace-nowrap",
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {f === "ALL" ? "All" : formatLabel(f)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No income entries yet. Add one to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Phase</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Expected Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Received Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{entry.source || "—"}</p>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      INCOME_TYPE_BADGE_CLASS[entry.type] ?? INCOME_TYPE_BADGE_CLASS.OTHER
                    )}>
                      {entry.type ? formatLabel(entry.type) : "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {entry.phaseName ?? "Overall"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {entry.receivedAt
                      ? new Date(entry.receivedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    +{fmt(entry.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-green-600 dark:text-green-400">
                    +{fmt(entry.receivedAmount, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      INCOME_STATUS_BADGE_CLASS[entry.status] ?? INCOME_STATUS_BADGE_CLASS.EXPECTED
                    )}>
                      {entry.status ? formatLabel(entry.status) : "Expected"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => onEdit(entry)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer" onClick={() => onDelete(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Expenses Tab ──────────────────────────────────────────────────────────

function ExpensesTab({
  expenses,
  currency,
  onAdd,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  canAdd,
  canEdit,
  canDelete,
  canApprove,
}: {
  expenses: Expense[];
  currency: string;
  onAdd: () => void;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
}) {
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "ALL">("ALL");

  const filtered = expenses.filter(
    (e) => categoryFilter === "ALL" || e.category === categoryFilter
  );

  return (
    <div className="space-y-4">
      {canAdd ? (
        <SectionHeader title="Expense entries" onAdd={onAdd} addLabel="Add expense" />
      ) : (
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Expense entries</h3>
      )}

      {/* category filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={cn(
            "rounded-full px-3 py-1 text-xs border transition-colors",
            categoryFilter === "ALL"
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40"
          )}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs border transition-colors",
              categoryFilter === cat
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            )}
          >
            {CATEGORY_CONFIG[cat].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No expenses found.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Requested by</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Approved by</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Paid</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Request Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Payment Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense) => {
                const cfg = CATEGORY_CONFIG[expense.category];
                const Icon = cfg.icon;
                return (
                  <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{expense.description || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {expense.departmentName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {expense.requestedByName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {expense.status === "REJECTED"
                        ? (expense.rejectedByName ?? "—")
                        : (expense.approvedByName ?? "—")}
                      {(expense.approvedAt && expense.status !== "REJECTED") && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {new Date(expense.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {expense.occurredAt
                        ? new Date(expense.occurredAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-destructive">
                      -{fmt(expense.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-destructive">
                      -{fmt(expense.paidAmount, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        expense.status === "APPROVED" || expense.status === "PAID" ? "bg-green-500/10 text-green-600" :
                          expense.status === "REJECTED" || expense.status === "CANCELLED" ? "bg-red-500/10 text-red-600" :
                            "bg-yellow-500/10 text-yellow-600"
                      )}>
                        {expense.status ? formatLabel(expense.status) : "Pending approval"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        PAYMENT_STATUS_BADGE_CLASS[expense.paymentStatus] ?? PAYMENT_STATUS_BADGE_CLASS.PENDING
                      )}>
                        {expense.paymentStatus ? formatLabel(expense.paymentStatus) : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canApprove && expense.status === "PENDING_APPROVAL" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => onApprove?.(expense.id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onReject?.(expense.id)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {canEdit && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => onEdit(expense)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive cursor-pointer hover:text-destructive" onClick={() => onDelete(expense.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Breakdown Tab ─────────────────────────────────────────────────────────

function BreakdownTab({
  expenses,
  currency,
}: {
  expenses: Expense[];
  currency: string;
}) {
  const byCategory = EXPENSE_CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0);
    return { cat, total };
  }).filter((x) => x.total > 0);

  const grandTotal = byCategory.reduce((s, x) => s + x.total, 0);

  const deptMap = new Map<string, number>();
  expenses.forEach((e) => {
    if (e.departmentName) {
      deptMap.set(e.departmentName, (deptMap.get(e.departmentName) ?? 0) + e.amount);
    }
  });
  const byDept = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">By category</h3>
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
          ) : (
            byCategory.map(({ cat, total }) => {
              const cfg = CATEGORY_CONFIG[cat];
              const Icon = cfg.icon;
              const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", cfg.colorClass)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium">{cfg.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-medium">{fmt(total, currency)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">By department</h3>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {byDept.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No department data yet</p>
          ) : (
            byDept.map(([dept, total]) => {
              const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
              return (
                <div key={dept} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dept}</span>
                    <div className="text-right">
                      <span className="font-mono font-medium">{fmt(total, currency)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Phase P&L Tab ─────────────────────────────────────────────────────────

function PhasePLTab({
  income,
  expenses,
  currency,
}: {
  income: Income[];
  expenses: Expense[];
  currency: string;
}) {
  const phaseNames = Array.from(
    new Set([
      ...income.filter((i) => i.phaseName).map((i) => i.phaseName!),
      ...expenses.filter((e) => e.phaseName).map((e) => e.phaseName!),
    ])
  );

  const overallIncome = income.filter((i) => !i.phaseName).reduce((s, i) => s + i.amount, 0);
  const overallExpenses = expenses.filter((e) => !e.phaseName).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Phase-wise P&L</h3>

      <PLRow
        label="Overall (no phase)"
        incomeTotal={overallIncome}
        expenseTotal={overallExpenses}
        currency={currency}
        highlight
      />

      {phaseNames.length === 0 && overallIncome === 0 && overallExpenses === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No phase data yet.
        </div>
      )}

      {phaseNames.map((phase) => {
        const phaseIncome = income
          .filter((i) => i.phaseName === phase)
          .reduce((s, i) => s + i.amount, 0);
        const phaseExpenses = expenses
          .filter((e) => e.phaseName === phase)
          .reduce((s, e) => s + e.amount, 0);
        return (
          <PLRow
            key={phase}
            label={phase}
            incomeTotal={phaseIncome}
            expenseTotal={phaseExpenses}
            currency={currency}
          />
        );
      })}
    </div>
  );
}

// ─── Resource Cost Tab ─────────────────────────────────────────────────────

function ResourceCostTab({
  data,
  currency,
}: {
  data: { departments: any[]; phases: any[] };
  currency: string;
}) {
  const [scope, setScope] = useState<"department" | "phase">("department");
  const rows = scope === "department" ? data.departments : data.phases;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Resource cost by {scope === "department" ? "department" : "phase"}
        </h3>
        <div className="flex gap-1 rounded-full border border-border p-0.5">
          {(["department", "phase"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                scope === s ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {s === "department" ? "Department" : "Phase"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No {scope === "department" ? "departments" : "phases"} to show yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.memberCount} member{r.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total monthly cost</p>
                  <p className="font-mono font-semibold text-foreground">{fmt(r.totalMonthlyCost, currency)}</p>
                </div>
              </div>

              {r.memberCosts.length > 0 && (
                <div className="space-y-1 border-t border-border pt-2">
                  {r.memberCosts.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {m.name}
                        {m.isOverridden && (
                          <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                            custom split
                          </span>
                        )}
                      </span>
                      <span className="font-mono">{fmt(m.monthlyCost, currency)}/mo</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">Actual expenses recorded here</span>
                <span className="font-mono font-medium text-destructive">{fmt(r.actualExpenses, currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Budget Variance Tab ────────────────────────────────────────────────────

function BudgetVarianceTab({
  departments,
  currency,
}: {
  departments: any[];
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Budget vs. actual, by department</h3>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Phase-level budgets aren't tracked yet — only departments have a budget field today.
        </p>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No departments to show yet.
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((d) => {
            const variance = d.budget - d.actualExpenses;
            const pctUsed = d.budget > 0 ? (d.actualExpenses / d.budget) * 100 : 0;
            const isOver = d.budget > 0 && d.actualExpenses > d.budget;
            const noBudgetSet = d.budget === 0;

            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{d.name}</p>
                  {noBudgetSet ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      No budget set
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        isOver
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : pctUsed > 85
                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            : "bg-green-500/10 text-green-600 dark:text-green-400"
                      )}
                    >
                      {isOver ? "Over budget" : pctUsed > 85 ? "Nearing limit" : "On track"}
                    </span>
                  )}
                </div>

                {!noBudgetSet && (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Planned budget</p>
                        <p className="font-mono font-medium text-foreground">{fmt(d.budget, currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Actual spent</p>
                        <p className="font-mono font-medium text-destructive">{fmt(d.actualExpenses, currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Variance</p>
                        <p className={cn(
                          "font-mono font-medium",
                          variance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                        )}>
                          {variance >= 0 ? "+" : ""}{fmt(variance, currency)}
                        </p>
                      </div>
                    </div>
                    <Progress value={Math.min(pctUsed, 100)} className={cn("h-1.5", isOver && "bg-red-500/20")} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PLRow({
  label,
  incomeTotal,
  expenseTotal,
  currency,
  highlight,
}: {
  label: string;
  incomeTotal: number;
  expenseTotal: number;
  currency: string;
  highlight?: boolean;
}) {
  const net = incomeTotal - expenseTotal;
  return (
    <div className={cn(
      "rounded-xl border border-border p-4",
      highlight ? "bg-muted/30" : "bg-card"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              net > 0
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : net === 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {net > 0 ? "Profitable" : net === 0 ? "Break-even" : "Over budget"}
            {incomeTotal > 0 && ` · ${((net / incomeTotal) * 100).toFixed(0)}% margin`}
          </span>
        </div>
        <span className={cn(
          "text-sm font-mono font-semibold",
          net >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
        )}>
          {net >= 0 ? "+" : ""}{fmt(net, currency)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="text-muted-foreground text-xs">Income</span>
          <span className="ml-auto font-mono text-xs font-medium">{fmt(incomeTotal, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          <span className="text-muted-foreground text-xs">Expenses</span>
          <span className="ml-auto font-mono text-xs font-medium">{fmt(expenseTotal, currency)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.payload.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-medium text-foreground">{fmt(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsTab({
  income,
  expenses,
  currency,
}: {
  income: Income[];
  expenses: Expense[];
  currency: string;
}) {
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const incomeVsExpenseData = [
    { name: "Income", value: totalIncome, key: "income" },
    { name: "Expenses", value: totalExpenses, key: "expense" },
  ];

  const byCategory = EXPENSE_CATEGORIES.map((cat, idx) => ({
    name: CATEGORY_CONFIG[cat].label,
    value: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
    hex: CATEGORY_CONFIG[cat].hex,
    idx,
  })).filter((x) => x.value > 0);

  const categoryTotal = byCategory.reduce((s, x) => s + x.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">Income vs Expenses</h3>
        <p className="text-xs text-muted-foreground/70 mb-4">Total inflow compared to total outflow</p>
        {totalIncome === 0 && totalExpenses === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incomeVsExpenseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v, currency)} width={80} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={90} animationDuration={600}>
                {incomeVsExpenseData.map((entry) => (
                  <Cell key={entry.key} fill={entry.key === "income" ? "url(#incomeGradient)" : "url(#expenseGradient)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">Expenses by category</h3>
        <p className="text-xs text-muted-foreground/70 mb-4">Where your spending is concentrated</p>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <defs>
                  {byCategory.map((entry) => (
                    <radialGradient key={entry.idx} id={`sliceGradient-${entry.idx}`} cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor={entry.hex} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.hex} stopOpacity={0.65} />
                    </radialGradient>
                  ))}
                </defs>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                  animationDuration={600}
                >
                  {byCategory.map((entry) => (
                    <Cell key={entry.idx} fill={`url(#sliceGradient-${entry.idx})`} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string, entry: any) => (
                    <span className="text-foreground">
                      {value} <span className="text-muted-foreground">({((entry.payload.value / categoryTotal) * 100).toFixed(0)}%)</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* center label */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ marginRight: "17%" }}>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{fmt(categoryTotal, currency)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transactions Tab ───────────────────────────────────────────────────────

type CombinedTransaction = {
  id: string;
  date: string | undefined;
  kind: "Income" | "Expense";
  category: string;
  amount: number;
  status: string;
};

function TransactionsTab({
  income,
  expenses,
  currency,
}: {
  income: Income[];
  expenses: Expense[];
  currency: string;
}) {
  const combined: CombinedTransaction[] = [
    ...income.map((i) => ({
      id: `income-${i.id}`,
      date: i.receivedAt ?? i.createdAt,
      kind: "Income" as const,
      category: formatLabel(i.type),
      amount: i.amount,
      status: formatLabel(i.status),
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      date: e.occurredAt ?? e.createdAt,
      kind: "Expense" as const,
      category: CATEGORY_CONFIG[e.category]?.label ?? e.category,
      amount: e.amount,
      status: formatLabel(e.status),
    })),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Recent transactions</h3>

      {combined.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No transactions yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {tx.date
                      ? new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      tx.kind === "Income" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}>
                      {tx.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">{tx.category}</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-mono font-medium",
                    tx.kind === "Income" ? "text-green-600 dark:text-green-400" : "text-destructive"
                  )}>
                    {tx.kind === "Income" ? "+" : "-"}{fmt(tx.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RevenueExpenseSection({ planId, permissions }: { planId: string; permissions: PlanPermissions }) {
  const {
    income,
    expenses,
    currency,
    budget,
    removeIncome,
    removeExpense,
    setIncome,
    setExpenses,
    updateExpense,
    currentPlanMeta,
  } = useFinancialStore();

  const { show } = useSnackbar();

  const [fullViewBlock, setFullViewBlock] = useState<"revexp" | "ticketing" | null>(null);
  const toggleFull = (key: "revexp" | "ticketing") =>
    setFullViewBlock((cur) => (cur === key ? null : key));

  async function fetchIncome() {
    try {
      const res = await authClient.request(`/api/plan/${planId}/income`);
      setIncome(res.data.data);
    } catch (err) {
      console.error("Failed to fetch income:", err);
    }
  }

  async function fetchExpense() {
    try {
      const res = await authClient.request(`/api/plan/${planId}/expenses`);
      setExpenses(res.data.data);
    } catch (err) {
      console.error("Failed to fetch expense:", err);
    }
  }

  const [resourceCosts, setResourceCosts] = useState<{
    departments: any[];
    phases: any[];
  }>({ departments: [], phases: [] });

  async function fetchResourceCosts() {
    try {
      const res = await authClient.request(`/api/plan/${planId}/resource-costs`);
      setResourceCosts(res.data.data);
    } catch (err) {
      console.error("Failed to fetch resource costs:", err);
    }
  }

  useEffect(() => {
    fetchExpense();
    fetchIncome();
    fetchResourceCosts();
  }, [planId]);

  const [activeTab, setActiveTab] = useState<Tab>("income");
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // summary metrics
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalReceived = income.reduce((s, i) => s + i.receivedAmount, 0);
  const totalPaid = expenses.reduce((s, e) => s + e.paidAmount, 0);
  const currentBalance = totalReceived - totalPaid; // cash-basis balance
  const budgetUsedPct = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;

  const pendingReceivables = income
    .filter((i) => i.status === "EXPECTED" || i.status === "PARTIAL")
    .reduce((s, i) => s + (i.amount - i.receivedAmount), 0);

  const pendingPayables = expenses
    .filter((e) => e.status === "APPROVED" || e.status === "PARTIALLY_PAID")
    .reduce((s, e) => s + (e.amount - e.paidAmount), 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "income", label: "Income" },
    { key: "expenses", label: "Expenses" },
    { key: "breakdown", label: "Breakdown" },
    { key: "phases", label: "Phase P&L" },
    { key: "resources", label: "Resource Costs" },
    { key: "variance", label: "Budget Variance" },
    { key: "analytics", label: "Analytics" },
    { key: "transactions", label: "Transactions" },
  ];

  const handleEditIncome = (i: Income) => {
    setEditingIncome(i);
    setIncomeDialogOpen(true);
  };

  const handleEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setExpenseDialogOpen(true);
  };

  const handleDeleteIncome = async (id: string) => {
    try {
      await authClient.request(`/api/plan/${planId}/income/${id}`, { method: "DELETE" })
      removeIncome(id);
    } catch (err) {
      console.error("Failed to delete income:", err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await authClient.request(`/api/plan/${planId}/expenses/${id}`, { method: "DELETE" })
      removeExpense(id);
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
  };

  const handleApproveExpense = async (id: string) => {
    try {
      const res = await authClient.request(`/api/plan/${planId}/expenses/${id}/action`, {
        method: "PATCH",
        data: { action: "approve" },
      });
      updateExpense(id, res.data.data);
      show("Expense approved", "success");
    } catch (err) {
      console.error("Failed to approve expense:", err);
      show("Failed to approve expense", "error");
    }
  };

  const handleRejectExpense = (id: string) => {
    setRejectingExpenseId(id);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectingExpenseId) return;
    if (!rejectionReason.trim()) {
      show("A rejection reason is required", "error");
      return;
    }

    setRejectSubmitting(true);
    try {
      const res = await authClient.request(`/api/plan/${planId}/expenses/${rejectingExpenseId}/action`, {
        method: "PATCH",
        data: { action: "reject", rejectionReason: rejectionReason.trim() },
      });
      updateExpense(rejectingExpenseId, res.data.data);
      show("Expense rejected", "success");
      setRejectingExpenseId(null);
      setRejectionReason("");
    } catch (err: any) {
      console.error("Failed to reject expense:", err);
      show(err?.response?.data?.error || "Failed to reject expense", "error");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const showRevExp = !fullViewBlock || fullViewBlock === "revexp";
  const showTicketing = (!fullViewBlock || fullViewBlock === "ticketing") &&
    currentPlanMeta?.type === "event" && currentPlanMeta?.hasTicketing;

  return (
    <div className="space-y-6">
      {/* ── Revenue & Expenses block ── */}
      {showRevExp && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Revenue & Expenses</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Income, spending, and profitability across phases and departments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer hover:text-gray-600"
                onClick={() => {
                  fetchIncome();
                  fetchExpense();
                  fetchResourceCosts();
                  show("Revenue & Expenses reloaded", "success");
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Reload
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 cursor-pointer"
                title={fullViewBlock === "revexp" ? "Exit full view" : "Full view"}
                onClick={() => toggleFull("revexp")}
              >
                {fullViewBlock === "revexp" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className={cn("p-6 space-y-6", fullViewBlock !== "revexp" && "max-h-[600px] overflow-y-auto custom-scrollbar")}>
            {/* Summary metric cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MetricCard
                label="Total income"
                value={fmt(totalIncome, currency)}
                sub={`${income.length} entries`}
                valueClass="text-green-600 dark:text-green-400"
              />
              <MetricCard
                label="Total expenses"
                value={fmt(totalExpenses, currency)}
                sub={`${expenses.length} entries`}
                valueClass="text-destructive"
              />
              <MetricCard
                label="Current balance"
                value={(currentBalance >= 0 ? "+" : "") + fmt(currentBalance, currency)}
                sub="Received − Paid (cash basis)"
                valueClass={currentBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}
              />
              <MetricCard
                label="Budget utilized"
                value={`${budgetUsedPct}%`}
                sub={`of ${fmt(budget, currency)} budget`}
                valueClass={
                  budgetUsedPct <= 70
                    ? "text-foreground"
                    : budgetUsedPct <= 100
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-destructive"
                }
              />
              <MetricCard
                label="Pending receivables"
                value={fmt(pendingReceivables, currency)}
                sub="Expected / partial income"
                valueClass="text-yellow-600 dark:text-yellow-400"
              />
              <MetricCard
                label="Pending payables"
                value={fmt(pendingPayables, currency)}
                sub="Approved, awaiting payment"
                valueClass="text-yellow-600 dark:text-yellow-400"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border overflow-x-auto custom-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
                    activeTab === tab.key
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === "income" && (
                <IncomeTab
                  income={income}
                  currency={currency}
                  onAdd={() => { setEditingIncome(null); setIncomeDialogOpen(true); }}
                  onEdit={handleEditIncome}
                  onDelete={handleDeleteIncome}
                  canAdd={permissions.canAddIncome}
                  canEdit={permissions.canEditIncome}
                  canDelete={permissions.canDeleteIncome}
                />
              )}
              {activeTab === "expenses" && (
                <ExpensesTab
                  expenses={expenses}
                  currency={currency}
                  onAdd={() => { setEditingExpense(null); setExpenseDialogOpen(true); }}
                  onEdit={handleEditExpense}
                  onDelete={handleDeleteExpense}
                  onApprove={handleApproveExpense}
                  onReject={handleRejectExpense}
                  canAdd={permissions.canAddExpense}
                  canEdit={permissions.canEditExpense}
                  canDelete={permissions.canDeleteExpense}
                  canApprove={permissions.canApproveExpense}
                />
              )}
              {activeTab === "breakdown" && (
                <BreakdownTab expenses={expenses} currency={currency} />
              )}
              {activeTab === "phases" && (
                <PhasePLTab income={income} expenses={expenses} currency={currency} />
              )}
              {activeTab === "resources" && (
                <ResourceCostTab data={resourceCosts} currency={currency} />
              )}
              {activeTab === "variance" && (
                <BudgetVarianceTab departments={resourceCosts.departments} currency={currency} />
              )}
              {activeTab === "analytics" && (
                <AnalyticsTab income={income} expenses={expenses} currency={currency} />
              )}
              {activeTab === "transactions" && (
                <TransactionsTab income={income} expenses={expenses} currency={currency} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Ticketing block (event-only) ── */}
      {showTicketing && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background border border-border">
                <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="font-medium text-sm text-foreground">Ticketing</span>
              <span className="text-xs text-muted-foreground">Revenue source</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 cursor-pointer"
              title={fullViewBlock === "ticketing" ? "Exit full view" : "Full view"}
              onClick={() => toggleFull("ticketing")}
            >
              {fullViewBlock === "ticketing" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="p-6">
            <TicketingSection
              planId={planId}
              permissions={permissions}
              embedded
              maxHeight={fullViewBlock === "ticketing" ? null : 380}
            />
          </div>
        </div>
      )}

      <AddIncomeDialog
        open={incomeDialogOpen}
        onOpenChange={setIncomeDialogOpen}
        editing={editingIncome}
        onClose={() => { setIncomeDialogOpen(false); setEditingIncome(null); }}
        workItemId={planId}
      />

      <AddExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        editing={editingExpense}
        onClose={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}
        workItemId={planId}
      />

      <Dialog open={!!rejectingExpenseId} onOpenChange={(open) => { if (!open) setRejectingExpenseId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject expense request</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 pt-2">
            <Textarea
              placeholder="Explain why this expense is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button className="cursor-pointer hover:text-gray-600" variant="outline" onClick={() => setRejectingExpenseId(null)} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button className="cursor-pointer" variant="destructive" onClick={handleConfirmReject} disabled={rejectSubmitting || !rejectionReason.trim()}>
              {rejectSubmitting ? "Rejecting..." : "Reject expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}