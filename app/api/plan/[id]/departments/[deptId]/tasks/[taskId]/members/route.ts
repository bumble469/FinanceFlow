import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { guardCoAdminTarget } from "@/lib/co-admin-task-guard";

async function resolveTask(workItemId: string, deptId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, workItemId, departmentId: deptId },
  });
}

async function checkMembership(workItemId: string, userId: string) {
  return prisma.workItemMember.findUnique({
    where: { workItemId_userId: { workItemId, userId } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deptId: string; taskId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, deptId, taskId } = await params;

    const membership = await checkMembership(id, user.sub);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await resolveTask(id, deptId, taskId);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const assignedMembers = await prisma.taskMember.findMany({
      where: { taskId },
      select: {
        id: true,
        workItemMember: {
          select: { id: true, role: true, user: { select: { id: true, name: true, image: true, email: true } } },
        },
      },
    });

    const assignedWorkItemMemberIds = assignedMembers.map((m) => m.workItemMember.id);

    const eligibleMembers = await prisma.workItemMember.findMany({
      where: {
        workItemId: id,
        id: { notIn: assignedWorkItemMemberIds },
        role: {
          in:
            membership.role === "ADMIN"
              ? ["CO_ADMIN", "MANAGER", "CO_MANAGER", "MEMBER"]
              : ["MANAGER", "CO_MANAGER", "MEMBER"],
        },
        departmentMembers: { some: { departmentId: deptId } },
      },
      select: { id: true, role: true, user: { select: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({ assigned: assignedMembers, eligible: eligibleMembers });
  } catch (err) {
    console.error("[GET dept task members]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; deptId: string; taskId: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, deptId, taskId } = await params;

    const membership = await checkMembership(id, user.sub);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await resolveTask(id, deptId, taskId);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const body = await req.json();
    const { workItemMemberId } = body;
    if (!workItemMemberId) {
      return NextResponse.json({ error: "workItemMemberId required" }, { status: 400 });
    }

    const blocked = await guardCoAdminTarget({
      planId: id,
      deptId,
      actor: membership,
      targetMemberId: workItemMemberId,
      action: "assign",
    });
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

    const taskMember = await prisma.taskMember.create({
      data: { taskId, workItemMemberId },
      select: {
        id: true,
        workItemMember: { select: { id: true, role: true, user: { select: { id: true, name: true, image: true } } } },
      },
    });

    const taskRow = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
    await notify({
      workItemId: id,
      userIds: [taskMember.workItemMember.user.id],
      scope: "PERSONAL",
      type: "TASK_ASSIGNED",
      title: "New task assigned",
      message: `You've been assigned to "${taskRow?.title ?? "a task"}"`,
      entityType: "task",
      entityId: taskId,
    });

    return NextResponse.json(taskMember, { status: 201 });
  } catch (err: any) {
    console.error("[POST dept task member]", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Member already assigned" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; deptId: string; taskId: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, deptId, taskId } = await params;

    const membership = await checkMembership(id, user.sub);
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await resolveTask(id, deptId, taskId);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const workItemMemberId = searchParams.get("workItemMemberId");
    if (!workItemMemberId) {
      return NextResponse.json({ error: "workItemMemberId required" }, { status: 400 });
    }

    const blocked = await guardCoAdminTarget({
      planId: id,
      deptId,
      actor: membership,
      targetMemberId: workItemMemberId,
      action: "remove",
    });
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

    await prisma.taskMember.deleteMany({ where: { taskId, workItemMemberId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE dept task member]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}