import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { notificationId } = await params;

    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.sub,
      },
      data: {
        isRead: true,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/notifications/[notificationId]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}