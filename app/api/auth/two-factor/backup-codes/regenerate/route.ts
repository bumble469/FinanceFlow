import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { verifyOtp } from '@/lib/otp';
import { hashBackupCode, generateBackupCodes } from '@/lib/otp';

const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { password, code } = (await request.json()) as { password?: string; code?: string };

        const user = await prisma.user.findUnique({
            where: { id: auth.sub },
            select: { id: true, password: true },
        });
        if (!user || !user.password || !password || !(await verifyPassword(password, user.password))) {
            return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
        }

        const settings = await prisma.twoFactorSettings.findUnique({ where: { userId: auth.sub } });
        if (!settings?.enabled) {
            return NextResponse.json({ error: 'Two-step verification is not enabled' }, { status: 400 });
        }

        const challenge = await prisma.twoFactorChallenge.findFirst({
            where: { userId: auth.sub, usedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        let ok = false;
        if (challenge && new Date() <= challenge.expiresAt && code) {
            ok = await verifyOtp(code, challenge.codeHash);
            if (!ok) {
                const updated = await prisma.twoFactorChallenge.update({
                    where: { id: challenge.id },
                    data: { attempts: { increment: 1 } },
                });
                if (updated.attempts >= MAX_CODE_ATTEMPTS) {
                    // Invalidate the code so it cannot be guessed again
                    await prisma.twoFactorChallenge.update({
                        where: { id: challenge.id },
                        data: { expiresAt: new Date() },
                    });
                }
            }
        }
        if (!ok && code) {
            const backup = await prisma.twoFactorBackupCode.findFirst({
                where: { userId: auth.sub, usedAt: null },
            });
            if (backup && (await verifyOtp(code, backup.codeHash))) {
                ok = true;
                await prisma.twoFactorBackupCode.update({
                    where: { id: backup.id },
                    data: { usedAt: new Date() },
                });
            }
        }
        if (!ok) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        const backupCodes = generateBackupCodes(10);
        const hashed = await Promise.all(backupCodes.map((c) => hashBackupCode(c)));

        await prisma.$transaction([
            prisma.twoFactorBackupCode.deleteMany({ where: { userId: auth.sub } }),
            prisma.twoFactorBackupCode.createMany({
                data: hashed.map((hash) => ({ userId: auth.sub, codeHash: hash })),
            }),
        ]);

        return NextResponse.json({ success: true, backupCodes });
    } catch (error) {
        console.error('[2FA backup-codes] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}