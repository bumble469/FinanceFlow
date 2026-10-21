import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/password";
import { verifyOtp } from "@/lib/otp";

const MAX_ATTEMPTS = 5;

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { code, newPassword } = await req.json();

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

    // latest unused code: unexpired, max 5 wrong tries
    const challenge = await prisma.passwordChangeCode.findFirst({
      where: { userId: auth.sub, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 400 });
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      // Invalidate the code so it cannot be guessed again
      await prisma.passwordChangeCode.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code." },
        { status: 429 }
      );
    }
    const cleaned = String(code ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(cleaned) || !(await verifyOtp(cleaned, challenge.codeHash))) {
      const updated = await prisma.passwordChangeCode.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= MAX_ATTEMPTS) {
        // Invalidate the code so it cannot be guessed again
        await prisma.passwordChangeCode.update({
          where: { id: challenge.id },
          data: { usedAt: new Date() },
        });
      }
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }

    const strength = validatePasswordStrength(newPassword ?? "");
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors[0] }, { status: 400 });
    }
    if (await verifyPassword(newPassword, user.password)) {
      return NextResponse.json({ error: "New password must be different" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: auth.sub },
        data: { password: await hashPassword(newPassword) },
      }),
      prisma.passwordChangeCode.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/settings/password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}