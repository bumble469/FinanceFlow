import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { assertFinanceEnabled } from "@/lib/finance-guard";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workItemId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const blocked = await assertFinanceEnabled(workItemId);
    if (blocked) return blocked;

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ error: "Not a member of this plan" }, { status: 403 });

    const [departments, phases, expensesByDept, expensesByPhase] = await Promise.all([
      prisma.department.findMany({
        where: { workItemId },
        include: {
          members: {
            include: {
              workItemMember: { select: { monthlyCost: true } },
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.phase.findMany({
        where: { workItemId },
        include: {
          phaseMembers: {
            include: {
              workItemMember: { select: { monthlyCost: true } },
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.expense.groupBy({
        by: ["departmentId"],
        where: { workItemId, departmentId: { not: null }, status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.expense.groupBy({
        by: ["phaseId"],
        where: { workItemId, phaseId: { not: null }, status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] } },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    const deptExpenseMap = new Map(
      expensesByDept.map((e) => [e.departmentId, { amount: num(e._sum.amount), paid: num(e._sum.paidAmount) }])
    );
    const phaseExpenseMap = new Map(
      expensesByPhase.map((e) => [e.phaseId, { amount: num(e._sum.amount), paid: num(e._sum.paidAmount) }])
    );

    const departmentData = departments.map((d) => {
      const memberCosts = d.members.map((m) => ({
        name: m.user.name || m.user.email,
        monthlyCost: m.costShare !== null ? num(m.costShare) : num(m.workItemMember.monthlyCost),
        isOverridden: m.costShare !== null,
      }));
      const totalMonthlyCost = memberCosts.reduce((s, m) => s + m.monthlyCost, 0);
      const actual = deptExpenseMap.get(d.id) ?? { amount: 0, paid: 0 };

      return {
        id: d.id,
        name: d.name,
        budget: num(d.budget),
        memberCosts,
        totalMonthlyCost,
        memberCount: d.members.length,
        actualExpenses: actual.amount,
        actualPaid: actual.paid,
      };
    });

    const phaseData = phases.map((p) => {
      const memberCosts = p.phaseMembers.map((m) => ({
        name: m.user.name || m.user.email,
        monthlyCost: num(m.workItemMember.monthlyCost),
      }));
      const totalMonthlyCost = memberCosts.reduce((s, m) => s + m.monthlyCost, 0);
      const actual = phaseExpenseMap.get(p.id) ?? { amount: 0, paid: 0 };

      return {
        id: p.id,
        name: p.name,
        memberCosts,
        totalMonthlyCost,
        memberCount: p.phaseMembers.length,
        actualExpenses: actual.amount,
        actualPaid: actual.paid,
      };
    });

    return NextResponse.json({ success: true, data: { departments: departmentData, phases: phaseData } });
  } catch (error) {
    console.error("[GET /api/plan/[id]/resource-costs] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}