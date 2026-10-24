import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyOtp, hashBackupCode, generateBackupCodes } from '@/lib/otp';
import { reserveTwoFactorAttempt } from '@/lib/code-attempts';

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { code?: string } | null;
        const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        const challenge = await prisma.twoFactorChallenge.findFirst({
            where: { userId: auth.sub, usedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (!challenge || new Date() > challenge.expiresAt) {
            return NextResponse.json({ error: 'No valid verification code. Request a new one.' }, { status: 400 });
        }

        if (!(await reserveTwoFactorAttempt(challenge.id))) {
            return NextResponse.json(
                { error: 'Too many incorrect attempts. Request a new code.' },
                { status: 429 }
            );
        }
        if (!(await verifyOtp(code, challenge.codeHash))) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        const backupCodes = generateBackupCodes(10);
        const hashed = await Promise.all(backupCodes.map((c) => hashBackupCode(c)));

        await prisma.$transaction([
            prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } }),
            prisma.twoFactorSettings.update({ where: { userId: auth.sub }, data: { enabled: true } }),
            prisma.twoFactorBackupCode.createMany({
                data: hashed.map((hash) => ({ userId: auth.sub, codeHash: hash })),
            }),
        ]);

        return NextResponse.json({ success: true, backupCodes });
    } catch (error) {
        console.error('[2FA verify-setup] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}