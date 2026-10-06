import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { canModifyOwnExpenseRequest } from "@/lib/permissions";
import { assertFinanceEnabled } from "@/lib/finance-guard";

type Params = { params: Promise<{ id: string; expenseId: string }> };

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

function canMutateExpense(
  access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>,
  action: "edit" | "delete",
  expense: { departmentId: string | null; requestedById: string | null; status: string }
): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "CO_ADMIN") return !!access.permissions?.expenses?.[action];

  if ((access.role === "MANAGER" || access.role === "CO_MANAGER") && access.permissions?.expenses === "MANAGE") {
    if (expense.departmentId && access.deptIds.includes(expense.departmentId)) return true;
  }

  // the requester can still edit/withdraw their own request while it's pending
  if (
    access.memberId &&
    expense.requestedById === access.memberId &&
    canModifyOwnExpenseRequest(expense.status)
  ) {
    return true;
  }

  return false;
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

// PATCH /api/plan/[id]/expenses/[expenseId] — edit the request's own fields
// (category/amount/description/phase/department/date). NOT for
// approve/reject/pay — that's handled by the /action sub-route.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, expenseId } = await params;

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.expense.findFirst({ where: { id: expenseId, workItemId: planId } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    if (!canMutateExpense(access, "edit", existing)) {
      return NextResponse.json({ error: "You don't have permission to edit this expense" }, { status: 403 });
    }

    const body = await req.json();
    const { category, amount, description, phaseId, departmentId, stallId, hardwareItemId, occurredAt } = body;

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

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(category ? { category } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(phaseId !== undefined ? { phaseId: phaseId || null } : {}),
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
        ...(stallId !== undefined ? { stallId: stallId || null } : {}),
        ...(hardwareItemId !== undefined ? { hardwareItemId: hardwareItemId || null } : {}),
        ...(occurredAt !== undefined ? { occurredAt: new Date(occurredAt) } : {}),
      },
      include: EXPENSE_INCLUDE,
    });

    return NextResponse.json({ success: true, data: formatExpense(updated) });
  } catch (err) {
    console.error("[PATCH /expenses/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/plan/[id]/expenses/[expenseId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, expenseId } = await params;

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.expense.findFirst({ where: { id: expenseId, workItemId: planId } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    if (!canMutateExpense(access, "delete", existing)) {
      return NextResponse.json({ error: "You don't have permission to delete this expense" }, { status: 403 });
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /expenses/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}