import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { saveFile, deleteFile } from "@/lib/storage";
import { getPlanAccess } from "@/lib/get-plan-access";

type Params = { params: Promise<{ id: string }> };

async function resolveAccess(planId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  const isOwner = account
    ? !!(await prisma.workItem.findFirst({ where: { id: planId, accountId: account.id } }))
    : false;
  if (isOwner) return { isOwner: true, role: "OWNER" as const, memberId: null as string | null };
  const member = await prisma.workItemMember.findFirst({ where: { workItemId: planId, userId } });
  if (!member) return null;
  return { isOwner: false, role: member.role, memberId: member.id as string | null };
}

function canManageQr(access: { isOwner: boolean; role: string }) {
  return access.isOwner || access.role === "ADMIN" || access.role === "CO_ADMIN";
}

// POST — upload or replace the event's UPI QR
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await getPlanAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.permissions.canManageTicketingQr) {
      return NextResponse.json({ error: "You don't have permission to manage the payment QR" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, or WEBP images are allowed" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { workItemId: planId } });
    if (!event) return NextResponse.json({ error: "This plan is not an event" }, { status: 400 });

    const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "");
    const { url: publicPath } = await saveFile(
      `${planId}/qr/upi-qr-${Date.now()}.${ext}`,
      file
    );

    const updated = await prisma.event.update({
      where: { workItemId: planId },
      data: {
        upiQrUrl: publicPath,
        upiQrPath: publicPath,
        upiQrUploadedById: access.memberId,
        upiQrUpdatedAt: new Date(),
      },
    });

    await deleteFile(event.upiQrPath);
    return NextResponse.json({ success: true, data: { upiQrUrl: updated.upiQrUrl, upiQrUpdatedAt: updated.upiQrUpdatedAt } });
  } catch (err) {
    console.error("[POST /ticketing/qr]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove the QR
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId } = await params;
    const access = await getPlanAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.permissions.canManageTicketingQr) {
      return NextResponse.json({ error: "You don't have permission to manage the payment QR" }, { status: 403 });
    }

    const event = await prisma.event.findUnique({ where: { workItemId: planId } });
    if (!event) return NextResponse.json({ error: "This plan is not an event" }, { status: 400 });

    await deleteFile(event.upiQrPath);

    await prisma.event.update({
      where: { workItemId: planId },
      data: { upiQrUrl: null, upiQrPath: null, upiQrUploadedById: null, upiQrUpdatedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /ticketing/qr]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}