import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/group-access";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groups = await getUserGroups(user.sub);

    const withUnread = await Promise.all(
      groups.map(async (g) => {
        const cursor = await prisma.groupRead.findUnique({
          where: { workItemId_userId: { workItemId: g.workItemId, userId: user.sub } },
          select: { lastReadAt: true },
        });
        const unreadCount = await prisma.message.count({
          where: {
            groupId: g.workItemId,
            senderId: { not: user.sub },
            createdAt: { gt: cursor?.lastReadAt ?? new Date(0) },
          },
        });
        return { ...g, unreadCount };
      })
    );

    return NextResponse.json({ success: true, data: withUnread });
  } catch (err) {
    console.error("[GET /api/groups]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}