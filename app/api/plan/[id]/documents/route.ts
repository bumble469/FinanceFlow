import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { saveFile, MAX_FILE_SIZE } from "@/lib/storage";
import { notify, getAllPlanUserIds } from "@/lib/notify";

type Params = { params: Promise<{ id: string }> };

// ── access resolver ───────────────────────────────────────────────────────────

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

function canCreate(access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>): boolean {
  if (access.isOwner || access.role === "ADMIN") return true;
  if (access.role === "MEMBER") return false;
  if (access.role === "CO_ADMIN") return !!access.permissions?.reports?.create;
  if (access.role === "MANAGER") return access.permissions?.reports === "MANAGE";
  if (access.role === "CO_MANAGER") return access.permissions?.reports === "MANAGE";
  return false;
}

// ── GET /api/plan/[id]/documents ─────────────────────────────────────────────
// All roles can view all documents
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const docs = await prisma.workItemDocument.findMany({
      where: { workItemId: planId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = docs.map((d) => ({
      id: d.id,
      type: d.type.toLowerCase() as "note" | "document",
      title: d.title,
      content: d.content,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      uploadedAt: d.createdAt.toISOString(),
      uploadedBy: d.uploadedBy?.name || d.uploadedBy?.email || "Unknown",
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[GET /documents]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/plan/[id]/documents ────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;

    const access = await resolveAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!canCreate(access)) {
      return NextResponse.json({ error: "You don't have permission to add documents" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // ── Branch A: File upload (multipart/form-data) ──────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string)?.trim();

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File size cannot exceed 4 MB" }, { status: 413 });
      }
      // validate file type — allow pdf, word, excel, images, txt
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "image/jpeg",
        "image/png",
        "image/webp",

        "text/plain",
        "text/csv",

        // Videos
        "video/mp4",
        "video/webm",
        "video/quicktime",

        "application/zip",
        "application/x-zip-compressed",
      ];

      if (!allowed.includes(file.type)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
      }

      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { url: fileUrl } = await saveFile(
        `${planId}/documents/${randomUUID()}-${safeFilename}`,
        file
      );
      
      const fileSize = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const doc = await prisma.workItemDocument.create({
        data: {
          workItemId: planId,
          type: "FILE",
          title,
          fileName: file.name,
          fileUrl,
          fileSize,
          uploadedById: user.sub,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: doc.id,
          type: "document",
          title: doc.title,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          fileSize: doc.fileSize,
          uploadedAt: doc.createdAt.toISOString(),
          uploadedBy: doc.uploadedBy?.name || doc.uploadedBy?.email || "Unknown",
        },
      }, { status: 201 });
    }

    // ── Branch B: Note (JSON) ────────────────────────────────────────────────
    const body = await req.json();
    const { title, content } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const doc = await prisma.workItemDocument.create({
      data: {
        workItemId: planId,
        type: "NOTE",
        title: title.trim(),
        content: content?.trim() || null,
        uploadedById: user.sub,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const recipientUserIds = await getAllPlanUserIds(planId, user.sub);
    await notify({
      workItemId: planId,
      userIds: recipientUserIds,
      scope: "GENERAL",
      type: "DOCUMENT_UPLOADED",
      title: "New document uploaded",
      message: `"${title}" was uploaded.`,
      entityType: "document",
      entityId: doc.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        type: "note",
        title: doc.title,
        content: doc.content,
        uploadedAt: doc.createdAt.toISOString(),
        uploadedBy: doc.uploadedBy?.name || doc.uploadedBy?.email || "Unknown",
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /documents]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}