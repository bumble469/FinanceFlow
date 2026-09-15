import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { connectionId } = await params;

    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    if (user.sub !== connection.user1Id && user.sub !== connection.user2Id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (connection.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Connection is not accepted" }, { status: 400 });
    }

    const conversation = await prisma.conversation.upsert({
      where: { connectionId },
      create: { connectionId },
      update: {},
      include: { activeWorkItem: { select: { id: true, name: true, type: true } } },
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (err) {
    console.error("[GET /api/connections/[connectionId]/conversation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}