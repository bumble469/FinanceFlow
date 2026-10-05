import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") as "GENERAL" | "PERSONAL" | null;

    const unreadCounts = await prisma.notification.groupBy({
      by: ["scope"],
      where: {
        userId: user.sub,
        workItemId: null,
        isRead: false,
      },
      _count: true,
    });

    let unreadGeneral = 0;
    let unreadPersonal = 0;
    
    unreadCounts.forEach((c) => {
      if (c.scope === "GENERAL") unreadGeneral = c._count;
      if (c.scope === "PERSONAL") unreadPersonal = c._count;
    });

    // 2. Fetch the actual notification items
    const items = await prisma.notification.findMany({
      where: {
        userId: user.sub,
        workItemId: null,
        ...(scope ? { scope } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50, // limit to 50 most recent to keep UI fast
    });

    return NextResponse.json({
      data: {
        items,
        unreadCount: unreadGeneral + unreadPersonal,
        unreadGeneral,
        unreadPersonal,
      },
    });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}