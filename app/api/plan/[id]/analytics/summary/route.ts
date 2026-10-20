import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { computeFinanceTotals } from "@/lib/analytics/finance";
import { computeHealthScore } from "@/lib/analytics/health-score";
import { generateInsights } from "@/lib/analytics/insights";
import { computeRiskCounts, findScopeViolations } from "@/lib/analytics/risk";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [
      workItem,
      departments,
      expenses,
      income,
      tasks,
      milestones,
      pendingExpenseCount,
      pendingExtensionCount,
    ] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: {
          id: true,
          type: true,
          budget: true,
          currency: true,
          financeEnabled: true,
          event: { select: { eventDate: true } },
        },
      }),
      prisma.department.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true, budget: true },
      }),
      prisma.expense.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          amount: true,
          paidAmount: true,
          category: true,
          status: true,
          paymentStatus: true,
          departmentId: true,
          stallId: true,
        },
      }),
      prisma.income.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          amount: true,
          receivedAmount: true,
          type: true,
          status: true,
          departmentId: true,
          stallId: true,
        },
      }),
      prisma.task.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          departmentId: true,
          milestones: {
            select: {
              milestone: { select: { id: true, title: true, dueDate: true } },
            },
          },
        },
      }),
      prisma.milestone.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          title: true,
          dueDate: true,
          originalDueDate: true,
          status: true,
          tasks: {
            select: {
              task: { select: { id: true, title: true, status: true } },
            },
          },
        },
      }),
      prisma.expense.count({
        where: { workItemId: planId, status: "PENDING_APPROVAL" },
      }),
      prisma.extensionRequest.count({
        where: {
          status: "PENDING",
          OR: [
            { task: { workItemId: planId } },
            { milestone: { workItemId: planId } },
          ],
        },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const totalBudget = num(workItem.budget);
    const financeTotals = computeFinanceTotals({
      totalBudget,
      departments: departments.map((d) => ({ ...d, budget: num(d.budget) })),
      income: income.map((i) => ({ ...i, amount: num(i.amount), receivedAmount: num(i.receivedAmount) })),
      expenses: expenses.map((e) => ({ ...e, amount: num(e.amount), paidAmount: num(e.paidAmount) })),
    });

    const now = new Date();
    const overdueMilestones = milestones.filter(
      (m) => m.status !== "ACHIEVED" && m.dueDate && new Date(m.dueDate).getTime() < now.getTime()
    );
    const blockedTasks = tasks.filter((t) => t.status === "BLOCKED");
    const doneTasks = tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
    const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

    const healthScore = computeHealthScore({
      budgetUsedPct: financeTotals.budgetUsedPct,
      progressPct,
      overdueMilestones: overdueMilestones.length,
      blockedTasks: blockedTasks.length,
      totalTasks: tasks.length,
      financeEnabled: workItem.financeEnabled,
    });

    // Expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || "OTHER";
      expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + num(e.amount);
    }

    // Department spend map
    const deptSpendMap = new Map<string, number>();
    for (const e of expenses) {
      if (e.departmentId && (e.status === "APPROVED" || e.status === "PARTIALLY_PAID" || e.status === "PAID")) {
        deptSpendMap.set(e.departmentId, (deptSpendMap.get(e.departmentId) ?? 0) + num(e.paidAmount));
      }
    }

    const departmentStats = departments.map((d) => {
      const deptTasks = tasks.filter((t) => t.departmentId === d.id);
      const deptBudget = num(d.budget);
      const actualSpend = deptSpendMap.get(d.id) ?? 0;
      const budgetUsedPct = deptBudget > 0 ? (actualSpend / deptBudget) * 100 : 0;
      const deptDone = deptTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
      return {
        name: d.name,
        budgetUsedPct,
        completionPct: deptTasks.length > 0 ? Math.round((deptDone / deptTasks.length) * 100) : 0,
        openTasks: deptTasks.length - deptDone,
      };
    });

    const isProject = workItem.type === "PROJECT";
    const eventDate = workItem.event?.eventDate ? new Date(workItem.event.eventDate) : null;
    const daysLeft = eventDate ? Math.ceil((eventDate.getTime() - now.getTime()) / 86_400_000) : null;
    const incompleteTasks = tasks.length - doneTasks;

    const insights = generateInsights({
      isProject,
      budgetUsedPct: financeTotals.budgetUsedPct,
      progressPct,
      overdueMilestones: overdueMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      })),
      blockedTasks: blockedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
      departmentStats,
      totalExpenses: financeTotals.totalExpensesPaid,
      expensesByCategory,
      daysLeft,
      incompleteTasks,
      financeEnabled: workItem.financeEnabled,
    });

    const overBudgetDepts = departments
      .filter((d) => {
        const b = num(d.budget);
        const actual = deptSpendMap.get(d.id) ?? 0;
        return b > 0 && actual > b;
      })
      .map((d) => ({ name: d.name }));

    const scopeViolations = findScopeViolations(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        milestones: t.milestones.map((mt) => ({
          id: mt.milestone.id,
          title: mt.milestone.title,
          dueDate: mt.milestone.dueDate ? mt.milestone.dueDate.toISOString() : null,
        })),
      }))
    );

    const riskCounts = computeRiskCounts({
      overBudgetDepartments: overBudgetDepts,
      overdueMilestones: overdueMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
      })),
      blockedTasks: blockedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
      scopeViolations,
    });

    const rollup = {
      totals: financeTotals,
      healthScore,
      insights,
      riskCounts,
      pendingExpenseApprovals: pendingExpenseCount,
      pendingExtensions: pendingExtensionCount,
      currency: workItem.currency || "USD",
      financeEnabled: workItem.financeEnabled,
      isProject,
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/summary]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
