"use client";

import { useEffect, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { authClient } from "@/lib/auth-client";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import {
  Wallet, ArrowDownCircle, PiggyBank, TrendingUp, Info,
  Clock, Flag, Users, Lightbulb, CalendarClock, Ban
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatCurrency, getStatus, TASK_STATUS_CONFIG } from "./lib/overview-utils";
import { computeHealthScore, generateInsights } from "./components/insights-engine";
import { CustomPieTooltip } from "./components/custom-pie-tooltip";
import { HealthGauge } from "./components/health-gauge";
import { InsightsFeed } from "./components/insights-feed";
import { TaskDueBuckets } from "./components/task-due-buckets";
import { IncomeExpenseTrend } from "./components/income-expense-trend";
import { PendingApprovalsWidget } from "./components/pending-approvals-widget";
import { HardwareImpactWidget } from "./components/hardware-impact-widget";
import { DepartmentBreakdown } from "./components/department-breakdown";
import { usePendingApprovalCounts } from "./hooks/use-pending-approval-counts";
import { RiskPanel } from "./components/risk-panel";

export function ProjectOverview() {
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

  const overdueMilestones = milestones.filter((m) => m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) < new Date());
  const upcomingMilestones = milestones
    .filter((m) => m.status !== "ACHIEVED")
    .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
    .slice(0, 5);

  const deptRows = resourceCosts.departments.map((d) => ({
    name: d.name,
    budget: d.budget,
    actual: d.actualExpenses,
    over: d.budget > 0 && d.actualExpenses > d.budget,
  }));

  const departmentStats = departments.map((d) => {
    const deptTasks = tasks.filter((t) => t.departmentId === d.id);
    const deptResource = resourceCosts.departments.find((r) => r.name === d.name);
    return {
      name: d.name,
      budget: Number(d.budget || 0),
      budgetUsedPct: deptResource?.budget ? (deptResource.actualExpenses / deptResource.budget) * 100 : 0,
      completionPct: deptTasks.length > 0
        ? (deptTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length / deptTasks.length) * 100
        : 0,
      openTasks: deptTasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED").length,
    };
  });

  const workload = teamMembers.map((m) => ({
    name: m.user?.name ?? "Unnamed",
    count: tasks.filter((t) => t.assignees?.some((a) => a.id === m.id)).length,
  })).filter((w) => w.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Budget" value={formatCurrency(totalBudget, currency)} status="healthy" icon={<Wallet className="h-4 w-4" />} isSimulated={simulation.isSimulating} />
        <MetricCard
          title="Budget Allocated" value={formatCurrency(totalAllocated, currency)}
          status={totalAllocated / totalBudget > 0.9 ? "warning" : "healthy"} icon={<ArrowDownCircle className="h-4 w-4" />}
          isSimulated={simulation.isSimulating} progressPercent={totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0}
        />
        <MetricCard
          title="Budget Remaining" value={formatCurrency(remainingBudget, currency)}
          status={balanceStatus} trend={balanceStatus === "healthy" ? "up" : "down"} icon={<PiggyBank className="h-4 w-4" />}
          isSimulated={simulation.isSimulating} progressPercent={totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0}
        />
        <MetricCard title="Profit / Loss" value={formatCurrency(estimatedProfitLoss, currency)} status={profitStatus} trend={estimatedProfitLoss >= 0 ? "up" : "down"} icon={<TrendingUp className="h-4 w-4" />} isSimulated={simulation.isSimulating} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center gap-1" style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.04) 0%, rgba(30,30,40,0) 60%)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground self-start mb-1">Plan Health</p>
          <HealthGauge score={healthScore} />
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 lg:col-span-2" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.03) 0%, rgba(30,30,40,0) 60%)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              <Lightbulb className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-foreground">AI Insights</h3>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              {insights.length} signals
            </span>
          </div>
          <InsightsFeed insights={insights} />
        </div>
      </div>

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

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Deadlines at a glance
        </h3>
        <TaskDueBuckets tasks={tasks} />
      </div>

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

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Department breakdown</h3>
        <DepartmentBreakdown departmentStats={departmentStats} currency={currency} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-3">Income vs. Expense trend</h3>
        <IncomeExpenseTrend income={income} expenses={expenses} currency={currency} />
      </div>

      <PendingApprovalsWidget expenseCount={pendingExpenseApprovals} extensionCount={pendingExtensions} />

      {currentPlanMeta?.hasHardware && <HardwareImpactWidget planId={currentPlanId!} />}


      <RiskPanel
        items={[
          { label: "over budget", sublabel: "departments", count: deptRows.filter((d) => d.over).length, icon: ArrowDownCircle },
          { label: "overdue", sublabel: "milestones", count: overdueMilestones.length, icon: Clock },
          { label: "blocked", sublabel: "tasks", count: blockedTasks, icon: Ban },
        ]}
      />
    </div>
  );
}