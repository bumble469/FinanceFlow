import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const [settings, user] = await Promise.all([
            prisma.twoFactorSettings.findUnique({
                where: { userId: auth.sub },
                select: { enabled: true, method: true, recoveryEmail: true, recoveryPhone: true },
            }),
            prisma.user.findUnique({ where: { id: auth.sub }, select: { password: true } }),
        ]);

        return NextResponse.json({
            success: true,
            data: { ...(settings ?? { enabled: false }), hasPassword: !!user?.password },
        });
    } catch (error) {
        console.error('[2FA settings] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}