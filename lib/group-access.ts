import { prisma } from "./prisma";

export default interface GroupSummary {
  workItemId: string;
  name: string;
  type: "PROJECT" | "EVENT" | "PLAN";
  status: string;
  imageUrl: string | null;
}

export async function getUserGroups(userId: string): Promise<GroupSummary[]> {
  const groups = await prisma.group.findMany({
    where: {
      workItem: {
        OR: [{ account: { userId } }, { members: { some: { userId } } }],
      },
    },
    include: { workItem: { select: { id: true, name: true, type: true, status: true, imageUrl: true } } },
    orderBy: { workItem: { updatedAt: "desc" } },
  });

  return groups.map((g) => ({
    workItemId: g.workItem.id,
    name: g.workItem.name,
    type: g.workItem.type,
    status: g.workItem.status,
    imageUrl: g.workItem.imageUrl,
  }));
}

export async function groupExists(workItemId: string): Promise<boolean> {
  const g = await prisma.group.findUnique({ where: { workItemId }, select: { workItemId: true } });
  return !!g;
}