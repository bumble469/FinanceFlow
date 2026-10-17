import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { recoveryEmail, recoveryPhone, password } = (await request.json()) as {
            recoveryEmail?: string | null;
            recoveryPhone?: string | null;
            password?: string;
        };

        const user = await prisma.user.findUnique({
            where: { id: auth.sub },
            select: { id: true, password: true },
        });
        if (!user || !user.password || !password || !(await verifyPassword(password, user.password))) {
            return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
        }

        const updated = await prisma.twoFactorSettings.update({
            where: { userId: auth.sub },
            data: {
                ...(recoveryEmail !== undefined ? { recoveryEmail } : {}),
                ...(recoveryPhone !== undefined ? { recoveryPhone } : {}),
            },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('[2FA recovery] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}