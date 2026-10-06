import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { deriveIncomeStatus } from "@/lib/financial-status";
import { assertFinanceEnabled } from "@/lib/finance-guard";

type Params = { params: Promise<{ id: string; incomeId: string }> };

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

function canMutateIncome(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>, action: "edit" | "delete"): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "MEMBER") return false;
  if (access.role === "CO_ADMIN") return !!access.permissions?.revenue?.[action];
  if (access.role === "MANAGER") return access.permissions?.revenue === "MANAGE";
  if (access.role === "CO_MANAGER") return access.permissions?.revenue === "MANAGE";
  return false;
}

function formatIncome(i: any) {
  return {
    ...i,
    amount: Number(i.amount),
    receivedAmount: Number(i.receivedAmount),
    phaseName: i.phase?.name ?? null,
    departmentName: i.department?.name ?? null,
    createdByName: i.createdBy?.user?.name ?? null,
    receivedAt: i.receivedAt ? i.receivedAt.toISOString() : null,
  };
}

// PATCH /api/plan/[id]/income/[incomeId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, incomeId } = await params;

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canMutateIncome(access, "edit")) {
      return NextResponse.json({ error: "You don't have permission to edit income" }, { status: 403 });
    }

    const existing = await prisma.income.findFirst({ where: { id: incomeId, workItemId: planId } });
    if (!existing) return NextResponse.json({ error: "Income entry not found" }, { status: 404 });

    const body = await req.json();
    const { type, amount, source, description, phaseId, departmentId, receivedAt, receivedAmount, cancelled } = body;

    if (phaseId) {
      const phase = await prisma.phase.findFirst({ where: { id: phaseId, workItemId: planId } });
      if (!phase) return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    }
    if (departmentId) {
      const dept = await prisma.department.findFirst({ where: { id: departmentId, workItemId: planId } });
      if (!dept) return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    const numAmount = amount !== undefined ? Number(amount) : Number(existing.amount);
    const numReceived = receivedAmount !== undefined ? Number(receivedAmount) : Number(existing.receivedAmount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (isNaN(numReceived) || numReceived < 0) {
      return NextResponse.json({ error: "Invalid received amount" }, { status: 400 });
    }
    if (numReceived > numAmount) {
      return NextResponse.json({ error: "Received amount cannot exceed the expected amount" }, { status: 400 });
    }

    const derived = cancelled
      ? { status: "CANCELLED" as const, paymentStatus: existing.paymentStatus }
      : deriveIncomeStatus(numAmount, numReceived);

    const updated = await prisma.income.update({
      where: { id: incomeId },
      data: {
        ...(type ? { type } : {}),
        amount: numAmount,
        receivedAmount: numReceived,
        status: derived.status,
        paymentStatus: derived.paymentStatus,
        ...(source !== undefined ? { source: source.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(phaseId !== undefined ? { phaseId: phaseId || null } : {}),
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
        ...(receivedAt !== undefined ? { receivedAt: new Date(receivedAt) } : {}),
      },
      include: {
        phase: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        createdBy: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json({ success: true, data: formatIncome(updated) });
  } catch (err) {
    console.error("[PATCH /income/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/plan/[id]/income/[incomeId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, incomeId } = await params;

    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canMutateIncome(access, "delete")) {
      return NextResponse.json({ error: "You don't have permission to delete income" }, { status: 403 });
    }

    const existing = await prisma.income.findFirst({ where: { id: incomeId, workItemId: planId } });
    if (!existing) return NextResponse.json({ error: "Income entry not found" }, { status: 404 });

    await prisma.income.delete({ where: { id: incomeId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /income/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}