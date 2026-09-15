import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const MAX_LIMIT = 20;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const search = (searchParams.get("search") ?? "").trim();

    const baseOr = [{ user1Id: user.sub }, { user2Id: user.sub }];

    const where = search
      ? {
          status: "ACCEPTED" as const,
          OR: [
            {
              user1Id: user.sub,
              user2: {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                ],
              },
            },
            {
              user2Id: user.sub,
              user1: {
                OR: [
                  { name: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }
      : {
          status: "ACCEPTED" as const,
          OR: baseOr,
        };

    const [total, connections] = await Promise.all([
      prisma.connection.count({ where }),
      prisma.connection.findMany({
        where,
        include: {
          user1: { select: { id: true, name: true, email: true, image: true } },
          user2: { select: { id: true, name: true, email: true, image: true } },
          // Fetch unread messages sent by the other user
          conversation: {
            include: {
              messages: {
                where: {
                  senderId: { not: user.sub },
                  readAt: null,
                },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const result = connections.map((c) => ({
      connectionId: c.id,
      user: c.user1Id === user.sub ? c.user2 : c.user1,
      connectedAt: c.createdAt,
      // Map the array length to the unreadCount
      unreadCount: c.conversation?.messages.length || 0,
    }));

    return NextResponse.json({
      connections: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/connections]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}