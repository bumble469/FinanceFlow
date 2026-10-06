import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { path } = await params;
    if (!path?.length || path.some((p) => p === ".." || p === "")) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const access = await getPlanAccess(path[0], user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await get(path.join("/"), { access: "private" });
    if (!result || !result.stream) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[GET /api/files]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}