import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify, getDepartmentMemberUserIds } from "@/lib/notify";
import { getPlanAccess } from "@/lib/get-plan-access";

async function resolvePhase(workItemId: string, deptId: string, phaseId: string) {
  return prisma.phase.findFirst({
    where: { id: phaseId, workItemId, departmentId: deptId },
  });
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  phaseId: true,
  departmentId: true,
  startDate: true,
  dueDate: true,
  originalDueDate: true,
  extensionReason: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
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
  members: {
    select: {
      workItemMember: {
        select: { id: true, user: { select: { id: true, name: true, image: true } } },
      },
    },
  },
  dependsOn: {
    select: { dependsOnId: true },
  },
  milestones: {
    select: {
      milestone: { select: { id: true, title: true, status: true, dueDate: true } },
    },
  },
} as const;

function flattenMilestones(task: any) {
  return { ...task, milestones: task.milestones.map((mt: any) => mt.milestone) };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; deptId: string; phaseId: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workItemId, deptId, phaseId } = await params;

    const membership = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId, userId: user.sub } },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const phase = await resolvePhase(workItemId, deptId, phaseId);
    if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });

    const tasks = await prisma.task.findMany({
      where: { workItemId, departmentId: deptId, phaseId },
      orderBy: { createdAt: "asc" },
      select: TASK_SELECT,
    });

    return NextResponse.json(tasks.map(flattenMilestones));
  } catch (err) {
    console.error("[GET /phases/:phaseId/tasks]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; deptId: string; phaseId: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workItemId, deptId, phaseId } = await params;

    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.permissions.canAddTask(deptId)) {
      return NextResponse.json({ error: "You don't have permission to add tasks in this department" }, { status: 403 });
    }

    const phase = await resolvePhase(workItemId, deptId, phaseId);
    if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });

    const body = await req.json();
    const {
      title,
      description,
      priority,
      startDate,
      dueDate,
      memberIds = [],
      dependsOnIds = [],
      requirement,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!dueDate || isNaN(new Date(dueDate).getTime())) {
      return NextResponse.json({ error: "Due date and time is required" }, { status: 400 });
    }

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const validMembers = await prisma.workItemMember.count({
        where: { id: { in: memberIds }, workItemId },
      });
      if (validMembers !== memberIds.length) {
        return NextResponse.json({ error: "Invalid member(s) provided" }, { status: 400 });
      }
    }

    if (Array.isArray(dependsOnIds) && dependsOnIds.length > 0) {
      const validDeps = await prisma.task.count({
        where: { id: { in: dependsOnIds }, workItemId },
      });
      if (validDeps !== dependsOnIds.length) {
        return NextResponse.json({ error: "Invalid dependency task(s) provided" }, { status: 400 });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        status: "TODO",
        workItemId,
        departmentId: deptId,
        phaseId,
        priority: priority !== undefined ? Number(priority) : 0,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        ...(memberIds.length > 0 && {
          members: { create: memberIds.map((workItemMemberId: string) => ({ workItemMemberId })) },
        }),
        ...(dependsOnIds.length > 0 && {
          dependsOn: { create: dependsOnIds.map((dependsOnId: string) => ({ dependsOnId })) },
        }),
        ...(requirement && {
          requirement: {
            create: {
              requireApproval: requirement.requireApproval ?? true,
              requireDescription: requirement.requireDescription ?? false,
              requireImages: requirement.requireImages ?? false,
              minImages: requirement.minImages ?? null,
              maxImages: requirement.maxImages ?? null,
              requireVideo: requirement.requireVideo ?? false,
              requireDocument: requirement.requireDocument ?? false,
              allowMultipleEvidenceTypes: requirement.allowMultipleEvidenceTypes ?? true,
            },
          },
        }),
      },
      select: TASK_SELECT,
    });

    if (memberIds.length > 0) {
      const assignees = await prisma.workItemMember.findMany({
        where: { id: { in: memberIds } },
        select: { userId: true },
      });
      await notify({
        workItemId,
        userIds: assignees.map((a) => a.userId),
        scope: "PERSONAL",
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: `You've been assigned to "${task.title}"`,
        entityType: "task",
        entityId: task.id,
      });
    }

    const deptUserIds = await getDepartmentMemberUserIds([deptId], user.sub);
    await notify({
      workItemId,
      userIds: deptUserIds,
      scope: "GENERAL",
      type: "TASK_CREATED",
      title: "New task created",
      message: `"${task.title}" was added to your department`,
      entityType: "task",
      entityId: task.id,
    });

    return NextResponse.json(flattenMilestones(task), { status: 201 });
  } catch (err) {
    console.error("[POST /phases/:phaseId/tasks]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}