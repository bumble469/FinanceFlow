import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getRefreshTokenFromCookie, verifyRefreshToken, clearRefreshTokenCookie, clearAccessTokenCookie } from '@/lib/jwt';

const prisma = new PrismaClient();

interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogoutResponse>> {
  try {
    const refreshTokenFromCookie = await getRefreshTokenFromCookie();

    if (!refreshTokenFromCookie) {
      await clearAccessTokenCookie();
      await clearRefreshTokenCookie();
      return NextResponse.json<LogoutResponse>(
        {
          success: true,
          message: 'Logged out successfully',
        },
        { status: 200 }
      );
    }

    const decoded = await verifyRefreshToken(refreshTokenFromCookie);

    if (decoded) {
      await prisma.refreshToken.update({
        where: { id: decoded.tokenId },
        data: { revokedAt: new Date() },
      }).catch((err) => {
        console.error('[Logout] Failed to revoke token:', err);
        return { status: 500, message: "Logout failed: ", err}
      });
    }
    await clearAccessTokenCookie();
    await clearRefreshTokenCookie();

    return NextResponse.json<LogoutResponse>(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Logout] Error:', error);

    return NextResponse.json<LogoutResponse>(
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
