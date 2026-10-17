import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyEmailVerifyPendingToken } from '@/lib/jwt';
import { generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';

const MAX_SENDS = 4; // first send + 3 resends
const WINDOW_MS = 15 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;

export async function POST() {
  try {
    const token = (await cookies()).get('pending_verify')?.value;
    const pending = token ? await verifyEmailVerifyPendingToken(token) : null;
    if (!pending) {
      return NextResponse.json(
        { error: 'Verification session expired. Please sign up again.' },
        { status: 401 }
      );
    }
    const userId = pending.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified. Please log in.' }, { status: 409 });
    }

    const recent = await prisma.emailVerificationCode.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent.length >= MAX_SENDS) {
      return NextResponse.json(
        { error: 'Too many codes requested. Please try again in 15 minutes.', remaining: 0 },
        { status: 429 }
      );
    }
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Please wait a few seconds before requesting another code.', remaining: MAX_SENDS - recent.length },
        { status: 429 }
      );
    }

    const code = generateOtpCode(6);
    const codeHash = await hashOtp(code);

    const sent = await sendEmail({
      to: user.email,
      subject: 'Verify your FinanceFlow email',
      htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Verify your email</h2>
        <p>Your FinanceFlow verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p>
        <p style="color:#666;">It expires in 10 minutes. If you didn't sign up, you can ignore this email.</p>
      </div>`,
    });
    if (!sent) {
      return NextResponse.json(
        { error: 'Could not send the email. Please try again shortly.' },
        { status: 502 }
      );
    }

    await prisma.$transaction([
      prisma.emailVerificationCode.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.emailVerificationCode.create({
        data: { userId, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      }),
    ]);

    return NextResponse.json({
      success: true,
      remaining: MAX_SENDS - recent.length - 1,
    });
  } catch (error) {
    console.error('[verify-email send] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}