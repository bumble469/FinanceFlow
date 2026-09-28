import { prisma } from "@/lib/prisma";

const SHARED_STATUSES = ["ACTIVE", "COMPLETED"] as const;

export interface SharedWorkItem {
  id: string;
  name: string;
  type: "PROJECT" | "EVENT" | "PLAN";
  status: string;
}

function accessWhere(userId: string) {
  return {
    OR: [
      { account: { userId } },
      { members: { some: { userId } } },
    ],
  };
}

export async function getSharedWorkItems(userA: string, userB: string): Promise<SharedWorkItem[]> {
  const items = await prisma.workItem.findMany({
    where: {
      status: { in: [...SHARED_STATUSES] },
      AND: [accessWhere(userA), accessWhere(userB)],
    },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  return items as SharedWorkItem[];
}

export async function isSharedWorkItem(userA: string, userB: string, workItemId: string): Promise<boolean> {
  const found = await prisma.workItem.findFirst({
    where: {
      id: workItemId,
      status: { in: [...SHARED_STATUSES] },
      AND: [accessWhere(userA), accessWhere(userB)],
    },
    select: { id: true },
  });
  return !!found;
}