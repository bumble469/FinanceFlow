import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        headline: true,
        emailVerified: true,
        createdAt: true,
        password: true,
        oauthAccount: { select: { provider: true } },
      },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // never send the password hash to the client
    const { password, oauthAccount, ...rest } = row;
    return NextResponse.json({
      success: true,
      data: { ...rest, hasPassword: !!password, provider: oauthAccount?.provider ?? null },
    });
  } catch (err) {
    console.error("[GET /api/settings/profile]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data: { name?: string; headline?: string | null } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 60) {
        return NextResponse.json(
          { success: false, error: "Name must be 1 to 60 characters" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.headline !== undefined) {
      const headline = String(body.headline ?? "").trim();
      if (headline.length > 160) {
        return NextResponse.json(
          { success: false, error: "Headline must be 160 characters or less" },
          { status: 400 }
        );
      }
      data.headline = headline || null;
    }

    const updated = await prisma.user.update({
      where: { id: user.sub },
      data,
      select: { id: true, name: true, image: true, headline: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/settings/profile]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}