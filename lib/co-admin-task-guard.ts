import { prisma } from "@/lib/prisma";

type Guard = { status: number; error: string } | null;

/**
 * Rules for putting a co-admin on a task (or taking them off) from the
 * "Task Members" screens:
 *  - only an admin (the owner counts, they have an ADMIN row) can assign a co-admin,
 *    and only into a department the co-admin has been added to
 *  - removing a co-admin: an admin, or the co-admin themselves
 * Other roles are not restricted here (existing behaviour).
 */
export async function guardCoAdminTarget(opts: {
  planId: string;
  deptId: string;
  actor: { id: string; role: string };
  targetMemberId: string;
  action: "assign" | "remove";
}): Promise<Guard> {
  const target = await prisma.workItemMember.findFirst({
    where: { id: opts.targetMemberId, workItemId: opts.planId },
    select: { id: true, role: true },
  });
  if (!target) return { status: 404, error: "Member not found" };
  if (target.role !== "CO_ADMIN") return null;

  const actorIsAdmin = opts.actor.role === "ADMIN";

  if (opts.action === "assign") {
    if (!actorIsAdmin) {
      return { status: 403, error: "Only an admin can assign tasks to a co-admin" };
    }
    const inDept = await prisma.departmentMember.findFirst({
      where: { departmentId: opts.deptId, workItemMemberId: target.id },
      select: { id: true },
    });
    if (!inDept) {
      return { status: 400, error: "Add this co-admin to the department first" };
    }
    return null;
  }

  if (!actorIsAdmin && opts.actor.id !== target.id) {
    return { status: 403, error: "Only an admin can remove a co-admin from a task" };
  }
  return null;
}
