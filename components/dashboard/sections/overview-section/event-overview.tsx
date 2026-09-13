"use client";

import { useEffect, useState } from "react";
import { useFinancialStore } from "@/lib/store";
import { authClient } from "@/lib/auth-client";
import { MetricCard } from "@/components/dashboard/components/metric-card";
import {
  Wallet, ArrowDownCircle, PiggyBank, TrendingUp, AlertTriangle,
  Clock, Ban, Flag, QrCode, Store, Lightbulb, CalendarClock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

import { formatCurrency, getStatus } from "./lib/overview-utils";
import { computeHealthScore, generateInsights } from "./components/insights-engine";
import { HealthGauge } from "./components/health-gauge";
import { InsightsFeed } from "./components/insights-feed";
import { TaskDueBuckets } from "./components/task-due-buckets";
import { ReadinessWidget } from "./components/readiness-widget";
import { IncomeExpenseTrend } from "./components/income-expense-trend";
import { PendingApprovalsWidget } from "./components/pending-approvals-widget";
import { HardwareImpactWidget } from "./components/hardware-impact-widget";
import { DepartmentBreakdown } from "./components/department-breakdown";
import { usePendingApprovalCounts } from "./hooks/use-pending-approval-counts";
import { RiskPanel } from "./components/risk-panel";

export function EventOverview() {
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

  const eventDate = currentPlanMeta?.eventDate ? new Date(currentPlanMeta.eventDate) : null;
  const daysLeft = eventDate ? Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const totalTicketsSold = confirmedBookings.reduce((s, b) => s + b.quantity, 0);
  const totalTicketCapacity = ticketTypes.reduce((s, t) => s + (t.capacity ?? 0), 0);
  const hasCapacityLimits = ticketTypes.some((t) => t.capacity !== null);
  const ticketRevenue = confirmedBookings.reduce((s, b) => s + b.totalAmount, 0);
  const totalAttendees = confirmedBookings.reduce((s, b) => s + b.attendees.length, 0);
  const checkedInCount = confirmedBookings.reduce((s, b) => s + b.attendees.filter((a: any) => a.checkedIn).length, 0);
  const checkInRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : 0;

  const stallIncomeTotal = income.filter((i) => i.stallId).reduce((s, i) => s + i.receivedAmount, 0);
  const stallExpenseTotal = expenses.filter((e) => e.stallId).reduce((s, e) => s + e.paidAmount, 0);

  const revenueSources = [
    { name: "Ticket sales", value: ticketRevenue, hex: "#6366f1" },
    { name: "Stall income", value: stallIncomeTotal, hex: "#22c55e" },
    { name: "Other income", value: Math.max(0, totalIncomeReceived - ticketRevenue - stallIncomeTotal), hex: "#94a3b8" },
  ].filter((r) => r.value > 0);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
  const readinessPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const blockedTasksArr = tasks.filter((t) => t.status === "BLOCKED");
  const blockedTasks = blockedTasksArr.length;

  const overdueMilestones = milestones.filter((m) => m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate) < new Date());

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
                      <div className={cn("h-full rounded-full", totalTicketsSold / totalTicketCapacity > 0.9 ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, (totalTicketsSold / (totalTicketCapacity || 1)) * 100)}%` }} />
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
                    <Pie data={[{ value: checkedInCount, hex: "#22c55e" }, { value: totalAttendees - checkedInCount, hex: "#e5e7eb" }]} dataKey="value" innerRadius={45} outerRadius={65} startAngle={90} endAngle={-270} stroke="none">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Event-day readiness</h3>
          <ReadinessWidget tasks={tasks} daysLeft={daysLeft} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Deadlines at a glance
          </h3>
          <TaskDueBuckets tasks={tasks} />
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
          { label: "overdue", sublabel: "milestones", count: overdueMilestones.length, icon: Flag },
          { label: "blocked", sublabel: "prep tasks", count: blockedTasks, icon: Ban },
        ]}
      />
    </div>
  );
}