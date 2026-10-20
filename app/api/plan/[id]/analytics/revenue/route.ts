import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { assertFinanceEnabled } from "@/lib/finance-guard";
import { computeFinanceTotals } from "@/lib/analytics/finance";
import {
  computeRevenueSources,
  computeBookingSeries,
  computeStallPerformance,
} from "@/lib/analytics/attendance";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [
      workItem,
      departments,
      expenses,
      income,
      stalls,
      bookings,
    ] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { budget: true, currency: true },
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
          occurredAt: true,
          createdAt: true,
          departmentId: true,
          stallId: true,
          department: { select: { name: true } },
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
          receivedAt: true,
          createdAt: true,
          departmentId: true,
          stallId: true,
          department: { select: { name: true } },
        },
      }),
      prisma.stall.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true, description: true },
      }),
      prisma.ticketBooking.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          ticketTypeId: true,
          quantity: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const expenseLikes = expenses.map((e) => ({
      id: e.id,
      amount: num(e.amount),
      paidAmount: num(e.paidAmount),
      category: e.category,
      status: e.status,
      paymentStatus: e.paymentStatus,
      departmentId: e.departmentId,
      departmentName: e.department?.name,
      stallId: e.stallId,
      occurredAt: e.occurredAt ? e.occurredAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    }));

    const incomeLikes = income.map((i) => ({
      id: i.id,
      amount: num(i.amount),
      receivedAmount: num(i.receivedAmount),
      type: i.type,
      status: i.status,
      departmentId: i.departmentId,
      departmentName: i.department?.name,
      stallId: i.stallId,
      receivedAt: i.receivedAt ? i.receivedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
    }));

    const bookingLikes = bookings.map((b) => ({
      id: b.id,
      ticketTypeId: b.ticketTypeId,
      quantity: b.quantity,
      totalAmount: num(b.totalAmount),
      status: b.status,
      paymentStatus: b.paymentStatus,
      createdAt: b.createdAt.toISOString(),
    }));

    const totals = computeFinanceTotals({
      totalBudget: num(workItem.budget),
      departments: departments.map((d) => ({ ...d, budget: num(d.budget) })),
      income: incomeLikes,
      expenses: expenseLikes,
    });

    // Expenses by category
    const expensesByCategory: Record<string, { total: number; paid: number }> = {};
    for (const e of expenseLikes) {
      const cat = e.category || "OTHER";
      if (!expensesByCategory[cat]) expensesByCategory[cat] = { total: 0, paid: 0 };
      expensesByCategory[cat].total += e.amount;
      expensesByCategory[cat].paid += e.paidAmount;
    }

    // Income by type
    const incomeByType: Record<string, { total: number; received: number }> = {};
    for (const i of incomeLikes) {
      const typ = i.type || "OTHER";
      if (!incomeByType[typ]) incomeByType[typ] = { total: 0, received: 0 };
      incomeByType[typ].total += i.amount;
      incomeByType[typ].received += i.receivedAmount;
    }

    const ticketRevenue = bookingLikes
      .filter((b) => b.status === "CONFIRMED")
      .reduce((s, b) => s + b.totalAmount, 0);

    const revenueSources = computeRevenueSources({
      ticketRevenue,
      income: incomeLikes,
    });

    const bookingSeries = computeBookingSeries(bookingLikes, "30d");
    const stallPerformance = computeStallPerformance(stalls, incomeLikes, expenseLikes);

    const rollup = {
      totals,
      expensesByCategory,
      incomeByType,
      revenueSources,
      bookingSeries,
      stallPerformance,
      expenses: expenseLikes,
      income: incomeLikes,
      currency: workItem.currency || "USD",
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/revenue]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
