import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { verifyOtp } from '@/lib/otp';
import { hashBackupCode, generateBackupCodes } from '@/lib/otp';
import { reserveTwoFactorAttempt } from '@/lib/code-attempts';
import { backupCodeLimiter, isBlocked, recordFailure } from '@/lib/limiters';

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
        const cleaned = typeof code === 'string' ? code.replace(/[\s-]/g, '').toUpperCase() : '';
        let ok = false;

        if (/^\d{6}$/.test(cleaned)) {
            if (challenge && new Date() <= challenge.expiresAt) {
                if (!(await reserveTwoFactorAttempt(challenge.id))) {
                    return NextResponse.json(
                        { error: 'Too many incorrect attempts. Request a new code.' },
                        { status: 429 }
                    );
                }
                if (await verifyOtp(cleaned, challenge.codeHash)) {
                    ok = true;
                    await prisma.twoFactorChallenge.update({
                        where: { id: challenge.id },
                        data: { usedAt: new Date() },
                    });
                }
            }
        } else if (/^[A-HJ-NP-Z2-9]{8}$/.test(cleaned)) {
            if (await isBlocked(backupCodeLimiter, auth.sub)) {
                return NextResponse.json(
                    { error: 'Too many incorrect backup codes. Try again later.' },
                    { status: 429 }
                );
            }
            const backups = await prisma.twoFactorBackupCode.findMany({
                where: { userId: auth.sub, usedAt: null },
            });
            for (const b of backups) {
                if (await verifyOtp(cleaned, b.codeHash)) {
                    ok = true;
                    await prisma.twoFactorBackupCode.update({
                        where: { id: b.id },
                        data: { usedAt: new Date() },
                    });
                    break;
                }
            }
            if (!ok) await recordFailure(backupCodeLimiter, auth.sub);
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