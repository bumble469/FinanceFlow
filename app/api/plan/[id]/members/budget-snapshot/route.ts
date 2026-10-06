import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getProjectDurationMonths } from "@/lib/budget-validation";
import { assertFinanceEnabled } from "@/lib/finance-guard";

type Params = { params: Promise<{ id: string }> };

// GET /api/plan/[id]/members/budget-snapshot?excludeMemberId=...
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;
    
    const excludeMemberId = req.nextUrl.searchParams.get("excludeMemberId") || undefined;

    const workItem = await prisma.workItem.findUnique({
      where: { id: planId },
      include: { project: true },
    });
    if (!workItem) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const durationMonths = getProjectDurationMonths(workItem.project) ?? 1;
    const durationKnown = getProjectDurationMonths(workItem.project) !== null;
    const totalBudget = Number(workItem.budget ?? 0);

    const allMembers = await prisma.workItemMember.findMany({
      where: {
        workItemId: planId,
        ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
      },
      select: { id: true, monthlyCost: true },
    });
    const totalCommitted = allMembers.reduce(
      (sum, m) => sum + Number(m.monthlyCost ?? 0) * durationMonths,
      0
    );

    const departments = await prisma.department.findMany({
      where: { workItemId: planId },
      include: {
        members: {
          where: excludeMemberId ? { workItemMemberId: { not: excludeMemberId } } : {},
          include: { workItemMember: { select: { monthlyCost: true } } },
        },
      },
    });

    const deptSnapshots = departments.map((d) => ({
      id: d.id,
      name: d.name,
      budget: Number(d.budget ?? 0),
      committed: d.members.reduce((sum, dm) => sum + Number(dm.costShare ?? 0) * durationMonths, 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        durationMonths,
        durationKnown,
        totalBudget,
        totalCommitted,
        departments: deptSnapshots,
      },
    });
  } catch (err) {
    console.error("[GET /members/budget-snapshot]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}