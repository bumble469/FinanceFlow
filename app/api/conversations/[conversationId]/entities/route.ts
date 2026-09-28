import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getConversationForUser } from "@/lib/conversation-auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { searchEntities } from "@/lib/chat-entities";
import { ENTITY_TYPES, type EntityType } from "@/lib/chat-types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const conversation = await getConversationForUser(conversationId, user.sub);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const workItemId = conversation.activeWorkItemId;
    if (!workItemId) {
      return NextResponse.json({ error: "Select a work item context first" }, { status: 400 });
    }

    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    if (!type || !(ENTITY_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const search = (searchParams.get("search") ?? "").trim();
    const take = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const data = await searchEntities(workItemId, access, type as EntityType, {
      search: search || undefined,
      take,
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[GET /api/conversations/[conversationId]/entities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}