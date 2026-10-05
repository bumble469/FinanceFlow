import { prisma } from "@/lib/prisma";

export interface GroupMemberView {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
}

export async function getGroupMembers(workItemId: string): Promise<GroupMemberView[]> {
  const members = await prisma.workItemMember.findMany({
    where: { workItemId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
  }));
}

export async function isInGroup(workItemId: string, userId: string): Promise<boolean> {
  const member = await prisma.workItemMember.findFirst({
    where: { workItemId, userId },
    select: { id: true },
  });
  return !!member;
}