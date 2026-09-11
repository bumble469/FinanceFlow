import { NextRequest, NextResponse } from 'next/server';
import { WorkItemStatus, WorkItemType, MemberRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// ─── SHARED INCLUDE ────────────────────────────────────────────────────────

const planInclude = {
  project: true,
  event: true,
  planInfo: true,
  departments: true,
  tasks: {
    include: {
      members: {
        include: {
          workItemMember: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      },
    },
  },
  milestones: {
    include: {
      tasks: {
        include: {
          task: true,
        },
      },
      creator: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  phases: true,
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      departmentMembers: {
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  income: true,
  expenses: true,
};

// ─── FORMAT PLAN ───────────────────────────────────────────────────────────

function formatPlan(plan: any) {
  return {
    ...plan,
    milestones: plan.milestones.map((m: any) => ({
      ...m,
      tasks: m.tasks.map((mt: any) => ({
        id: mt.task.id,
        title: mt.task.title,
        status: mt.task.status,
      })),
    })),
  };
}

// ─── ACCESS RESOLVER ───────────────────────────────────────────────────────

type AccessResult =
  | { plan: any; isOwner: true; role: "OWNER"; departmentIds: null; permissions: null; memberId: null }
  | { plan: any; isOwner: false; role: MemberRole; departmentIds: string[]; permissions: unknown; memberId: string }
  | null;

async function getPlanWithAccess(planId: string, userId: string): Promise<AccessResult> {
  // Path 1: owner check
  const account = await prisma.account.findUnique({ where: { userId } });
  if (account) {
    const plan = await prisma.workItem.findFirst({
      where: { id: planId, accountId: account.id },
      include: planInclude,
    });
    if (plan) {
      return { plan: formatPlan(plan), isOwner: true, role: "OWNER", departmentIds: null, permissions: null, memberId: null };
    }
  }

  // Path 2: collaborator check
  const membership = await prisma.workItemMember.findFirst({
    where: { workItemId: planId, userId },
    include: {
      departmentMembers: {
        select: { departmentId: true },
      },
      workItem: {
        include: planInclude,
      },
    },
  });

  if (!membership) return null;

  const departmentIds = membership.departmentMembers.map((d) => d.departmentId);

  return {
    plan: formatPlan(membership.workItem),
    isOwner: false,
    role: membership.role,
    departmentIds,
    permissions: (membership.permissions as Record<string, unknown> | null) ?? null,
    memberId: membership.id,
  };
}

// ─── GET /api/plan/[id] ────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const result = await getPlanWithAccess(planId, user.sub);
    if (!result) return NextResponse.json({ success: false, error: 'Plan not found or access denied' }, { status: 404 });

    const { plan, isOwner, role, departmentIds, permissions, memberId } = result;

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        isOwner,
        role,
        departmentIds,
        permissions,
        memberId,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[Plan GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/plan/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    if (!planId) return NextResponse.json({ success: false, error: 'Missing plan ID' }, { status: 400 });

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // PATCH is owner-only
    const account = await prisma.account.findUnique({ where: { userId: user.sub } });
    if (!account) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const existing = await prisma.workItem.findFirst({
      where: { id: planId, accountId: account.id },
      include: { project: true, event: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });

    const body = await request.json();
    const { name, status, budget, description, currency, startDate, endDate, methodology, eventDate, venue, hasTicketing, hasStalls, hasHardware, allowMultipleEditing } = body;

    if (status && !Object.values(WorkItemStatus).includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: planId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(status ? { status } : {}),
          ...(budget !== undefined ? { budget } : {}),
          ...(description !== undefined ? { description: description?.trim() || null } : {}),
          ...(currency ? { currency } : {}),
          ...(hasHardware !== undefined ? { hasHardware: !!hasHardware } : {}),
          ...(allowMultipleEditing !== undefined ? { allowMultipleEditing: !!allowMultipleEditing } : {}),
        },
      });

      if (existing.type === WorkItemType.PROJECT) {
        await tx.project.update({
          where: { workItemId: planId },
          data: {
            ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
            ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
            ...(methodology !== undefined ? { methodology: methodology?.trim() || null } : {}),
          },
        });
      } else if (existing.type === WorkItemType.EVENT) {
        await tx.event.update({
          where: { workItemId: planId },
          data: {
            ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate) : null } : {}),
            ...(venue !== undefined ? { venue: venue?.trim() || null } : {}),
            ...(hasTicketing !== undefined ? { hasTicketing: !!hasTicketing } : {}),
            ...(hasStalls !== undefined ? { hasStalls: !!hasStalls } : {}),
          },
        });
      }

      return tx.workItem.findUnique({
        where: { id: planId },
        include: { project: true, event: true, planInfo: true, departments: true, phases: true },
      });
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    console.error('[Plan PATCH/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/plan/[id] ─────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // DELETE is owner-only
    const account = await prisma.account.findUnique({ where: { userId: user.sub } });
    if (!account) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const existing = await prisma.workItem.findFirst({
      where: { id: planId, accountId: account.id },
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });

    await prisma.workItem.delete({ where: { id: planId } });

    return NextResponse.json({ success: true, message: 'Plan deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[Plan DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}