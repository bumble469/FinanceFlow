import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { randomUUID } from "crypto";
import { saveFile } from "@/lib/storage";

function evidenceTypeFor(mimeType: string): "IMAGE" | "VIDEO" | "DOCUMENT" {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; deptId: string; taskId: string }> }
) {
  try {
    const { id: workItemId, taskId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ error: "Not a member of this plan" }, { status: 403 });

    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId },
      include: {
        submittedBy: { include: { user: { select: { name: true, email: true } } } },
        reviewedBy: { include: { user: { select: { name: true } } } },
        files: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: submissions });
  } catch (error) {
    console.error("[GET .../submissions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deptId: string; taskId: string }> }
) {
  try {
    const { id: workItemId, deptId, taskId } = await params;
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const member = await prisma.workItemMember.findUnique({
      where: { workItemId_userId: { workItemId, userId: user.sub } },
    });
    if (!member) return NextResponse.json({ error: "Not a member of this plan" }, { status: 403 });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { members: true, requirement: true },
    });
    if (!task || task.workItemId !== workItemId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAssignedToMe = task.members.some((m) => m.workItemMemberId === member.id);
    if (!isAssignedToMe) {
      return NextResponse.json({ error: "Only assignees can submit work for this task" }, { status: 403 });
    }

    if (!["TODO", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(task.status)) {
      return NextResponse.json({ error: "This task cannot accept a new submission right now" }, { status: 400 });
    }

    const formData = await req.formData();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const files = formData.getAll("files") as File[];

    const req_ = task.requirement;
    if (req_) {
      if (req_.requireDescription && !description) {
        return NextResponse.json({ error: "A description is required for this task" }, { status: 400 });
      }

      const imageCount = files.filter((f) => f.type.startsWith("image/")).length;
      const videoCount = files.filter((f) => f.type.startsWith("video/")).length;
      const docCount = files.length - imageCount - videoCount;

      if (req_.requireImages) {
        if (imageCount < (req_.minImages ?? 1)) {
          return NextResponse.json(
            { error: `At least ${req_.minImages ?? 1} image(s) required` },
            { status: 400 }
          );
        }
        if (req_.maxImages && imageCount > req_.maxImages) {
          return NextResponse.json({ error: `No more than ${req_.maxImages} image(s) allowed` }, { status: 400 });
        }
      }
      if (req_.requireVideo && videoCount < 1) {
        return NextResponse.json({ error: "A video is required for this task" }, { status: 400 });
      }
      if (req_.requireDocument && docCount < 1) {
        return NextResponse.json({ error: "A document/file is required for this task" }, { status: 400 });
      }
      if (!req_.allowMultipleEvidenceTypes) {
        const typesUsed = [imageCount > 0, videoCount > 0, docCount > 0].filter(Boolean).length;
        if (typesUsed > 1) {
          return NextResponse.json({ error: "Only one type of evidence is allowed for this task" }, { status: 400 });
        }
      }
    }

    const submission = await prisma.taskSubmission.create({
      data: { taskId, submittedById: member.id, description },
    });

    if (files.length > 0) {
      for (const file of files) {
        const safeName = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { url } = await saveFile(
          `${workItemId}/tasks/${taskId}/submissions/${submission.id}/${safeName}`,
          file
        );

        await prisma.taskSubmissionFile.create({
          data: {
            submissionId: submission.id,
            fileType: evidenceTypeFor(file.type),
            fileName: file.name,
            filePath: url,
            fileSize: file.size,
            mimeType: file.type,
          },
        });
      }
    }

    await prisma.task.update({ where: { id: taskId }, data: { status: "SUBMITTED" } });

    const approverUserIds = (
      await prisma.workItemMember.findMany({
        where: {
          workItemId,
          OR: [
            { role: { in: ["ADMIN", "CO_ADMIN"] } },
            { role: "MANAGER", departmentMembers: { some: { departmentId: deptId } } },
          ],
        },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    await notify({
      workItemId,
      userIds: approverUserIds.filter((uid) => uid !== user.sub),
      scope: "GENERAL",
      type: "TASK_SUBMITTED",
      title: "Work submitted for review",
      message: `${user.name ?? "A member"} submitted work for "${task.title}"`,
      entityType: "task",
      entityId: taskId,
    });

    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    console.error("[POST .../submissions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}