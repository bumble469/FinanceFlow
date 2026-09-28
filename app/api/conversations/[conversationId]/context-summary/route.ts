import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getConversationForUser } from "@/lib/conversation-auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { isSharedWorkItem } from "@/lib/shared-work-items";

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const conversation = await getConversationForUser(conversationId, user.sub);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId is required" }, { status: 400 });

    const { user1Id, user2Id } = (conversation as any).connection;
    if (!(await isSharedWorkItem(user1Id, user2Id, workItemId))) {
      return NextResponse.json({ error: "Work item is not shared" }, { status: 403 });
    }
    if (!(await getPlanAccess(workItemId, user.sub))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { tasks: true, milestones: true } },
      },
    });
    if (!workItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: workItem });
  } catch (err) {
    console.error("[GET /api/conversations/[conversationId]/context-summary]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}