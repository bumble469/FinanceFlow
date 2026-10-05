import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { deriveIncomeStatus } from "@/lib/financial-status";
import { notify, getPlanAdminUserIds } from "@/lib/notify";
import { assertFinanceEnabled } from "@/lib/finance-guard";

type Params = { params: Promise<{ id: string }> };

const VALID_INCOME_TYPES = [
  "REVENUE",
  "INVESTMENT",
  "SPONSORSHIP",
  "DONATION",
  "GRANT",
  "MERCHANDISE",
  "REFUND",
  "CLIENT_PAYMENT",
  "STALL_INCOME",
  "OTHER",
];

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

function canMutateIncome(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>, action: "create" | "edit" | "delete"): boolean {
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
    stallName: i.stall?.name ?? null,
    createdByName: i.createdBy?.user?.name ?? null,
    receivedAt: i.receivedAt ? i.receivedAt.toISOString() : null,
  };
}

// GET /api/plan/[id]/income — all members can view income
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    
    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const income = await prisma.income.findMany({
      where: { workItemId: planId },
      include: {
        phase: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        stall: { select: { id: true, name: true } },
        createdBy: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: income.map(formatIncome) });
  } catch (err) {
    console.error("[GET /income]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/plan/[id]/income — create income entry
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    
    const blocked = await assertFinanceEnabled(planId);
    if (blocked) return blocked;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canMutateIncome(access, "create")) {
      return NextResponse.json({ error: "You don't have permission to add income" }, { status: 403 });
    }

    const body = await req.json();
    const { type, amount, source, description, phaseId, departmentId, stallId, receivedAt, receivedAmount, cancelled } = body;

    if (!type || !VALID_INCOME_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid income type" }, { status: 400 });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!source?.trim()) {
      return NextResponse.json({ error: "Source is required" }, { status: 400 });
    }

    const numAmount = Number(amount);
    const numReceived = receivedAmount !== undefined ? Math.max(0, Number(receivedAmount)) : 0;
    if (isNaN(numReceived)) {
      return NextResponse.json({ error: "Invalid received amount" }, { status: 400 });
    }
    if (numReceived > numAmount) {
      return NextResponse.json({ error: "Received amount cannot exceed the expected amount" }, { status: 400 });
    }

    // validate phaseId / departmentId belong to this plan
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

    const derived = cancelled
      ? { status: "CANCELLED" as const, paymentStatus: "PENDING" as const }
      : deriveIncomeStatus(numAmount, numReceived);

    const income = await prisma.income.create({
      data: {
        workItemId: planId,
        type,
        amount: numAmount,
        receivedAmount: numReceived,
        status: derived.status,
        paymentStatus: derived.paymentStatus,
        source: source.trim(),
        description: description?.trim() || null,
        phaseId: phaseId || null,
        departmentId: departmentId || null,
        stallId: stallId || null,
        createdById: access.memberId,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      },
      include: {
        phase: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        stall: { select: { id: true, name: true } },
        createdBy: { include: { user: { select: { name: true } } } },
      },
    });

    const adminUserIds = await getPlanAdminUserIds(planId);
    await notify({
      workItemId: planId,
      userIds: adminUserIds,
      scope: "GENERAL",
      type: "INCOME_ADDED",
      title: "New income recorded",
      message: `${source.trim()} — ${type.toLowerCase()} income of ₹${numAmount.toLocaleString("en-IN")} was added.`,
      entityType: "income",
      entityId: income.id,
    });

    return NextResponse.json({ success: true, data: formatIncome(income) }, { status: 201 });
  } catch (err) {
    console.error("[POST /income]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}