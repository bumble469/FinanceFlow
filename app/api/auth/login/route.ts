import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from '@/lib/password';
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_TTL,
  generateTwoFactorPendingToken,
} from '@/lib/jwt';
import { getOtpDestination } from '@/lib/two-factor';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;

    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        twoFactor: true,
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    if (user.twoFactor?.enabled) {
      const pendingToken = await generateTwoFactorPendingToken(user.id);

      const response = NextResponse.json(
        {
          success: true,
          requiresTwoFactor: true,
          user: { id: user.id, email: user.email, name: user.name },
          method: user.twoFactor.method,
          destination: getOtpDestination(user.twoFactor),
        },
        { status: 200 }
      );

      response.cookies.set({
        name: 'pending_2fa',
        value: pendingToken,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60,
        path: '/',
      });
      return response;
    }

    await prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });


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
        ipAddress: getClientIp(request) || undefined,
      },
    });

    const refreshToken = await generateRefreshToken(
      user.id,
      refreshTokenRecord.id
    );

    const response = NextResponse.json(
      {
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: 'access_token',
      value: accessToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60,
      path: '/',
    });

    response.cookies.set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_TTL / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null
  );
}
