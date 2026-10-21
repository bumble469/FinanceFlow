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

    const [workItem, hardwareItems] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { currency: true, hasHardware: true },
      }),
      prisma.hardwareItem.findMany({
        where: { workItemId: planId },
        include: {
          department: { select: { id: true, name: true } },
          stall: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const items = hardwareItems.map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category,
      source: h.source,
      quantity: h.quantity,
      monthlyRentAmount: num(h.monthlyRentAmount),
      depositAmount: num(h.depositAmount),
      depositReturned: h.depositReturned,
      condition: h.condition,
      requestStatus: h.requestStatus,
      departmentId: h.departmentId,
      departmentName: h.department?.name,
      stallId: h.stallId,
      stallName: h.stall?.name,
      requestedByName: h.requestedBy?.user?.name,
    }));

    const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
    const totalMonthlyRent = items.reduce((s, i) => s + i.monthlyRentAmount, 0);
    const totalDeposits = items.reduce((s, i) => s + (i.depositReturned ? 0 : i.depositAmount), 0);

    const categoryCounts: Record<string, number> = {};
    const conditionCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + item.quantity;
      if (item.condition) {
        conditionCounts[item.condition] = (conditionCounts[item.condition] ?? 0) + item.quantity;
      }
      sourceCounts[item.source] = (sourceCounts[item.source] ?? 0) + item.quantity;
    }

    const rollup = {
      items,
      totalItems: items.length,
      totalQuantity,
      totalMonthlyRent,
      totalDeposits,
      categoryCounts,
      conditionCounts,
      sourceCounts,
      currency: workItem.currency || "USD",
      hasHardware: workItem.hasHardware,
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/hardware]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
