import { prisma } from "@/lib/prisma";

export async function autoConnectWithPlanMembers({
  workItemId,
  userId,
}: {
  workItemId: string;
  userId: string;
}) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoConnectWithCoworkers: true },
  });
  if (!target?.autoConnectWithCoworkers) return;

  const otherMembers = await prisma.workItemMember.findMany({
    where: {
      workItemId,
      userId: { not: userId },
      user: { autoConnectWithCoworkers: true },
    },
    select: { userId: true },
  });

  const candidateIds = new Set(otherMembers.map((m) => m.userId));

  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { account: { select: { userId: true } } },
  });
  const ownerId = workItem?.account?.userId;
  if (ownerId && ownerId !== userId) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { autoConnectWithCoworkers: true },
    });
    if (owner?.autoConnectWithCoworkers) candidateIds.add(ownerId);
  }

  if (candidateIds.size === 0) return;

  const connectionsToCreate = Array.from(candidateIds).map((otherId) => {
    const [u1, u2] = [userId, otherId].sort();
    return { user1Id: u1, user2Id: u2, status: "ACCEPTED" };
  });

  await prisma.connection.createMany({
    data: connectionsToCreate,
    skipDuplicates: true,
  });
}
