import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { groupExists } from "@/lib/group-access";
import { getGroupMembers } from "@/lib/group";
import { attachEntities, entityKey, resolveEntities } from "@/lib/chat-entities";
import { emitToUser } from "@/lib/socket-server";
import { sendEmail, notificationEmailHtml } from "@/lib/email";
import { getConnectionPrefsForUsers } from "@/lib/user-preferences";
import type { GroupMemberView } from "@/lib/group";

const PAGE_SIZE = 30;

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, image: true } },
} as const;

const MAX_MENTION_EMAILS = 5;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function getMentionedMembers(text: string, members: GroupMemberView[]) {
  return members.filter((m) => {
    const handle = (m.name || m.email.split("@")[0]).trim();
    if (!handle) return false;
    // "@Ann" must not match "@Anna"
    return new RegExp(`(^|\\s)@${escapeRegExp(handle)}(?!\\w)`, "i").test(text);
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ workItemId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workItemId } = await params;
    if (!(await groupExists(workItemId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");

    const messages = await prisma.message.findMany({
      where: { groupId: workItemId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });

    // Entity cards are resolved against the group's own work item, not a per-message tag
    const withWorkItem = messages.map((m) => ({ ...m, workItemId }));
    const hydrated = await attachEntities(user.sub, withWorkItem);

    return NextResponse.json({
      success: true,
      data: hydrated.reverse(),
      hasMore: messages.length === PAGE_SIZE,
    });
  } catch (err) {
    console.error("[GET /api/groups/[workItemId]/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workItemId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workItemId } = await params;
    if (!(await groupExists(workItemId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { status: true },
    });
    if (workItem?.status === "ARCHIVED" || workItem?.status === "CANCELLED") {
      return NextResponse.json({ error: "This group is read-only" }, { status: 403 });
    }

    const { body, entity } = await req.json();
    const text = typeof body === "string" ? body.trim() : "";
    const hasEntity = !!entity && typeof entity.type === "string" && typeof entity.id === "string";

    if (!text && !hasEntity) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    let entityType: string | null = null;
    let entityId: string | null = null;

    if (hasEntity) {
      const map = await resolveEntities(user.sub, [{ type: entity.type, id: entity.id, workItemId }]);
      const card = map.get(entityKey(entity.type, entity.id));
      if (!card || "unavailable" in card) {
        return NextResponse.json({ error: "Item not found in this work item" }, { status: 400 });
      }
      entityType = entity.type;
      entityId = entity.id;
    }

    const message = await prisma.message.create({
      data: { groupId: workItemId, senderId: user.sub, body: text, entityType, entityId },
      include: MESSAGE_INCLUDE,
    });

    const members = await getGroupMembers(workItemId);
    const others = members.filter((m) => m.userId !== user.sub);

    const mentioned = text ? getMentionedMembers(text, others) : [];
    const mentionedIds = new Set(mentioned.map((m) => m.userId));

    // Hydrate once per distinct viewer (sender + each recipient), never share one copy
    const [forSender] = await attachEntities(user.sub, [{ ...message, workItemId }]);
    await Promise.all(
      others.map(async (m) => {
        const [forThem] = await attachEntities(m.userId, [{ ...message, workItemId }]);
        emitToUser(m.userId, "group:new-message", {
          workItemId,
          message: forThem,
          mentioned: mentionedIds.has(m.userId),
        });
      })
    );

    if (mentioned.length > 0) {
      const targets = mentioned.slice(0, MAX_MENTION_EMAILS);
      const senderName = message.sender.name ?? "Someone";

      after(async () => {
        try {
          const [prefsMap, group] = await Promise.all([
            getConnectionPrefsForUsers(targets.map((t) => t.userId)),
            prisma.workItem.findUnique({ where: { id: workItemId }, select: { name: true } }),
          ]);
          const groupName = group?.name ?? "a group";
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;

          await Promise.allSettled(
            targets
              .filter((t) => prefsMap.get(t.userId)?.messageSnackbarEnabled !== false)
              .map((t) =>
                sendEmail({
                  to: t.email,
                  toName: t.name,
                  subject: `${senderName} mentioned you in ${groupName}`,
                  htmlContent: notificationEmailHtml({
                    title: `${escapeHtml(senderName)} mentioned you in ${escapeHtml(groupName)}`,
                    message: escapeHtml(snippet),
                    planName: null,
                    appUrl: `${appUrl}/connections`,
                  }),
                })
              )
          );
        } catch (err) {
          console.error("[group mention email]", err);
        }
      });
    }

    return NextResponse.json({ success: true, data: forSender });
  } catch (err) {
    console.error("[POST /api/groups/[workItemId]/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}