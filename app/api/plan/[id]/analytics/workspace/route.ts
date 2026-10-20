import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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

    const [workItem, departments, expensesByDept, tasks] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { currency: true, financeEnabled: true },
      }),
      prisma.department.findMany({
        where: { workItemId: planId },
        include: {
          _count: { select: { members: true, tasks: true } },
        },
      }),
      prisma.expense.groupBy({
        by: ["departmentId"],
        where: {
          workItemId: planId,
          departmentId: { not: null },
          status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.task.findMany({
        where: { workItemId: planId },
        select: { id: true, status: true, departmentId: true },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const expenseMap = new Map(
      expensesByDept.map((e) => [
        e.departmentId!,
        { amount: num(e._sum.amount), paid: num(e._sum.paidAmount) },
      ])
    );

    const departmentStats = departments.map((d) => {
      const deptTasks = tasks.filter((t) => t.departmentId === d.id);
      const budget = num(d.budget);
      const actual = expenseMap.get(d.id) ?? { amount: 0, paid: 0 };
      const doneCount = deptTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
      const budgetUsedPct = budget > 0 ? (actual.amount / budget) * 100 : 0;
      const completionPct = deptTasks.length > 0 ? (doneCount / deptTasks.length) * 100 : 0;

      return {
        id: d.id,
        name: d.name,
        budget,
        actualExpenses: actual.amount,
        actualPaid: actual.paid,
        budgetUsedPct,
        completionPct,
        openTasks: deptTasks.length - doneCount,
        totalTasks: deptTasks.length,
        memberCount: d._count.members,
      };
    });

    const rollup = {
      departmentStats,
      currency: workItem.currency || "USD",
      financeEnabled: workItem.financeEnabled,
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/workspace]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
