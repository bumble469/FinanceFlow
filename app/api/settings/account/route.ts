import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { clearAccessTokenCookie, clearRefreshTokenCookie } from "@/lib/jwt";

const TYPES = ["INDIVIDUAL", "COMPANY", "CLUB"];
const select = { id: true, name: true, type: true } as const;

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await prisma.account.findUnique({ where: { userId: auth.sub }, select });
    if (!account) return NextResponse.json({ error: "No account found" }, { status: 404 });

    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[GET /api/settings/account]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, type } = await req.json();
    const data: { name?: string; type?: any } = {};

    if (name !== undefined) {
      const n = String(name).trim();
      if (!n || n.length > 60) {
        return NextResponse.json({ error: "Name must be 1-60 characters" }, { status: 400 });
      }
      data.name = n;
    }
    if (type !== undefined) {
      if (!TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
      }
      data.type = type;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const account = await prisma.account.update({ where: { userId: auth.sub }, data, select });
    return NextResponse.json({ success: true, data: account });
  } catch (err) {
    console.error("[PATCH /api/settings/account]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { confirmEmail, password } = await req.json();
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, password: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (String(confirmEmail ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match" }, { status: 400 });
    }
    if (user.password && (!password || !(await verifyPassword(password, user.password)))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: user.id } });
    await clearAccessTokenCookie();
    await clearRefreshTokenCookie();

    return NextResponse.json({ success: true });
  } catch (err) {
    // Milestone.creator and Expense.requestedBy use onDelete: Restrict
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "You still have milestones or expense requests in shared plans. Leave those plans or ask the owners to remove them first." },
        { status: 409 }
      );
    }
    console.error("[DELETE /api/settings/account]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}