import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  getRefreshTokenFromCookie,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_TTL,
  setRefreshTokenCookie
} from '@/lib/jwt';

const prisma = new PrismaClient();

interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
  };
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<RefreshResponse>> {
  try {
    const refreshTokenFromCookie = await getRefreshTokenFromCookie();

    if (!refreshTokenFromCookie) return failAndClear('No refresh token provided');

    const decoded = await verifyRefreshToken(refreshTokenFromCookie);

    if (!decoded) return failAndClear('Invalid or expired refresh token');

    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!refreshTokenRecord || refreshTokenRecord.revokedAt !== null) return failAndClear('Refresh token has been revoked');

    if (new Date() > refreshTokenRecord.expiresAt) return failAndClear('Refresh token has expired');

    // GENERATE NEW ACCESS TOKEN
    const { user } = refreshTokenRecord;

    const newAccessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
    });

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: decoded.tokenId },
      data: { revokedAt: new Date() },
    });

    // Create new refresh token
    const newRefreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: getClientIp(request) || undefined,
      },
    });

    const newRefreshToken = await generateRefreshToken(
      user.id,
      newRefreshTokenRecord.id
    );

    // ⚠️ KEEPING your helper (as requested)
    await setRefreshTokenCookie(newRefreshToken, REFRESH_TOKEN_TTL);

    // ============================
    // ✅ CREATE RESPONSE FIRST
    // ============================
    const response = NextResponse.json<RefreshResponse>(
      {
        success: true,
        data: {
          accessToken: newAccessToken,
        },
      },
      { status: 200 }
    );

    // ============================
    // ✅ ACCESS TOKEN COOKIE
    // ============================
    response.cookies.set({
      name: 'access_token',
      value: newAccessToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 15,
      path: '/',
    });

    response.cookies.set({
      name: 'refresh_token',
      value: newRefreshToken,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_TTL / 1000,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('[Refresh] Error:', error);

    return NextResponse.json<RefreshResponse>(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null
  );
}

function failAndClear(error: string, status = 401) {
  const res = NextResponse.json<RefreshResponse>({ success: false, error }, { status });
  res.cookies.set({ name: 'access_token', value: '', maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.cookies.set({ name: 'refresh_token', value: '', maxAge: 0, path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  return res;
}