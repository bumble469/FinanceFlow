import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getConversationForUser } from "@/lib/conversation-auth";
import { emitToUser } from "@/lib/socket-server";

const PAGE_SIZE = 30;

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
      include: { sender: { select: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({
      success: true,
      data: messages.reverse(),
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

    const { body } = await req.json();
    if (!body || typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: { conversationId, senderId: user.sub, body: body.trim() },
      include: { sender: { select: { id: true, name: true, image: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const conn = (conversation as any).connection;
    const recipientId = conn.user1Id === user.sub ? conn.user2Id : conn.user1Id;
    emitToUser(recipientId, "chat:new-message", { conversationId, connectionId: conn.id, message });

    return NextResponse.json({ success: true, data: message });
  } catch (err) {
    console.error("[POST /api/conversations/[conversationId]/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}