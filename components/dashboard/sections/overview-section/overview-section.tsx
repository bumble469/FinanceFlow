"use client";

import { useEffect, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { authClient } from "@/lib/auth-client";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import {
  Wallet, ArrowDownCircle, PiggyBank, TrendingUp, Info, AlertTriangle,
  Clock, Ban, Flag, Users, QrCode, Store, Lightbulb, CalendarClock, FileClock, Wrench
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis, LineChart, Line,
} from "recharts";
import type { FinancialStatus, TaskStatus, Task, Milestone, Income, Expense } from "@/lib/types";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol} ${value.toLocaleString("en-IN")}`;
}

function getStatus(value: number, threshold: number): FinancialStatus {
  if (threshold === 0) return "risk";
  const ratio = value / threshold;
  if (ratio >= 0.7) return "healthy";
  if (ratio >= 0.3) return "warning";
  return "risk";
}

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; hex: string }> = {
  TODO: { label: "To do", hex: "#9ca3af" },
  IN_PROGRESS: { label: "In progress", hex: "#0ea5e9" },
  SUBMITTED: { label: "Submitted", hex: "#6366f1" },
  CHANGES_REQUESTED: { label: "Changes requested", hex: "#f59e0b" },
  BLOCKED: { label: "Blocked", hex: "#ef4444" },
  DONE: { label: "Done", hex: "#22c55e" },
  COMPLETED: { label: "Completed", hex: "#22c55e" },
};

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.payload.hex }} />
        <span className="text-muted-foreground">{p.name}:</span>
        <span className="font-mono font-medium text-foreground">{p.value}</span>
      </div>
    </div>
  );
}

// ─── insights engine ────────────────────────────────────────────────────────

interface Insight {
  text: string;
  tone: "positive" | "warning" | "negative" | "neutral";
}

function computeHealthScore(params: {
  budgetUsedPct: number;
  progressPct: number;
  overdueMilestones: number;
  blockedTasks: number;
  totalTasks: number;
}): number {
  const { budgetUsedPct, progressPct, overdueMilestones, blockedTasks, totalTasks } = params;

  const budgetScore = budgetUsedPct <= 100
    ? 100 - Math.max(0, budgetUsedPct - progressPct)
    : Math.max(0, 60 - (budgetUsedPct - 100));

  const scheduleScore = Math.max(0, 100 - overdueMilestones * 15);

  const blockedRatio = totalTasks > 0 ? blockedTasks / totalTasks : 0;
  const executionScore = Math.max(0, 100 - blockedRatio * 100);

  const weighted = budgetScore * 0.4 + scheduleScore * 0.3 + executionScore * 0.3;
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

function generateInsights(params: {
  isProject: boolean;
  budgetUsedPct: number;
  progressPct: number;
  overdueMilestones: Milestone[];
  blockedTasks: Task[];
  departmentStats: { name: string; budgetUsedPct: number; completionPct: number; openTasks: number }[];
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  daysLeft?: number | null;
  incompleteTasks?: number;
}): Insight[] {
  const insights: Insight[] = [];
  const {
    budgetUsedPct, progressPct, overdueMilestones, blockedTasks,
    departmentStats, expensesByCategory, totalExpenses, daysLeft, incompleteTasks,
  } = params;

  if (budgetUsedPct - progressPct > 15) {
    insights.push({
      text: `Budget utilization (${budgetUsedPct.toFixed(0)}%) is running ahead of progress (${progressPct.toFixed(0)}%).`,
      tone: "warning",
    });
  }

  if (overdueMilestones.length > 0) {
    insights.push({
      text: `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? "s are" : " is"} overdue: ${overdueMilestones.slice(0, 2).map((m) => `"${m.title}"`).join(", ")}${overdueMilestones.length > 2 ? "..." : ""}.`,
      tone: "negative",
    });
  }

  if (blockedTasks.length > 0) {
    insights.push({
      text: `${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} currently blocked and need attention.`,
      tone: "negative",
    });
  }

  const highestWorkload = [...departmentStats].sort((a, b) => b.openTasks - a.openTasks)[0];
  if (highestWorkload && highestWorkload.openTasks > 0) {
    insights.push({ text: `${highestWorkload.name} has the highest pending workload (${highestWorkload.openTasks} open tasks).`, tone: "neutral" });
  }

  const bestDept = [...departmentStats].filter((d) => d.completionPct > 0).sort((a, b) => b.completionPct - a.completionPct)[0];
  if (bestDept) {
    insights.push({ text: `${bestDept.name} is leading with ${bestDept.completionPct.toFixed(0)}% task completion.`, tone: "positive" });
  }

  const overBudgetDept = departmentStats.find((d) => d.budgetUsedPct > 100);
  if (overBudgetDept) {
    insights.push({ text: `${overBudgetDept.name} has exceeded its allocated budget (${overBudgetDept.budgetUsedPct.toFixed(0)}% used).`, tone: "negative" });
  }

  if (totalExpenses > 0) {
    const sorted = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCategory, topAmount] = sorted[0];
      if (topAmount / totalExpenses > 0.5) {
        insights.push({ text: `${Math.round((topAmount / totalExpenses) * 100)}% of expenses belong to ${topCategory}.`, tone: "neutral" });
      }
    }
  }

  if (!params.isProject && daysLeft !== undefined && daysLeft !== null && incompleteTasks !== undefined) {
    if (daysLeft >= 0 && incompleteTasks > 0) {
      insights.push({
        text: `Event is ${daysLeft} day${daysLeft !== 1 ? "s" : ""} away with ${incompleteTasks} incomplete task${incompleteTasks !== 1 ? "s" : ""}.`,
        tone: daysLeft <= 7 && incompleteTasks > 5 ? "negative" : "neutral",
      });
    }
  }

  return insights.slice(0, 6);
}

// ─── shared widgets ─────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: score, fill: color }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#e5e7eb" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-foreground">{score}</p>
        <p className="text-[10px] text-muted-foreground">Health Score</p>
      </div>
    </div>
  );
}

function InsightsFeed({ insights }: { insights: Insight[] }) {
  const toneStyles: Record<Insight["tone"], string> = {
    positive: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400",
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400",
    negative: "border-destructive/30 bg-destructive/5 text-destructive",
    neutral: "border-border bg-muted/30 text-foreground",
  };
  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No notable insights right now — everything looks steady.</p>;
  }
  return (
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <div key={i} className={cn("rounded-lg border px-3 py-2 text-sm", toneStyles[ins.tone])}>
          {ins.text}
        </div>
      ))}
    </div>
  );
}

function TaskDueBuckets({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  const withDue = tasks.filter((t) => t.dueDate && t.status !== "DONE" && t.status !== "COMPLETED");
  const overdue = withDue.filter((t) => new Date(t.dueDate!) < startOfToday).length;
  const dueToday = withDue.filter((t) => new Date(t.dueDate!) >= startOfToday && new Date(t.dueDate!) < endOfToday).length;
  const dueThisWeek = withDue.filter((t) => new Date(t.dueDate!) >= endOfToday && new Date(t.dueDate!) < endOfWeek).length;
  const recentlyCompleted = tasks.filter(
    (t) => (t.status === "DONE" || t.status === "COMPLETED") && t.completedAt && (now.getTime() - new Date(t.completedAt).getTime()) < 7 * 86400000
  ).length;

  const buckets = [
    { label: "Overdue", count: overdue, tone: "text-destructive" },
    { label: "Due today", count: dueToday, tone: "text-yellow-600 dark:text-yellow-400" },
    { label: "Due this week", count: dueThisWeek, tone: "text-primary" },
    { label: "Completed (7d)", count: recentlyCompleted, tone: "text-green-600 dark:text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {buckets.map((b) => (
        <div key={b.label} className="rounded-lg border border-border px-3 py-2.5">
          <p className={cn("text-xl font-bold", b.tone)}>{b.count}</p>
          <p className="text-xs text-muted-foreground">{b.label}</p>
        </div>
      ))}
    </div>
  );
}

function IncomeExpenseTrend({ income, expenses, currency }: { income: Income[]; expenses: Expense[]; currency: string }) {
  const monthKey = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const map = new Map<string, { month: string; income: number; expense: number }>();

  income.forEach((i) => {
    const key = monthKey(i.receivedAt ?? i.createdAt);
    const row = map.get(key) ?? { month: key, income: 0, expense: 0 };
    row.income += i.receivedAmount;
    map.set(key, row);
  });
  expenses.forEach((e) => {
    const key = monthKey(e.occurredAt ?? e.createdAt);
    const row = map.get(key) ?? { month: key, income: 0, expense: 0 };
    row.expense += e.paidAmount;
    map.set(key, row);
  });

  const data = Array.from(map.values()).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground text-center py-10">Not enough data yet for a trend</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} width={70} />
        <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
        <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} name="Income" />
        <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="Expense" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PendingApprovalsWidget({ expenseCount, extensionCount }: { expenseCount: number; extensionCount: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
        <FileClock className="h-4 w-4 text-muted-foreground" />
        Pending approvals
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border px-3 py-2.5">
          <p className="text-xl font-bold text-foreground">{expenseCount}</p>
          <p className="text-xs text-muted-foreground">Expense requests</p>
        </div>
        <div className="rounded-lg border border-border px-3 py-2.5">
          <p className="text-xl font-bold text-foreground">{extensionCount}</p>
          <p className="text-xs text-muted-foreground">Extension requests</p>
        </div>
      </div>
    </div>
  );
}

function HardwareImpactWidget({ planId }: { planId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useFinancialStore();

  useEffect(() => {
    if (!planId) return;
    authClient.request(`/api/plan/${planId}/hardware`)
      .then((res) => setItems(res.data.data ?? []))
      .catch((err) => console.error("Failed to fetch hardware:", err))
      .finally(() => setLoading(false));
  }, [planId]);

  const pendingCount = items.filter((h) => h.requestStatus === "PENDING").length;
  const monthlyRentCost = items
    .filter((h) => h.requestStatus === "APPROVED" && h.source === "RENTED" && h.monthlyRentAmount)
    .reduce((s, h) => s + h.monthlyRentAmount, 0);
  const outstandingDeposits = items
    .filter((h) => h.requestStatus === "APPROVED" && h.depositAmount && !h.depositReturned)
    .reduce((s, h) => s + h.depositAmount, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        Hardware
      </h3>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className={cn("text-xl font-bold", pendingCount > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-foreground")}>
              {pendingCount}
            </p>
            <p className="text-xs text-muted-foreground">Pending requests</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(monthlyRentCost, currency)}</p>
            <p className="text-xs text-muted-foreground">Monthly rental cost</p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(outstandingDeposits, currency)}</p>
            <p className="text-xs text-muted-foreground">Outstanding deposits</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentBreakdown({
  departmentStats,
}: {
  departmentStats: { name: string; budgetUsedPct: number; completionPct: number; openTasks: number }[];
}) {
  if (departmentStats.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No departments yet</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {departmentStats.map((d) => (
        <div key={d.name} className="rounded-lg border border-border px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{d.name}</p>
            <span className="text-xs text-muted-foreground">{d.completionPct.toFixed(0)}% done</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${d.completionPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{d.openTasks} open tasks</span>
            {d.budgetUsedPct > 0 && (
              <span className={cn(d.budgetUsedPct > 100 && "text-destructive font-medium")}>
                {d.budgetUsedPct.toFixed(0)}% budget used
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function usePendingApprovalCounts(currentPlanId: string | null, expenses: Expense[]) {
  const [pendingExtensions, setPendingExtensions] = useState(0);

  useEffect(() => {
    if (!currentPlanId) return;
    authClient.request(`/api/plan/${currentPlanId}/extension-requests/pending-counts`)
      .then((res) => {
        const byMilestone = res.data.data.byMilestone ?? {};
        setPendingExtensions(Object.values(byMilestone).reduce((s: number, n: any) => s + n, 0));
      })
      .catch((err) => console.error("Failed to fetch pending extension counts:", err));
  }, [currentPlanId]);

  const pendingExpenseApprovals = expenses.filter((e) => e.status === "PENDING_APPROVAL").length;

  return { pendingExpenseApprovals, pendingExtensions };
}

// ─── Project Overview ───────────────────────────────────────────────────────

function ProjectOverview() {
  const {
    expenses, income, simulation, eventData, departments, currency,
    tasks, milestones, teamMembers, currentPlanId, currentPlanMeta,
  } = useFinancialStore();

  const [resourceCosts, setResourceCosts] = useState<{ departments: any[] }>({ departments: [] });

  useEffect(() => {
    if (!currentPlanId) return;
    authClient.request(`/api/plan/${currentPlanId}/resource-costs`)
      .then((res) => setResourceCosts(res.data.data))
      .catch((err) => console.error("Failed to fetch resource costs:", err));
  }, [currentPlanId]);

  const { pendingExpenseApprovals, pendingExtensions } = usePendingApprovalCounts(currentPlanId, expenses);

  const totalBudget = eventData.eventBudget;
  const totalAllocated = departments.reduce((sum, d) => sum + Number(d.budget || 0), 0);
  const remainingBudget = totalBudget - totalAllocated;
  const totalIncomeReceived = income.reduce((sum, i) => sum + (i.receivedAmount || 0), 0);
  const totalExpensesPaid = expenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
  const estimatedProfitLoss = totalIncomeReceived - totalExpensesPaid;
  const balanceStatus = getStatus(remainingBudget, totalBudget);
  const profitStatus = estimatedProfitLoss >= 0 ? "healthy" : estimatedProfitLoss > -10000 ? "warning" : "risk";

  // Task status breakdown
  const taskStatusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);
  const taskPieData = (Object.keys(TASK_STATUS_CONFIG) as TaskStatus[])
    .filter((s) => taskStatusCounts[s] > 0)
    .map((s) => ({ name: TASK_STATUS_CONFIG[s].label, value: taskStatusCounts[s], hex: TASK_STATUS_CONFIG[s].hex }));
  const totalTasks = tasks.length;
  const doneTasksCount = tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
  const progressPct = totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0;
  const blockedTasksArr = tasks.filter((t) => t.status === "BLOCKED");
  const blockedTasks = blockedTasksArr.length;

  // Milestones
  const overdueMilestones = milestones.filter(
    (m) => m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) < new Date()
  );
  const upcomingMilestones = milestones
    .filter((m) => m.status !== "ACHIEVED")
    .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
    .slice(0, 5);

  // Department budget vs actual (chart data)
  const deptRows = resourceCosts.departments.map((d) => ({
    name: d.name,
    budget: d.budget,
    actual: d.actualExpenses,
    over: d.budget > 0 && d.actualExpenses > d.budget,
  }));

  // Department stats (for insights + breakdown widget)
  const departmentStats = departments.map((d) => {
    const deptTasks = tasks.filter((t) => t.departmentId === d.id);
    const deptResource = resourceCosts.departments.find((r) => r.name === d.name);
    return {
      name: d.name,
      budgetUsedPct: deptResource?.budget ? (deptResource.actualExpenses / deptResource.budget) * 100 : 0,
      completionPct: deptTasks.length > 0
        ? (deptTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length / deptTasks.length) * 100
        : 0,
      openTasks: deptTasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED").length,
    };
  });

  // Team workload
  const workload = teamMembers.map((m) => ({
    name: m.user?.name ?? "Unnamed",
    count: tasks.filter((t) => t.assignees?.some((a) => a.id === m.id)).length,
  })).filter((w) => w.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

  // Health score + insights
  const budgetUsedPctForHealth = totalBudget > 0 ? (totalExpensesPaid / totalBudget) * 100 : 0;
  const healthScore = computeHealthScore({
    budgetUsedPct: budgetUsedPctForHealth,
    progressPct,
    overdueMilestones: overdueMilestones.length,
    blockedTasks,
    totalTasks,
  });

  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const insights = generateInsights({
    isProject: true,
    budgetUsedPct: budgetUsedPctForHealth,
    progressPct,
    overdueMilestones,
    blockedTasks: blockedTasksArr,
    departmentStats,
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
    expensesByCategory,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Overview</h1>
          <p className="mt-1 text-muted-foreground">Budget, task progress, and team workload at a glance</p>
        </div>
        {simulation.isSimulating && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-primary">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Simulation Active</span>
          </div>
        )}
      </div>

      {/* Budget metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Budget" value={formatCurrency(totalBudget, currency)} status="healthy" icon={<Wallet className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
        <MetricCard
          title="Total Allocated"
          value={formatCurrency(totalAllocated, currency)}
          subtitle={`${(totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0).toFixed(1)}% allocated`}
          status={totalAllocated / totalBudget > 0.9 ? "warning" : "healthy"}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          isSimulated={simulation.isSimulating}
        />
        <MetricCard title="Remaining Budget" value={formatCurrency(remainingBudget, currency)} status={balanceStatus} trend={balanceStatus === "healthy" ? "up" : "down"} icon={<PiggyBank className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
        <MetricCard title="Profit / Loss" value={formatCurrency(estimatedProfitLoss, currency)} status={profitStatus} trend={estimatedProfitLoss >= 0 ? "up" : "down"} icon={<TrendingUp className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
      </div>

      {/* Health score + Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center">
          <HealthGauge score={healthScore} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            Insights
          </h3>
          <InsightsFeed insights={insights} />
        </div>
      </div>

      {/* Task status + Milestones row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">Task status</h3>
          <p className="text-xs text-muted-foreground mb-3">{totalTasks} total tasks</p>
          {totalTasks === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No tasks yet</p>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={taskPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                    {taskPieData.map((d, i) => <Cell key={i} fill={d.hex} />)}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-2xl font-bold text-foreground">{totalTasks}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {taskPieData.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.hex }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold text-foreground mb-3">Upcoming milestones</h3>
          {upcomingMilestones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No upcoming milestones</p>
          ) : (
            <div className="space-y-2">
              {upcomingMilestones.map((m) => {
                const overdue = m.dueDate && new Date(m.dueDate) < new Date();
                const doneCount = m.tasks.filter((t) => t.status === "DONE").length;
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Flag className={cn("h-3.5 w-3.5 shrink-0", overdue ? "text-destructive" : "text-primary")} />
                      <span className="text-sm truncate">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <span>{doneCount}/{m.tasks.length} tasks</span>
                      {m.dueDate && (
                        <span className={cn(overdue && "text-destructive font-medium")}>
                          {overdue ? "Overdue" : new Date(m.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deadlines at a glance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Deadlines at a glance
        </h3>
        <TaskDueBuckets tasks={tasks} />
      </div>

      {/* Department budget vs actual + Team workload */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold text-foreground mb-3">Department budget vs. actual</h3>
          {deptRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No departments yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, deptRows.length * 45)}>
              <BarChart data={deptRows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v, currency)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Bar dataKey="budget" fill="#94a3b8" radius={[0, 4, 4, 0]} name="Budget" />
                <Bar dataKey="actual" radius={[0, 4, 4, 0]} name="Actual">
                  {deptRows.map((d, i) => <Cell key={i} fill={d.over ? "#ef4444" : "#22c55e"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            Top workload
          </h3>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No assignments yet</p>
          ) : (
            <div className="space-y-2">
              {workload.map((w) => (
                <div key={w.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{w.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{w.count} tasks</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Department breakdown</h3>
        <DepartmentBreakdown departmentStats={departmentStats} />
      </div>

      {/* Income vs Expense trend */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Income vs. Expense trend</h3>
        <IncomeExpenseTrend income={income} expenses={expenses} currency={currency} />
      </div>

      {/* Pending approvals */}
      <PendingApprovalsWidget expenseCount={pendingExpenseApprovals} extensionCount={pendingExtensions} />

      {/* Hardware */}
      {currentPlanMeta?.hasHardware && <HardwareImpactWidget planId={currentPlanId!} />}

      {/* Risk panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Risks & flags
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", deptRows.some((d) => d.over) ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <ArrowDownCircle className={cn("h-4 w-4 shrink-0", deptRows.some((d) => d.over) ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium text-foreground">{deptRows.filter((d) => d.over).length} over budget</p>
              <p className="text-xs text-muted-foreground">departments</p>
            </div>
          </div>
          <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", overdueMilestones.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <Clock className={cn("h-4 w-4 shrink-0", overdueMilestones.length > 0 ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium text-foreground">{overdueMilestones.length} overdue</p>
              <p className="text-xs text-muted-foreground">milestones</p>
            </div>
          </div>
          <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", blockedTasks > 0 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <Ban className={cn("h-4 w-4 shrink-0", blockedTasks > 0 ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium text-foreground">{blockedTasks} blocked</p>
              <p className="text-xs text-muted-foreground">tasks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event Overview ─────────────────────────────────────────────────────────

function EventOverview() {
  const {
    expenses, income, simulation, eventData, departments, currency,
    tasks, milestones, currentPlanId, currentPlanMeta,
    ticketTypes, ticketBookings: bookings, stalls,
  } = useFinancialStore();

  const loadingExtras = false;
  const [resourceCosts, setResourceCosts] = useState<{ departments: any[] }>({ departments: [] });

  useEffect(() => {
    if (!currentPlanId) return;
    authClient.request(`/api/plan/${currentPlanId}/resource-costs`)
      .then((res) => setResourceCosts(res.data.data))
      .catch((err) => console.error("Failed to fetch resource costs:", err));
  }, [currentPlanId]);

  const { pendingExpenseApprovals, pendingExtensions } = usePendingApprovalCounts(currentPlanId, expenses);

  const totalBudget = eventData.eventBudget;
  const totalAllocated = departments.reduce((sum, d) => sum + Number(d.budget || 0), 0);
  const remainingBudget = totalBudget - totalAllocated;
  const totalIncomeReceived = income.reduce((sum, i) => sum + (i.receivedAmount || 0), 0);
  const totalExpensesPaid = expenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
  const estimatedProfitLoss = totalIncomeReceived - totalExpensesPaid;
  const balanceStatus = getStatus(remainingBudget, totalBudget);
  const profitStatus = estimatedProfitLoss >= 0 ? "healthy" : estimatedProfitLoss > -10000 ? "warning" : "risk";

  // Countdown
  const eventDate = currentPlanMeta?.eventDate ? new Date(currentPlanMeta.eventDate) : null;
  const daysLeft = eventDate ? Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  // Ticketing
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const totalTicketsSold = confirmedBookings.reduce((s, b) => s + b.quantity, 0);
  const totalTicketCapacity = ticketTypes.reduce((s, t) => s + (t.capacity ?? 0), 0);
  const hasCapacityLimits = ticketTypes.some((t) => t.capacity !== null);
  const ticketRevenue = confirmedBookings.reduce((s, b) => s + b.totalAmount, 0);
  const totalAttendees = confirmedBookings.reduce((s, b) => s + b.attendees.length, 0);
  const checkedInCount = confirmedBookings.reduce((s, b) => s + b.attendees.filter((a: any) => a.checkedIn).length, 0);
  const checkInRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : 0;

  // Stalls
  const stallIncomeTotal = income.filter((i) => i.stallId).reduce((s, i) => s + i.receivedAmount, 0);
  const stallExpenseTotal = expenses.filter((e) => e.stallId).reduce((s, e) => s + e.paidAmount, 0);

  // Revenue source breakdown
  const revenueSources = [
    { name: "Ticket sales", value: ticketRevenue, hex: "#6366f1" },
    { name: "Stall income", value: stallIncomeTotal, hex: "#22c55e" },
    { name: "Other income", value: Math.max(0, totalIncomeReceived - ticketRevenue - stallIncomeTotal), hex: "#94a3b8" },
  ].filter((r) => r.value > 0);

  // Prep readiness — tasks are phase-less for events
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
  const readinessPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const blockedTasksArr = tasks.filter((t) => t.status === "BLOCKED");
  const blockedTasks = blockedTasksArr.length;

  const overdueMilestones = milestones.filter(
    (m) => m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) < new Date()
  );

  // Department stats
  const departmentStats = departments.map((d) => {
    const deptTasks = tasks.filter((t) => t.departmentId === d.id);
    const deptResource = resourceCosts.departments.find((r) => r.name === d.name);
    return {
      name: d.name,
      budgetUsedPct: deptResource?.budget ? (deptResource.actualExpenses / deptResource.budget) * 100 : 0,
      completionPct: deptTasks.length > 0
        ? (deptTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length / deptTasks.length) * 100
        : 0,
      openTasks: deptTasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED").length,
    };
  });

  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const budgetUsedPctForHealth = totalBudget > 0 ? (totalExpensesPaid / totalBudget) * 100 : 0;

  const healthScore = computeHealthScore({
    budgetUsedPct: budgetUsedPctForHealth,
    progressPct: readinessPct,
    overdueMilestones: overdueMilestones.length,
    blockedTasks,
    totalTasks,
  });

  const insights = generateInsights({
    isProject: false,
    budgetUsedPct: budgetUsedPctForHealth,
    progressPct: readinessPct,
    overdueMilestones,
    blockedTasks: blockedTasksArr,
    departmentStats,
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
    expensesByCategory,
    daysLeft,
    incompleteTasks: totalTasks - doneTasks,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Event Overview</h1>
          <p className="mt-1 text-muted-foreground">
            {currentPlanMeta?.venue ? `${currentPlanMeta.venue} · ` : ""}
            Ticketing, stalls, and event-day readiness
          </p>
        </div>
        {daysLeft !== null && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2",
            daysLeft < 0 ? "bg-muted text-muted-foreground" : daysLeft <= 7 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}>
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              {daysLeft < 0 ? "Event has passed" : daysLeft === 0 ? "Event is today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} to go`}
            </span>
          </div>
        )}
      </div>

      {/* Budget metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Budget" value={formatCurrency(totalBudget, currency)} status="healthy" icon={<Wallet className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
        <MetricCard title="Total Allocated" value={formatCurrency(totalAllocated, currency)} subtitle={`${(totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0).toFixed(1)}% allocated`} status={totalAllocated / totalBudget > 0.9 ? "warning" : "healthy"} icon={<ArrowDownCircle className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
        <MetricCard title="Remaining Budget" value={formatCurrency(remainingBudget, currency)} status={balanceStatus} trend={balanceStatus === "healthy" ? "up" : "down"} icon={<PiggyBank className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
        <MetricCard title="Profit / Loss" value={formatCurrency(estimatedProfitLoss, currency)} status={profitStatus} trend={estimatedProfitLoss >= 0 ? "up" : "down"} icon={<TrendingUp className="h-5 w-5" />} isSimulated={simulation.isSimulating} />
      </div>

      {/* Health score + Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center">
          <HealthGauge score={healthScore} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            Insights
          </h3>
          <InsightsFeed insights={insights} />
        </div>
      </div>

      {/* Ticketing + Revenue source row */}
      {currentPlanMeta?.hasTicketing && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Ticket sales</h3>
            {loadingExtras ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Sold</span>
                    <span className="font-medium text-foreground">
                      {totalTicketsSold}{hasCapacityLimits && ` / ${totalTicketCapacity}`}
                    </span>
                  </div>
                  {hasCapacityLimits && (
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", totalTicketsSold / totalTicketCapacity > 0.9 ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${Math.min(100, (totalTicketsSold / (totalTicketCapacity || 1)) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-mono font-medium text-green-600 dark:text-green-400">{formatCurrency(ticketRevenue, currency)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              Check-in rate
            </h3>
            {loadingExtras ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            ) : totalAttendees === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No attendees yet</p>
            ) : (
              <div className="relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={[{ value: checkedInCount, hex: "#22c55e" }, { value: totalAttendees - checkedInCount, hex: "#e5e7eb" }]}
                      dataKey="value" innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} stroke="none"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-bold text-foreground">{checkInRate}%</p>
                  <p className="text-[10px] text-muted-foreground">{checkedInCount}/{totalAttendees}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Revenue sources</h3>
            {revenueSources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No income recorded yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={revenueSources} dataKey="value" nameKey="name" innerRadius={35} outerRadius={55} paddingAngle={2} stroke="none">
                      {revenueSources.map((r, i) => <Cell key={i} fill={r.hex} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {revenueSources.map((r) => (
                    <span key={r.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.hex }} />
                      {r.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stalls row */}
      {currentPlanMeta?.hasStalls && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <Store className="h-4 w-4 text-muted-foreground" />
            Stalls snapshot
          </h3>
          {loadingExtras ? (
            <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
          ) : stalls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No stalls set up yet</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {stalls.map((s) => {
                const stallIncome = income.filter((i) => i.stallId === s.id).reduce((sum, i) => sum + i.receivedAmount, 0);
                const stallExpense = expenses.filter((e) => e.stallId === s.id).reduce((sum, e) => sum + e.paidAmount, 0);
                const net = stallIncome - stallExpense;
                return (
                  <div key={s.id} className="rounded-lg border border-border px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-muted-foreground">Net</span>
                      <span className={cn("font-mono font-medium", net >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                        {net >= 0 ? "+" : ""}{formatCurrency(net, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <span>Total stall income: <span className="font-mono font-medium text-foreground">{formatCurrency(stallIncomeTotal, currency)}</span></span>
            <span>Total stall expense: <span className="font-mono font-medium text-foreground">{formatCurrency(stallExpenseTotal, currency)}</span></span>
          </div>
        </div>
      )}

      {/* Readiness + Deadlines row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-3">Event-day readiness</h3>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Prep tasks completed</span>
            <span className="font-medium text-foreground">{doneTasks}/{totalTasks}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", readinessPct === 100 ? "bg-green-500" : readinessPct >= 50 ? "bg-yellow-500" : "bg-destructive")} style={{ width: `${readinessPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{readinessPct}% ready</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Deadlines at a glance
          </h3>
          <TaskDueBuckets tasks={tasks} />
        </div>
      </div>

      {/* Department breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Department breakdown</h3>
        <DepartmentBreakdown departmentStats={departmentStats} />
      </div>

      {/* Income vs Expense trend */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Income vs. Expense trend</h3>
        <IncomeExpenseTrend income={income} expenses={expenses} currency={currency} />
      </div>

      {/* Pending approvals */}
      <PendingApprovalsWidget expenseCount={pendingExpenseApprovals} extensionCount={pendingExtensions} />

      {/* Hardware */}
      {currentPlanMeta?.hasHardware && <HardwareImpactWidget planId={currentPlanId!} />}

      {/* Risk panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Risks & flags
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", overdueMilestones.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <Flag className={cn("h-4 w-4 shrink-0", overdueMilestones.length > 0 ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium text-foreground">{overdueMilestones.length} overdue</p>
              <p className="text-xs text-muted-foreground">milestones</p>
            </div>
          </div>
          <div className={cn("rounded-lg border px-3 py-2.5 flex items-center gap-2.5", blockedTasks > 0 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <Ban className={cn("h-4 w-4 shrink-0", blockedTasks > 0 ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium text-foreground">{blockedTasks} blocked</p>
              <p className="text-xs text-muted-foreground">prep tasks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function OverviewSection() {
  const { mode } = useFinancialStore();
  return mode === "project" ? <ProjectOverview /> : <EventOverview />;
}