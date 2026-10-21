import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
    verifyTwoFactorPendingToken,
    generateAccessToken,
    generateRefreshToken,
    REFRESH_TOKEN_TTL,
} from '@/lib/jwt';
import { verifyOtp } from '@/lib/otp';

export async function POST(request: NextRequest) {
    try {
        const pendingToken = (await cookies()).get('pending_2fa')?.value;
        if (!pendingToken) {
            return NextResponse.json({ error: 'No pending 2FA session' }, { status: 401 });
        }
        const pending = await verifyTwoFactorPendingToken(pendingToken);
        if (!pending) {
            return NextResponse.json({ error: 'Invalid or expired 2FA session' }, { status: 401 });
        }
        const userId = pending.sub;

        const body = (await request.json().catch(() => null)) as { code?: string } | null;
        const code =
            typeof body?.code === 'string' ? body.code.replace(/[\s-]/g, '').toUpperCase() : '';
        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                twoFactor: { select: { enabled: true } },
            },
        });
        if (!user || !user.twoFactor?.enabled) {
            return NextResponse.json({ error: 'Invalid 2FA session' }, { status: 401 });
        }

        let verified = false;

        if (/^\d{6}$/.test(code)) {
            const challenge = await prisma.twoFactorChallenge.findFirst({
                where: { userId, usedAt: null },
                orderBy: { createdAt: 'desc' },
            })
            if (challenge && new Date() <= challenge.expiresAt) {
                const valid = await verifyOtp(code, challenge.codeHash)
                if (valid) {
                    await prisma.twoFactorChallenge.update({
                        where: { id: challenge.id },
                        data: { usedAt: new Date() },
                    })
                    verified = true
                } else {
                    await prisma.twoFactorChallenge.update({
                        where: { id: challenge.id },
                        data: { attempts: { increment: 1 } },
                    })
                    const updated = await prisma.twoFactorChallenge.findUnique({ where: { id: challenge.id } })
                    if (updated && updated.attempts >= 5) {
                        await prisma.twoFactorChallenge.update({
                            where: { id: challenge.id },
                            data: { expiresAt: new Date() },
                        })
                    }
                }
            }
        }
        else if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
            const backups = await prisma.twoFactorBackupCode.findMany({
                where: { userId, usedAt: null },
            });
            for (const b of backups) {
                if (await verifyOtp(code, b.codeHash)) {
                    await prisma.twoFactorBackupCode.update({
                        where: { id: b.id },
                        data: { usedAt: new Date() },
                    });
                    verified = true;
                    break;
                }
            }
        }

        if (!verified) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

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
        const response = NextResponse.json({ success: true });
        response.cookies.set({ name: 'access_token', value: accessToken, httpOnly: true, sameSite: 'lax', secure, maxAge: 15 * 60, path: '/' });
        response.cookies.set({ name: 'refresh_token', value: refreshToken, httpOnly: true, sameSite: 'lax', secure, maxAge: REFRESH_TOKEN_TTL / 1000, path: '/' });
        response.cookies.set({ name: 'pending_2fa', value: '', httpOnly: true, sameSite: 'lax', secure, maxAge: 0, path: '/' });
        return response;
    } catch (error) {
        console.error('[2FA verify] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}