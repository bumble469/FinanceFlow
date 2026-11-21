import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string; deptId: string; taskId: string }> };

// Shared checks for take-up / leave. Returns either an error response or the resolved rows.
async function resolve(planId: string, deptId: string, taskId: string, userId: string) {
  const member = await prisma.workItemMember.findUnique({
    where: { workItemId_userId: { workItemId: planId, userId } },
    select: { id: true, role: true },
  });
  if (!member) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  if (member.role !== "ADMIN" && member.role !== "CO_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only admins and co-admins can take up tasks" },
        { status: 403 }
      ),
    };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, workItemId: planId, departmentId: deptId },
    select: { id: true, status: true, title: true },
  });
  if (!task) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };

  return { member, task };
}

// POST — take up this task for yourself
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, deptId, taskId } = await params;

    const resolved = await resolve(planId, deptId, taskId, user.sub);
    if ("error" in resolved) return resolved.error;
    const { member, task } = resolved;

    // Admins (and the owner) can always take up tasks. Co-admins only when the plan allows it.
    if (member.role === "CO_ADMIN") {
      const workItem = await prisma.workItem.findUnique({
        where: { id: planId },
        select: { allowAdminTakeUpTasks: true },
      });
      if (!workItem?.allowAdminTakeUpTasks) {
        return NextResponse.json(
          { error: "Co-admins can't take up tasks in this plan. Ask an admin to assign you." },
          { status: 403 }
        );
      }
    }

    if (task.status === "COMPLETED" || task.status === "DONE") {
      return NextResponse.json({ error: "This task is already completed" }, { status: 400 });
    }

    // Admins can take any task; a co-admin only in departments they've been added to
    if (member.role === "CO_ADMIN") {
      const inDept = await prisma.departmentMember.findFirst({
        where: { departmentId: deptId, workItemMemberId: member.id },
        select: { id: true },
      });
      if (!inDept) {
        return NextResponse.json(
          { error: "You need to be part of this department to take up its tasks" },
          { status: 403 }
        );
      }
    }

    await prisma.taskMember.upsert({
      where: { taskId_workItemMemberId: { taskId, workItemMemberId: member.id } },
      create: { taskId, workItemMemberId: member.id },
      update: {},
    });

    return NextResponse.json({ success: true, workItemMemberId: member.id }, { status: 201 });
  } catch (err) {
    console.error("[POST take-up]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — step off the task. Always allowed, even if the setting was changed later.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, deptId, taskId } = await params;

    const resolved = await resolve(planId, deptId, taskId, user.sub);
    if ("error" in resolved) return resolved.error;
    const { member } = resolved;

    await prisma.taskMember.deleteMany({ where: { taskId, workItemMemberId: member.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE take-up]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
