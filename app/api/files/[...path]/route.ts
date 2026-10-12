import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { getConversationForUser } from "@/lib/conversation-auth";

const INLINE_SAFE =
  /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|video\/(mp4|webm|quicktime)|audio\/[\w.+-]+|text\/(plain|csv))$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { path } = await params;
    if (!path?.length || path.some((p) => p === ".." || p === "")) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const isAvatar = path[0] === "users" && path[2] === "avatar";
    const isChat = path[0] === "chat";

    if (isChat) {
      const conv = await getConversationForUser(path[1], user.sub);
      if (!conv) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (!isAvatar) {
      const access = await getPlanAccess(path[0], user.sub);
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await get(path.join("/"), { access: "private" });
    if (!result || !result.stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const type = (result.blob.contentType || "application/octet-stream").split(";")[0].trim().toLowerCase();
    const inline = INLINE_SAFE.test(type) && !req.nextUrl.searchParams.has("download");
    const last = path[path.length - 1];
    const filename = isChat ? last.slice(37) : last; // strip "<uuid>-" prefix

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[GET /api/files]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}