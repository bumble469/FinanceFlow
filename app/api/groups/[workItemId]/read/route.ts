import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { emitToUser } from "@/lib/socket-server";

export async function PATCH(_req: Request, { params }: { params: Promise<{ workItemId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workItemId } = await params;
    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.groupRead.upsert({
      where: { workItemId_userId: { workItemId, userId: user.sub } },
      create: { workItemId, userId: user.sub },
      update: { lastReadAt: new Date() },
    });

    // Clear the badge on this user's other open tabs/devices
    emitToUser(user.sub, "group:read", { workItemId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/groups/[workItemId]/read]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}