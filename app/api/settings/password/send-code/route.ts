import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { generateOtpCode, hashOtp } from "@/lib/otp";
import { getOtpDestination } from "@/lib/two-factor";

const MAX_SENDS = 4;
const WINDOW_MS = 15 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { channel?: string } | null;
    const channel = body?.channel === "SECONDARY" ? "SECONDARY" : "PRIMARY";

    const [user, twoFactor] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.sub },
        select: { id: true, email: true, name: true, password: true },
      }),
      prisma.twoFactorSettings.findUnique({
        where: { userId: auth.sub },
        select: { enabled: true, recoveryEmail: true },
      }),
    ]);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.password) {
      return NextResponse.json(
        { error: "This account signs in with Google, so there is no password to change." },
        { status: 400 }
      );
    }

    // the server decides where a code may go, never the client
    let to = user.email;
    if (channel === "SECONDARY") {
      if (!twoFactor?.enabled || !twoFactor.recoveryEmail) {
        return NextResponse.json(
          { error: "Turn on two-step verification to use a secondary email." },
          { status: 400 }
        );
      }
      to = twoFactor.recoveryEmail;
    }

    const recent = await prisma.passwordChangeCode.findMany({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent.length >= MAX_SENDS) {
      return NextResponse.json(
        { error: "Too many codes requested. Please try again in 15 minutes.", remaining: 0 },
        { status: 429 }
      );
    }
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Please wait a few seconds before requesting another code.", remaining: MAX_SENDS - recent.length },
        { status: 429 }
      );
    }

    const code = generateOtpCode(6);
    const codeHash = await hashOtp(code);

    const sent = await sendEmail({
      to,
      toName: user.name,
      subject: "Your FinanceFlow password change code",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
          <h2 style="color:#111;">Confirm your password change</h2>
          <p>Your FinanceFlow code is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p>
          <p style="color:#64748b;font-size:13px;">
            It expires in 10 minutes. If you didn't ask to change your password, ignore this email.
          </p>
        </div>`,
    });
    if (!sent) {
      return NextResponse.json(
        { error: "Could not send the email. Please try again shortly." },
        { status: 502 }
      );
    }

    await prisma.$transaction([
      // only the newest code stays valid
      prisma.passwordChangeCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordChangeCode.create({
        data: {
          userId: user.id,
          codeHash,
          sentTo: to,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      destination: getOtpDestination({ method: "EMAIL", recoveryEmail: to }).value,
      remaining: MAX_SENDS - recent.length - 1,
    });
  } catch (err) {
    console.error("[POST /api/settings/password/send-code]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}