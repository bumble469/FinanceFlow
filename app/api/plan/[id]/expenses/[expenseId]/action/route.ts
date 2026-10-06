import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { deriveExpensePaymentStatus } from "@/lib/financial-status";
import { notify } from "@/lib/notify";
import { assertFinanceEnabled } from "@/lib/finance-guard";

type Params = { params: Promise<{ id: string; expenseId: string }> };

async function resolveAccess(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  const isOwner = account
    ? !!(await prisma.workItem.findFirst({ where: { id: planId, accountId: account.id } }))
    : false;

  if (isOwner) return { isOwner: true, role: "OWNER" as const, permissions: null, memberId: null as string | null };

  const member = await prisma.workItemMember.findFirst({ where: { workItemId: planId, userId } });
  if (!member) return null;

  return {
    isOwner: false,
    role: member.role,
    permissions: member.permissions as any,
    memberId: member.id as string | null,
  };
}

function canApprove(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "CO_ADMIN") return !!access.permissions?.expenses?.approve;
  return false;
}

const EXPENSE_INCLUDE = {
  phase: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
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
    requestedByName: e.requestedBy?.user?.name ?? null,
    approvedByName: e.approvedBy?.user?.name ?? null,
    rejectedByName: e.rejectedBy?.user?.name ?? null,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
    rejectedAt: e.rejectedAt ? e.rejectedAt.toISOString() : null,
    occurredAt: e.occurredAt ? e.occurredAt.toISOString() : null,
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
  };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, expenseId } = await params;
    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canApprove(access)) {
      return NextResponse.json({ error: "You don't have permission to approve expenses" }, { status: 403 });
    }

    const existing = await prisma.expense.findFirst({ where: { id: expenseId, workItemId: planId } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const body = await req.json();
    const { action, rejectionReason, paidAmount } = body;

    if (!["approve", "reject", "pay"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let updated;

    if (action === "approve") {
      if (existing.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "Only pending requests can be approved" }, { status: 400 });
      }
      updated = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: "APPROVED",
          approvedById: access.memberId,
          approvedAt: new Date(),
        },
        include: EXPENSE_INCLUDE,
      });
    } else if (action === "reject") {
      if (existing.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "Only pending requests can be rejected" }, { status: 400 });
      }
      if (!rejectionReason?.trim()) {
        return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
      }
      updated = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          status: "REJECTED",
          rejectedById: access.memberId,
          rejectedAt: new Date(),
          rejectionReason: rejectionReason.trim(),
        },
        include: EXPENSE_INCLUDE,
      });
    } else {
      // pay
      if (!["APPROVED", "PARTIALLY_PAID"].includes(existing.status)) {
        return NextResponse.json({ error: "Only approved requests can be marked as paid" }, { status: 400 });
      }
      const payAmount = Number(paidAmount);
      if (!payAmount || isNaN(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
      }
      const newPaidAmount = Number(existing.paidAmount) + payAmount;
      if (newPaidAmount > Number(existing.amount)) {
        return NextResponse.json({ error: "Payment amount exceeds the remaining balance" }, { status: 400 });
      }
      const derived = deriveExpensePaymentStatus(Number(existing.amount), newPaidAmount);
      updated = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          paidAmount: newPaidAmount,
          status: derived.status,
          paymentStatus: derived.paymentStatus,
        },
        include: EXPENSE_INCLUDE,
      });
    }

    if ((action === "approve" || action === "reject") && updated.requestedBy) {
      const requesterUserId = (await prisma.workItemMember.findUnique({
        where: { id: updated.requestedById! },
        select: { userId: true },
      }))?.userId;

      if (requesterUserId) {
        await notify({
          workItemId: planId,
          userIds: [requesterUserId],
          scope: "PERSONAL",
          type: action === "approve" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
          title: action === "approve" ? "Expense approved" : "Expense rejected",
          message:
            action === "approve"
              ? `Your ₹${Number(updated.amount).toLocaleString("en-IN")} expense request was approved.`
              : `Your expense request was rejected: ${updated.rejectionReason}`,
          entityType: "expense",
          entityId: expenseId,
        });
      }
    }

    return NextResponse.json({ success: true, data: formatExpense(updated) });
  } catch (err) {
    console.error("[PATCH /expenses/:id/action]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}