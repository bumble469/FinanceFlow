import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const token = (await cookies()).get('access_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
     const exists = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });

    if (!exists) {
      const res = NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
      res.cookies.set({ name: 'access_token', value: '', maxAge: 0, path: '/' });
      res.cookies.set({ name: 'refresh_token', value: '', maxAge: 0, path: '/' });
      return res;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ME] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
