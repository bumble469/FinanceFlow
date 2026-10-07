import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { saveFile, deleteFile, MAX_FILE_SIZE } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Only the account owner can change a plan's image
async function getOwnedPlan(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) return null;
  return prisma.workItem.findFirst({
    where: { id: planId, accountId: account.id },
    select: { id: true, imageUrl: true },
  });
}

// POST /api/plan/[id]/image — upload or replace the plan image
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const plan = await getOwnedPlan(planId, user.sub);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG or WEBP images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image size cannot exceed 4 MB" }, { status: 413 });
    }

    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { url } = await saveFile(`${planId}/cover/${randomUUID()}-${safeFilename}`, file);

    await prisma.workItem.update({ where: { id: planId }, data: { imageUrl: url } });

    // remove the previous image only after the new one is saved
    await deleteFile(plan.imageUrl);

    return NextResponse.json({ success: true, data: { imageUrl: url } }, { status: 200 });
  } catch (err) {
    console.error("[POST /plan/:id/image]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/plan/[id]/image — remove the plan image
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const plan = await getOwnedPlan(planId, user.sub);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    await prisma.workItem.update({ where: { id: planId }, data: { imageUrl: null } });
    await deleteFile(plan.imageUrl);

    return NextResponse.json({ success: true, data: { imageUrl: null } }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /plan/:id/image]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
