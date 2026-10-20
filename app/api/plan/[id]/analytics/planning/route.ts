import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  countByStatus,
  computeDueBuckets,
  computeMilestoneProgress,
  completionPercent,
  openTaskCount,
  blockedTaskCount,
} from "@/lib/analytics/tasks";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [tasks, milestones, departments] = await Promise.all([
      prisma.task.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          departmentId: true,
          phaseId: true,
          dueDate: true,
          startDate: true,
          completedAt: true,
        },
      }),
      prisma.milestone.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          title: true,
          dueDate: true,
          originalDueDate: true,
          status: true,
          tasks: {
            select: {
              task: { select: { id: true, title: true, status: true } },
            },
          },
        },
      }),
      prisma.department.findMany({
        where: { workItemId: planId },
        select: { id: true, name: true },
      }),
    ]);

    const taskLikes = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      departmentId: t.departmentId,
      phaseId: t.phaseId,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      priority: t.priority,
    }));

    const milestoneLikes = milestones.map((m) => ({
      id: m.id,
      title: m.title,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      originalDueDate: m.originalDueDate ? m.originalDueDate.toISOString() : null,
      status: m.status,
      tasks: m.tasks.map((mt) => ({
        id: mt.task.id,
        title: mt.task.title,
        status: mt.task.status,
      })),
    }));

    const rollup = {
      taskStatusSlices: countByStatus(taskLikes),
      dueBuckets: computeDueBuckets(taskLikes),
      milestones: computeMilestoneProgress(milestoneLikes),
      completionPct: completionPercent(taskLikes),
      openTasks: openTaskCount(taskLikes),
      blockedTasks: blockedTaskCount(taskLikes),
      totalTasks: tasks.length,
      departments,
      tasks: taskLikes,
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/planning]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
