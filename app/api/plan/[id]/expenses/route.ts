import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify, getPlanAdminUserIds } from "@/lib/notify";
import { assertFinanceEnabled } from "@/lib/finance-guard";
type Params = { params: Promise<{ id: string }> };

const VALID_CATEGORIES = ["SALARY", "MARKETING", "TOOLS", "OPERATIONS", "EVENT", "EQUIPMENT", "OTHER"];

async function resolveAccess(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  const isOwner = account
    ? !!(await prisma.workItem.findFirst({ where: { id: planId, accountId: account.id } }))
    : false;

  if (isOwner) return { isOwner: true, role: "OWNER" as const, permissions: null, deptIds: [] as string[], memberId: null as string | null };

  const member = await prisma.workItemMember.findFirst({
    where: { workItemId: planId, userId },
    include: { departmentMembers: { select: { departmentId: true } } },
  });

  if (!member) return null;

  return {
    isOwner: false,
    role: member.role,
    permissions: member.permissions as any,
    deptIds: member.departmentMembers.map((d) => d.departmentId),
    memberId: member.id as string | null,
  };
}

function formatExpense(e: any) {
  return {
    ...e,
    amount: Number(e.amount),
    paidAmount: Number(e.paidAmount),
    phaseName: e.phase?.name ?? null,
    departmentName: e.department?.name ?? null,
    stallName: e.stall?.name ?? null,
    hardwareItemName: e.hardwareItem?.name ?? null,
    requestedByName: e.requestedBy?.user?.name ?? null,
    approvedByName: e.approvedBy?.user?.name ?? null,
    rejectedByName: e.rejectedBy?.user?.name ?? null,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
    rejectedAt: e.rejectedAt ? e.rejectedAt.toISOString() : null,
    occurredAt: e.occurredAt ? e.occurredAt.toISOString() : null,
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
  };
}

const EXPENSE_INCLUDE = {
  phase: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  stall: { select: { id: true, name: true } },
  hardwareItem: { select: { id: true, name: true } },
  requestedBy: { include: { user: { select: { name: true } } } },
  approvedBy: { include: { user: { select: { name: true } } } },
  rejectedBy: { include: { user: { select: { name: true } } } },
};

// GET /api/plan/[id]/expenses
// OWNER/ADMIN/CO_ADMIN → all expenses
// MANAGER/CO_MANAGER/MEMBER → their dept's expenses, plus anything they personally requested
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await resolveAccess(planId, user.sub);
    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isRestricted = !access.isOwner && !["ADMIN", "CO_ADMIN"].includes(access.role);

    const expenses = await prisma.expense.findMany({
      where: {
        workItemId: planId,
        ...(isRestricted
          ? {
              OR: [
                ...(access.deptIds.length > 0 ? [{ departmentId: { in: access.deptIds } }] : []),
                { requestedById: access.memberId ?? "__none__" },
              ],
            }
          : {}),
      },
      include: EXPENSE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: expenses.map(formatExpense) });
  } catch (err) {
    console.error("[GET /expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/plan/[id]/expenses
// Any member of the plan can submit an expense request — it always starts
// life as PENDING_APPROVAL regardless of who creates it.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { category, amount, description, phaseId, departmentId, stallId, hardwareItemId, occurredAt } = body;

    const validCategories = VALID_CATEGORIES;
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (phaseId) {
      const phase = await prisma.phase.findFirst({ where: { id: phaseId, workItemId: planId } });
      if (!phase) return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    }
    if (departmentId) {
      const dept = await prisma.department.findFirst({ where: { id: departmentId, workItemId: planId } });
      if (!dept) return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }
    if (stallId) {
      const stall = await prisma.stall.findFirst({ where: { id: stallId, workItemId: planId } });
      if (!stall) return NextResponse.json({ error: "Invalid stall" }, { status: 400 });
    }
    if (hardwareItemId) {
      const hw = await prisma.hardwareItem.findFirst({ where: { id: hardwareItemId, workItemId: planId } });
      if (!hw) return NextResponse.json({ error: "Invalid hardware item" }, { status: 400 });
      if (hw.requestStatus !== "APPROVED") {
        return NextResponse.json({ error: "Can only log costs against approved hardware items" }, { status: 400 });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        workItemId: planId,
        category,
        amount: Number(amount),
        description: description?.trim() || null,
        phaseId: phaseId || null,
        departmentId: departmentId || null,
        stallId: stallId || null,
        hardwareItemId: hardwareItemId || null,
        requestedById: access.memberId,
        status: "PENDING_APPROVAL",
        paymentStatus: "PENDING",
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
      include: EXPENSE_INCLUDE,
    });

    const approverUserIds = await getPlanAdminUserIds(planId);
    await notify({
      workItemId: planId,
      userIds: approverUserIds,
      scope: "GENERAL",
      type: "EXPENSE_REQUESTED",
      title: "New expense request",
      message: `A ₹${Number(amount).toLocaleString("en-IN")} expense request is awaiting your approval.`,
      entityType: "expense",
      entityId: expense.id,
    });

    return NextResponse.json({ success: true, data: formatExpense(expense) }, { status: 201 });
  } catch (err) {
    console.error("[POST /expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}