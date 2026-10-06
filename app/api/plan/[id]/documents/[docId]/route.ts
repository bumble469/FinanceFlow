import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string; docId: string }> };

async function resolveAccess(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  const isOwner = account
    ? !!(await prisma.workItem.findFirst({ where: { id: planId, accountId: account.id } }))
    : false;

  if (isOwner) return { isOwner: true, role: "OWNER" as const, permissions: null };

  const member = await prisma.workItemMember.findFirst({
    where: { workItemId: planId, userId },
  });

  if (!member) return null;

  return {
    isOwner: false,
    role: member.role,
    permissions: member.permissions as any,
  };
}

function canEdit(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "MEMBER") return false;
  if (access.role === "CO_ADMIN") return !!access.permissions?.reports?.edit;
  if (access.role === "MANAGER") return access.permissions?.reports === "MANAGE";
  if (access.role === "CO_MANAGER") return access.permissions?.reports === "MANAGE";
  return false;
}

function canDelete(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "MEMBER") return false;
  if (access.role === "CO_ADMIN") return !!access.permissions?.reports?.delete;
  if (access.role === "MANAGER") return access.permissions?.reports === "MANAGE";
  if (access.role === "CO_MANAGER") return access.permissions?.reports === "MANAGE";
  return false;
}

// ── PATCH /api/plan/[id]/documents/[docId] ────────────────────────────────────
// Edit note title/content only — files cannot be "edited"

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, docId } = await params;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canEdit(access)) {
      return NextResponse.json({ error: "You don't have permission to edit documents" }, { status: 403 });
    }

    const doc = await prisma.workItemDocument.findFirst({
      where: { id: docId, workItemId: planId },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (doc.type === "FILE") {
      return NextResponse.json({ error: "Uploaded files cannot be edited — delete and re-upload instead" }, { status: 400 });
    }

    const body = await req.json();
    const { title, content } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const updated = await prisma.workItemDocument.update({
      where: { id: docId },
      data: {
        title: title.trim(),
        content: content?.trim() || null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        type: "note",
        title: updated.title,
        content: updated.content,
        uploadedAt: updated.createdAt.toISOString(),
        uploadedBy: updated.uploadedBy?.name || updated.uploadedBy?.email || "Unknown",
      },
    });
  } catch (err) {
    console.error("[PATCH /documents/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/plan/[id]/documents/[docId] ───────────────────────────────────
// Deletes the DB record. If it's a file, also removes it from disk.

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, docId } = await params;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canDelete(access)) {
      return NextResponse.json({ error: "You don't have permission to delete documents" }, { status: 403 });
    }

    const doc = await prisma.workItemDocument.findFirst({
      where: { id: docId, workItemId: planId },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // if it's a file, delete it from storage
    if (doc.type === "FILE" && doc.fileUrl) {
      await deleteFile(doc.fileUrl);
    }

    await prisma.workItemDocument.delete({ where: { id: docId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /documents/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}