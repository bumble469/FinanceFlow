import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scope = body.scope as "GENERAL" | "PERSONAL" | undefined;

    await prisma.notification.updateMany({
      where: {
        userId: user.sub,
        workItemId: null,
        ...(scope ? { scope } : {}),
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/notifications/read-all]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}