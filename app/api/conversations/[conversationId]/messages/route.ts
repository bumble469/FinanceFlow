import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getConversationForUser } from "@/lib/conversation-auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { attachEntities, entityKey, resolveEntities } from "@/lib/chat-entities";
import { emitToUser } from "@/lib/socket-server";

const PAGE_SIZE = 30;

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, image: true } },
  workItem: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const conversation = await getConversationForUser(conversationId, user.sub);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });

    // Resolve attached entities for THIS viewer
    const hydrated = await attachEntities(user.sub, messages);

    return NextResponse.json({
      success: true,
      data: hydrated.reverse(),
      hasMore: messages.length === PAGE_SIZE,
    });
  } catch (err) {
    console.error("[GET /api/conversations/[conversationId]/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const conversation = await getConversationForUser(conversationId, user.sub);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { body, entity } = await req.json();
    const text = typeof body === "string" ? body.trim() : "";
    const hasEntity = !!entity && typeof entity.type === "string" && typeof entity.id === "string";

    if (!text && !hasEntity) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    let entityType: string | null = null;
    let entityId: string | null = null;

    if (hasEntity) {
      const workItemId = conversation.activeWorkItemId;
      if (!workItemId) {
        return NextResponse.json({ error: "Select a work item context to attach items" }, { status: 400 });
      }
      if (!(await getPlanAccess(workItemId, user.sub))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Entity must exist AND belong to the active work item
      const map = await resolveEntities(user.sub, [{ type: entity.type, id: entity.id, workItemId }]);
      const card = map.get(entityKey(entity.type, entity.id));
      if (!card || "unavailable" in card) {
        return NextResponse.json({ error: "Item not found in this work item" }, { status: 400 });
      }
      entityType = entity.type;
      entityId = entity.id;
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.sub,
        body: text,
        workItemId: conversation.activeWorkItemId ?? null,
        entityType,
        entityId,
      },
      include: MESSAGE_INCLUDE,
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const conn = (conversation as any).connection;
    const recipientId = conn.user1Id === user.sub ? conn.user2Id : conn.user1Id;

    // Hydrate separately per viewer: never send the sender's copy to the recipient
    const [forSender] = await attachEntities(user.sub, [message]);
    const [forRecipient] = await attachEntities(recipientId, [message]);

    emitToUser(recipientId, "chat:new-message", {
      conversationId,
      connectionId: conn.id,
      message: forRecipient,
    });

    return NextResponse.json({ success: true, data: forSender });
  } catch (err) {
    console.error("[POST /api/conversations/[conversationId]/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}