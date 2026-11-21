import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function resolveAccess(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  const isOwner = account
    ? !!(await prisma.workItem.findFirst({ where: { id: planId, accountId: account.id } }))
    : false;

  if (isOwner) {
    // the owner also has an ADMIN member row (created with the plan) — that's the id tasks are assigned to
    const ownerMember = await prisma.workItemMember.findFirst({
      where: { workItemId: planId, userId },
      select: { id: true },
    });
    return { isOwner: true, role: "OWNER" as const, memberId: (ownerMember?.id ?? null) as string | null };
  }

  const member = await prisma.workItemMember.findFirst({ where: { workItemId: planId, userId } });
  if (!member) return null;

  return { isOwner: false, role: member.role, memberId: member.id as string | null };
}

const TASK_INCLUDE = {
  members: {
    include: {
      workItemMember: { include: { user: { select: { id: true, name: true, image: true } } } },
    },
  },
  phase: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  reactions: {
    include: { author: { include: { user: { select: { name: true } } } } },
  },
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { include: { user: { select: { name: true } } } } },
  },
  milestones: {
    include: { milestone: { select: { id: true, title: true, dueDate: true, status: true } } },
  },
  requirement: {
    select: {
      requireApproval: true,
      requireDescription: true,
      requireImages: true,
      minImages: true,
      maxImages: true,
      requireVideo: true,
      requireDocument: true,
      allowMultipleEvidenceTypes: true,
    },
  },
};

function formatTask(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    requirement: t.requirement ?? null,
    departmentId: t.departmentId,
    departmentName: t.department?.name ?? null,
    phaseId: t.phaseId,
    phaseName: t.phase?.name ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    assignees: t.members.map((m: any) => ({
      workItemMemberId: m.workItemMember.id,
      name: m.workItemMember.user.name,
      image: m.workItemMember.user.image,
    })),
    reactions: t.reactions.map((r: any) => ({
      id: r.id,
      emoji: r.emoji,
      authorName: r.author.user.name,
      authorId: r.authorId,
    })),
    notes: t.notes.map((n: any) => ({
      id: n.id,
      body: n.body,
      authorName: n.author.user.name,
      createdAt: n.createdAt.toISOString(),
    })),
    milestones: t.milestones?.map((m: any) => ({
      id: m.milestone.id,
      title: m.milestone.title,
      status: m.milestone.status,
      dueDate: m.milestone.dueDate ? m.milestone.dueDate.toISOString() : null,
    })) || [],
  };
}

// GET /api/plan/[id]/my-work
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isAdminLevel = access.isOwner || access.role === "ADMIN" || access.role === "CO_ADMIN";

    // Which departments can this person see cards for?
    let departmentIds: string[] | null = null; // null = all
    if (!isAdminLevel) {
      const deptMemberships = await prisma.departmentMember.findMany({
        where: { workItemMemberId: access.memberId ?? "__none__" },
        select: { departmentId: true },
      });
      departmentIds = deptMemberships.map((d) => d.departmentId);
    }

    const departments = await prisma.department.findMany({
      where: {
        workItemId: planId,
        ...(departmentIds ? { id: { in: departmentIds } } : {}),
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        tasks: {
          select: { id: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const deptCards = departments.map((d) => ({
      id: d.id,
      name: d.name,
      memberCount: d.members.length,
      taskStats: {
        total: d.tasks.length,
        pending: d.tasks.filter((t) => t.status === "TODO").length,
        ongoing: d.tasks.filter((t) => t.status === "IN_PROGRESS").length,
        completed: d.tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length,
      },
    }));

    // Optional drill-down into one department's tasks
    const departmentId = req.nextUrl.searchParams.get("departmentId");
    let tasks: any[] = [];

    // Cross-department "my tasks": everything assigned to the caller
    const mine = req.nextUrl.searchParams.get("mine") === "1";
    if (mine && access.memberId) {
      const myTasks = await prisma.task.findMany({
        where: {
          workItemId: planId,
          members: { some: { workItemMemberId: access.memberId } },
        },
        include: TASK_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      tasks = myTasks.map(formatTask);
    }

    if (departmentId) {
      // Make sure the caller is allowed to see this department at all
      if (departmentIds && !departmentIds.includes(departmentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const isMemberRole = access.role === "MEMBER";

      const rawTasks = await prisma.task.findMany({
        where: {
          workItemId: planId,
          departmentId,
          ...(isMemberRole
            ? { members: { some: { workItemMemberId: access.memberId ?? "__none__" } } }
            : {}),
        },
        include: TASK_INCLUDE,
        orderBy: { createdAt: "desc" },
      });

      tasks = rawTasks.map(formatTask);
    }

    const planRow = await prisma.workItem.findUnique({
      where: { id: planId },
      select: { allowAdminTakeUpTasks: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        role: access.isOwner ? "OWNER" : access.role,
        memberId: access.memberId,
        takeUpEnabled: planRow?.allowAdminTakeUpTasks === true,
        departments: deptCards,
        tasks,
      },
    });
  } catch (err) {
    console.error("[GET /my-work]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}