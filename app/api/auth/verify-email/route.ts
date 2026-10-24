import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  verifyEmailVerifyPendingToken,
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_TTL,
} from '@/lib/jwt';
import { verifyOtp } from '@/lib/otp';
import { reserveEmailAttempt } from '@/lib/code-attempts';

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
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

    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    }

    const challenge = await prisma.emailVerificationCode.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || new Date() > challenge.expiresAt) {
      return NextResponse.json(
        { error: 'This code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    if (!(await reserveEmailAttempt(challenge.id))) {
      return NextResponse.json(
        { error: 'Too many wrong attempts. Please request a new code.' },
        { status: 429 }
      );
    }
    if (!(await verifyOtp(code, challenge.codeHash))) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.emailVerificationCode.update({
        where: { id: challenge.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { emailVerified: new Date() },
      }),
    ]);

    // Verified: sign them in
    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
    });
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
      },
    });
    const refreshToken = await generateRefreshToken(user.id, refreshTokenRecord.id);

    const secure = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      data: { accessToken, user: { id: user.id, email: user.email, name: user.name } },
    });
    response.cookies.set({ name: 'access_token', value: accessToken, httpOnly: true, sameSite: 'lax', secure, maxAge: 15 * 60, path: '/' });
    response.cookies.set({ name: 'refresh_token', value: refreshToken, httpOnly: true, sameSite: 'lax', secure, maxAge: REFRESH_TOKEN_TTL / 1000, path: '/' });
    response.cookies.set({ name: 'pending_verify', value: '', httpOnly: true, sameSite: 'lax', secure, maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    console.error('[verify-email] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}