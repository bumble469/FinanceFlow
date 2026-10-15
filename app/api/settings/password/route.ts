import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/password";

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json(
        { error: "This account signs in with Google, so there is no password to change." },
        { status: 400 }
      );
    }

    if (!currentPassword || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const strength = validatePasswordStrength(newPassword ?? "");
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors[0] }, { status: 400 });
    }
    if (await verifyPassword(newPassword, user.password)) {
      return NextResponse.json({ error: "New password must be different" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: auth.sub },
      data: { password: await hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/settings/password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}