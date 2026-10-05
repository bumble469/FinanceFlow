import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getConversationForUser } from "@/lib/conversation-auth";
import { emitToUser } from "@/lib/socket-server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const conversation = await getConversationForUser(conversationId, user.sub);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { count } = await prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.sub }, readAt: null },
      data: { readAt: new Date() },
    });

    // Even if count is 0, we should clear the badge locally just in case it got stuck
    const conn = (conversation as any).connection;
    
    // 1. Tell YOUR other tabs to clear the unread badge
    emitToUser(user.sub, "chat:read", { 
      connectionId: conn.id 
    });

    if (count > 0) {
      // 2. Tell the OTHER user that you read their messages (for blue ticks)
      const otherUserId = conn.user1Id === user.sub ? conn.user2Id : conn.user1Id;
      emitToUser(otherUserId, "chat:read", { 
        conversationId, 
        connectionId: conn.id,
        readBy: user.sub 
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/conversations/[conversationId]/read]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}