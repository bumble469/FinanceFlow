import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { notify, getPlanAdminUserIds, getDepartmentMemberUserIds } from "@/lib/notify";

type Params = { params: Promise<{ id: string }> };

const HARDWARE_INCLUDE = {
  department: { select: { id: true, name: true } },
  stall: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, user: { select: { id: true, name: true } } } },
  reviewedBy: { select: { id: true, user: { select: { id: true, name: true } } } },
} as const;

function formatHardware(h: any) {
  return {
    ...h,
    monthlyRentAmount: h.monthlyRentAmount !== null ? Number(h.monthlyRentAmount) : null,
    depositAmount: h.depositAmount !== null ? Number(h.depositAmount) : null,
  };
}

/**
 * Catches up on any missed monthly rent billing cycles for approved, rented items.
 * Runs lazily whenever the hardware list is fetched — no separate cron/queue needed.
 * Capped at 24 cycles per item per call as a runaway-loop safety net.
 */
async function catchUpRentBilling(planId: string) {
  const now = new Date();

  const dueItems = await prisma.hardwareItem.findMany({
    where: {
      workItemId: planId,
      requestStatus: "APPROVED",
      source: "RENTED",
      monthlyRentAmount: { not: null },
      rentalStart: { not: null },
    },
  });

  for (const item of dueItems) {
    const start = item.lastBilledAt ?? item.rentalStart!;
    let cycles = Math.floor((now.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000));
    if (cycles <= 0) continue;
    cycles = Math.min(cycles, 24);

    await prisma.$transaction(async (tx) => {
      // re-check inside the transaction to avoid double-billing on concurrent calls
      const fresh = await tx.hardwareItem.findUnique({ where: { id: item.id } });
      if (!fresh || fresh.lastBilledAt?.getTime() !== item.lastBilledAt?.getTime()) return;

      let cursor = new Date(start);
      for (let i = 0; i < cycles; i++) {
        cursor = new Date(cursor.getTime() + 30 * 24 * 60 * 60 * 1000);
        await tx.expense.create({
          data: {
            workItemId: planId,
            category: "EQUIPMENT",
            amount: item.monthlyRentAmount!,
            description: `Monthly rental — ${item.name}${item.vendor ? ` (${item.vendor})` : ""}`,
            departmentId: item.departmentId,
            stallId: item.stallId,
            hardwareItemId: item.id,
            requestedById: item.requestedById,
            status: "APPROVED", // auto-generated, not a pending human request
            paymentStatus: "PENDING",
            occurredAt: cursor,
          },
        });
      }

      await tx.hardwareItem.update({ where: { id: item.id }, data: { lastBilledAt: cursor } });
    });
  }
}

// GET /api/plan/[id]/hardware
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await getPlanAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // visible to every plan member regardless of role — only mutation is scoped
    await catchUpRentBilling(planId).catch((err) => console.error("[rent billing catch-up]", err));

    const items = await prisma.hardwareItem.findMany({
      where: { workItemId: planId },
      include: HARDWARE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: items.map(formatHardware) });
  } catch (err) {
    console.error("[GET /hardware]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/plan/[id]/hardware — create a request (any member)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await getPlanAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const isOwnerDirectAdd = access.isOwner || access.role === "ADMIN";
    if (!isOwnerDirectAdd && !access.permissions.canRequestHardware) {
      return NextResponse.json({ error: "You don't have permission to request hardware" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, category, source, quantity, vendor, notes,
      departmentId, stallId,
      rentalStart, rentalEnd, monthlyRentAmount, depositAmount,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!["AV", "FURNITURE", "ELECTRICAL", "STRUCTURAL", "IT", "OTHER"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!["OWNED", "RENTED", "BORROWED"].includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (source === "RENTED" && (monthlyRentAmount === undefined || monthlyRentAmount === null)) {
      return NextResponse.json({ error: "Monthly rent amount is required for rented items" }, { status: 400 });
    }

    if (departmentId) {
      const dept = await prisma.department.findFirst({ where: { id: departmentId, workItemId: planId } });
      if (!dept) return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }
    if (stallId) {
      const stall = await prisma.stall.findFirst({ where: { id: stallId, workItemId: planId } });
      if (!stall) return NextResponse.json({ error: "Invalid stall" }, { status: 400 });
    }

    const item = await prisma.hardwareItem.create({
      data: {
        workItemId: planId,
        name: name.trim(),
        category,
        source,
        quantity: quantity ? Number(quantity) : 1,
        vendor: vendor?.trim() || null,
        notes: notes?.trim() || null,
        departmentId: departmentId || null,
        stallId: stallId || null,
        // Owners add hardware directly, pre-approved — no request/review workflow needed
        // since they're already the highest authority on the plan.
        requestStatus: isOwnerDirectAdd ? "APPROVED" : "PENDING",
        requestedById: access.memberId ?? null,
        reviewedAt: isOwnerDirectAdd ? new Date() : null,
        rentalStart: rentalStart ? new Date(rentalStart) : null,
        rentalEnd: rentalEnd ? new Date(rentalEnd) : null,
        monthlyRentAmount: source === "RENTED" ? Number(monthlyRentAmount) : null,
        depositAmount: depositAmount !== undefined && depositAmount !== null ? Number(depositAmount) : null,
      },
      include: HARDWARE_INCLUDE,
    });

        const recipientIds = new Set<string>(await getPlanAdminUserIds(planId));
    if (item.departmentId) {
      (await getDepartmentMemberUserIds([item.departmentId], user.sub)).forEach((id) => recipientIds.add(id));
    }
    recipientIds.delete(user.sub); // don't notify yourself for your own request

    if (!isOwnerDirectAdd && recipientIds.size > 0) {
      await notify({
        workItemId: planId,
        userIds: Array.from(recipientIds),
        scope: "GENERAL",
        type: "HARDWARE_REQUESTED",
        title: "New hardware request",
        message: `${item.quantity}x "${item.name}" was requested${item.department ? ` for ${item.department.name}` : ""}.`,
        entityType: "hardware",
        entityId: item.id,
      });
    }

    return NextResponse.json({ success: true, data: formatHardware(item) }, { status: 201 });
  } catch (err) {
    console.error("[POST /hardware]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}