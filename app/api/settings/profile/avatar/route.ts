import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { saveFile, deleteFile } from "@/lib/storage";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
// extension comes from the verified mime type, never from the user's filename
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: "Only JPG, PNG or WEBP images are allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { success: false, error: "Image must be under 2 MB" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { image: true },
    });

    const { url } = await saveFile(`users/${user.sub}/avatar/${randomUUID()}.${ext}`, file);
    await prisma.user.update({ where: { id: user.sub }, data: { image: url } });

    // old photo removed only after the new one is saved (ignored if it was a Google URL)
    await deleteFile(existing?.image);

    return NextResponse.json({ success: true, data: { image: url } });
  } catch (err) {
    console.error("[POST /api/settings/profile/avatar]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { image: true },
    });

    await prisma.user.update({ where: { id: user.sub }, data: { image: null } });
    await deleteFile(existing?.image);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/settings/profile/avatar]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}