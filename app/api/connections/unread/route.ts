import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/group-access";

/**
 * Total unread message count for the signed-in user, across direct connection
 * conversations and group chats. Powers the Connections badge in the sidebar.
 *
 * Direct messages use a per-message `readAt` flag; group messages use a
 * per-group `lastReadAt` cursor, so they are counted separately and summed.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Direct: messages in my conversations that the other party hasn't read.
    const directCount = await prisma.message.count({
      where: {
        conversationId: { not: null },
        senderId: { not: user.sub },
        readAt: null,
        conversation: {
          connection: {
            status: "ACCEPTED",
            OR: [{ user1Id: user.sub }, { user2Id: user.sub }],
          },
        },
      },
    });

    // Group: count per group, using that group's own read cursor.
    const groups = await getUserGroups(user.sub);
    let groupCount = 0;

    if (groups.length > 0) {
      const groupIds = groups.map((g) => g.workItemId);
      const cursors = await prisma.groupRead.findMany({
        where: { userId: user.sub, workItemId: { in: groupIds } },
        select: { workItemId: true, lastReadAt: true },
      });
      const cursorByGroup = new Map(cursors.map((c) => [c.workItemId, c.lastReadAt]));

      const perGroup = await Promise.all(
        groupIds.map((groupId) =>
          prisma.message.count({
            where: {
              groupId,
              senderId: { not: user.sub },
              createdAt: { gt: cursorByGroup.get(groupId) ?? new Date(0) },
            },
          })
        )
      );

      groupCount = perGroup.reduce((sum, n) => sum + n, 0);
    }

    return NextResponse.json({
      success: true,
      data: { unreadCount: directCount + groupCount, directCount, groupCount },
    });
  } catch (err) {
    console.error("[GET /api/connections/unread]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
