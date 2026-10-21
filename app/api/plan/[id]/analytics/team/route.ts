import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { buildWorkloadRows } from "@/lib/analytics/tasks";

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: planId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const currentMember = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId: planId, userId: user.sub } },
    });
    if (!currentMember) return NextResponse.json({ success: false, error: "Not a member of this plan" }, { status: 403 });

    const [workItem, members, tasks] = await Promise.all([
      prisma.workItem.findUnique({
        where: { id: planId },
        select: { currency: true },
      }),
      prisma.workItemMember.findMany({
        where: { workItemId: planId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          departmentMembers: { include: { department: { select: { id: true, name: true } } } },
        },
      }),
      prisma.task.findMany({
        where: { workItemId: planId },
        select: {
          id: true,
          status: true,
          members: { select: { workItemMemberId: true } },
        },
      }),
    ]);

    if (!workItem) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });

    const memberStats = members.map((m) => {
      const assignedTasks = tasks.filter((t) => t.members.some((tm) => tm.workItemMemberId === m.id));
      const doneCount = assignedTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
      const blockedCount = assignedTasks.filter((t) => t.status === "BLOCKED").length;

      return {
        id: m.id,
        userId: m.userId,
        name: m.user.name || m.user.email,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        monthlyCost: num(m.monthlyCost),
        departments: m.departmentMembers.map((d) => d.department.name),
        taskCount: assignedTasks.length,
        doneTasks: doneCount,
        openTasks: assignedTasks.length - doneCount,
        blockedTasks: blockedCount,
      };
    });

    const workloadRows = buildWorkloadRows(
      memberStats.map((m) => ({
        memberId: m.id,
        name: m.name,
        taskCount: m.taskCount,
      }))
    );

    const rollup = {
      members: memberStats,
      workloadRows,
      totalMembers: members.length,
      currency: workItem.currency || "USD",
    };

    return NextResponse.json({ success: true, data: rollup });
  } catch (err) {
    console.error("[GET /api/plan/[id]/analytics/team]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
