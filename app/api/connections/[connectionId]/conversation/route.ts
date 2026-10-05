import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getSharedWorkItems, isSharedWorkItem } from "@/lib/shared-work-items";
import { emitToUser } from "@/lib/socket-server";

const activeWorkItemSelect = { select: { id: true, name: true, type: true } } as const;

async function loadConnection(connectionId: string, userId: string) {
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return { error: NextResponse.json({ error: "Connection not found" }, { status: 404 }) };
  if (userId !== connection.user1Id && userId !== connection.user2Id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (connection.status !== "ACCEPTED") {
    return { error: NextResponse.json({ error: "Connection is not accepted" }, { status: 400 }) };
  }
  return { connection };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { connectionId } = await params;
    const { connection, error } = await loadConnection(connectionId, user.sub);
    if (error) return error;

    const sharedWorkItems = await getSharedWorkItems(connection!.user1Id, connection!.user2Id);

    let conversation = await prisma.conversation.findUnique({
      where: { connectionId },
      include: { activeWorkItem: activeWorkItemSelect },
    });

    if (!conversation) {
      // First open: pre-select the work item if exactly one is shared
      conversation = await prisma.conversation.create({
        data: {
          connectionId,
          activeWorkItemId: sharedWorkItems.length === 1 ? sharedWorkItems[0].id : null,
        },
        include: { activeWorkItem: activeWorkItemSelect },
      });
    } else if (
      conversation.activeWorkItemId &&
      !sharedWorkItems.some((w) => w.id === conversation!.activeWorkItemId)
    ) {
      // Stale: someone left / work item archived → fall back to General
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { activeWorkItemId: null },
        include: { activeWorkItem: activeWorkItemSelect },
      });
    }

    return NextResponse.json({ success: true, data: conversation, sharedWorkItems });
  } catch (err) {
    console.error("[GET /api/connections/[connectionId]/conversation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — change the conversation's work-item context (null = General)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { connectionId } = await params;
    const { connection, error } = await loadConnection(connectionId, user.sub);
    if (error) return error;

    const body = await req.json();
    const workItemId: string | null = body?.workItemId ?? null;
    if (workItemId !== null && typeof workItemId !== "string") {
      return NextResponse.json({ error: "Invalid workItemId" }, { status: 400 });
    }

    if (workItemId) {
      const ok = await isSharedWorkItem(connection!.user1Id, connection!.user2Id, workItemId);
      if (!ok) return NextResponse.json({ error: "Work item is not shared" }, { status: 403 });
    }

    const conversation = await prisma.conversation.upsert({
      where: { connectionId },
      create: { connectionId, activeWorkItemId: workItemId },
      update: { activeWorkItemId: workItemId },
      include: { activeWorkItem: activeWorkItemSelect },
    });

    const otherUserId = connection!.user1Id === user.sub ? connection!.user2Id : connection!.user1Id;
    emitToUser(otherUserId, "chat:context-changed", {
      conversationId: conversation.id,
      connectionId,
      activeWorkItemId: conversation.activeWorkItemId,
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (err) {
    console.error("[PATCH /api/connections/[connectionId]/conversation]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}