import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.password) {
      return NextResponse.json(
        { error: "This account signs in with Google, so there is no password to reset." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: "Reset your FinanceFlow password",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111;">Password Reset Request</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>We received a request to reset your password for your FinanceFlow account.</p>
          <p>You can update your security credentials directly in your account settings:</p>
          <div style="margin: 24px 0;">
            <a href="${appUrl}/settings" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
              Manage Security Settings
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset instructions have been sent to your email.",
    });
  } catch (err) {
    console.error("[POST /api/settings/password/reset-request]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
