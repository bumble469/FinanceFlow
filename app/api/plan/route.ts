import { NextRequest, NextResponse } from 'next/server';
import { WorkItemType, MemberRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = user.email;

    const memberships = await prisma.workItemMember.findMany({
      where: {
        userId: user.sub,
      },
      include: {
        workItem: {
          include: {
            project: true,
            event: true,
            planInfo: true,
            departments: true,
            phases: true,
            expenses: true,
            income: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    const castWorkItem = (workItem: any) => ({
      ...workItem,
      budget: workItem.budget !== null ? Number(workItem.budget) : null,
      expenses: (workItem.expenses ?? []).map((e: any) => ({
        ...e,
        amount: Number(e.amount),
        paidAmount: Number(e.paidAmount),
      })),
      income: (workItem.income ?? []).map((i: any) => ({
        ...i,
        amount: i.amount !== null ? Number(i.amount) : null,
        receivedAmount: Number(i.receivedAmount),
      })),
    });

    const myPlans = memberships
      .filter((membership) => membership.role === "ADMIN")
      .map((membership) => castWorkItem(membership.workItem));

    const collaborations = memberships
      .filter((membership) => membership.role !== "ADMIN")
      .map((membership) => castWorkItem(membership.workItem));

    const invitations = await prisma.workItemMemberInvitation.findMany({
      where: {
        email: userEmail,
        status: "PENDING",
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workItem: {
          include: {
            project: true,
            event: true,
            planInfo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          myPlans,
          collaborations,
          invitations,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Plan GET] Error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/plan — create a new plan
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const account = await prisma.account.findUnique({ where: { userId: user.sub } });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // subscription check
    const subscription = await prisma.subscription.findUnique({
      where: { accountId: account.id },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "No active subscription found. Please select a plan first." },
        { status: 403 }
      );
    }

    const { plan: subPlan } = subscription;

    const [projectCount, eventCount, totalCount] = await Promise.all([
      prisma.workItem.count({ where: { accountId: account.id, type: "PROJECT" } }),
      prisma.workItem.count({ where: { accountId: account.id, type: "EVENT" } }),
      prisma.workItem.count({ where: { accountId: account.id } }),
    ]);

    const body = await request.json();
    const {
      name, type, budget, description, status, currency,
      startDate, endDate, methodology,
      eventDate, venue, hasTicketing, hasStalls, hasHardware
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    if (!type || !Object.values(WorkItemType).includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be PROJECT, EVENT or PLAN' },
        { status: 400 }
      );
    }

    if (subPlan.maxTotalWorkItems !== null && totalCount >= subPlan.maxTotalWorkItems) {
      return NextResponse.json(
        { success: false, error: `Your ${subPlan.name} plan allows a maximum of ${subPlan.maxTotalWorkItems} total work items. Upgrade to add more.` },
        { status: 403 }
      );
    }

    if (type === WorkItemType.PROJECT && projectCount >= subPlan.maxProjects) {
      return NextResponse.json(
        { success: false, error: `Your ${subPlan.name} plan allows a maximum of ${subPlan.maxProjects} project(s). Upgrade to add more.` },
        { status: 403 }
      );
    }

    if (type === WorkItemType.EVENT && eventCount >= subPlan.maxEvents) {
      return NextResponse.json(
        { success: false, error: `Your ${subPlan.name} plan allows a maximum of ${subPlan.maxEvents} event(s). Upgrade to add more.` },
        { status: 403 }
      );
    }

    if (!budget || isNaN(budget) || budget <= 0) {
      return NextResponse.json({ success: false, error: 'Budget must be a positive number' }, { status: 400 });
    }

    const plan = await prisma.$transaction(async (tx) => {
      const workItem = await tx.workItem.create({
        data: {
          name: name.trim(),
          type,
          budget,
          description,
          status: status || "ACTIVE",
          currency,
          accountId: account.id,
          hasHardware: !!hasHardware,
        },
      });

      // creator is always ADMIN
      await tx.workItemMember.create({
        data: {
          workItemId: workItem.id,
          userId: user.sub,
          role: MemberRole.ADMIN,
        },
      });

      // type-specific record
      if (type === WorkItemType.PROJECT) {
        await tx.project.create({
          data: {
            workItemId: workItem.id,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            methodology: methodology?.trim() || null,
          },
        });
      } else if (type === WorkItemType.EVENT) {
        await tx.event.create({
          data: {
            workItemId: workItem.id,
            eventDate: eventDate ? new Date(eventDate) : null,
            venue: venue?.trim() || null,
            hasTicketing: !!hasTicketing,
            hasStalls: !!hasStalls
          },
        });
      } else {
        return NextResponse.json({ success: false, error: 'Invalid plan type' }, { status: 400 });
      }

      return tx.workItem.findUnique({
        where: { id: workItem.id },
        include: {
          project: true,
          event: true,
          planInfo: true,
          departments: true,
          phases: true,
          members: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('[Plan POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}