import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { verifyOtp, generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';
import { getOtpDestination } from '@/lib/two-factor';

const MAX_SENDS = 4; // first code + 3 resends
const WINDOW_MS = 15 * 60 * 1000;

async function checkCode(userId: string, raw: string): Promise<boolean> {
    const code = raw.replace(/[\s-]/g, '').toUpperCase();

    if (/^\d{6}$/.test(code)) {
        const challenge = await prisma.twoFactorChallenge.findFirst({
            where: { userId, usedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (challenge && new Date() <= challenge.expiresAt && (await verifyOtp(code, challenge.codeHash))) {
            await prisma.twoFactorChallenge.update({
                where: { id: challenge.id },
                data: { usedAt: new Date() },
            });
            return true;
        }
        return false;
    }

    if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
        const backups = await prisma.twoFactorBackupCode.findMany({ where: { userId, usedAt: null } });
        for (const b of backups) {
            if (await verifyOtp(code, b.codeHash)) {
                await prisma.twoFactorBackupCode.update({
                    where: { id: b.id },
                    data: { usedAt: new Date() },
                });
                return true;
            }
        }
    }
    return false;
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json().catch(() => null)) as {
            password?: string;
            code?: string;
            sendCode?: boolean;
        } | null;

        const user = await prisma.user.findUnique({
            where: { id: auth.sub },
            select: { id: true, email: true, name: true, password: true },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const settings = await prisma.twoFactorSettings.findUnique({ where: { userId: auth.sub } });
        if (!settings?.enabled) {
            return NextResponse.json({ error: 'Two-step verification is not enabled' }, { status: 400 });
        }

        // Step A (Google-only accounts): email a confirmation code
        if (body?.sendCode) {
            const recent = await prisma.twoFactorChallenge.findMany({
                where: { userId: user.id, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            });
            if (recent.length >= MAX_SENDS) {
                return NextResponse.json(
                    { error: 'Too many codes requested. Please try again in 15 minutes.', remaining: 0 },
                    { status: 429 }
                );
            }
            if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30 * 1000) {
                return NextResponse.json(
                    { error: 'Please wait a few seconds before requesting another code.', remaining: MAX_SENDS - recent.length },
                    { status: 429 }
                );
            }

            const code = generateOtpCode(6);
            const codeHash = await hashOtp(code);
            const destination = getOtpDestination(settings);

            if (destination.type === 'email') {
                const sent = await sendEmail({
                    to: settings.recoveryEmail || user.email,
                    toName: user.name,
                    subject: 'Confirm turning off two-step verification',
                    htmlContent: `<p>Your code to turn off two-step verification is <strong>${code}</strong>. It expires in 10 minutes. If this wasn't you, ignore this email.</p>`,
                });
                if (!sent) {
                    return NextResponse.json({ error: 'Could not send the email. Please try again shortly.' }, { status: 502 });
                }
            } else {
                console.log('[2FA disable] SMS code to', destination.value, ':', code);
            }

            await prisma.$transaction([
                prisma.twoFactorChallenge.updateMany({
                    where: { userId: user.id, usedAt: null },
                    data: { usedAt: new Date() },
                }),
                prisma.twoFactorChallenge.create({
                    data: {
                        userId: user.id,
                        method: settings.method,
                        codeHash,
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    },
                }),
            ]);

            return NextResponse.json({ success: true, destination, remaining: MAX_SENDS - recent.length - 1 });
        }

        // Step B: confirm and disable
        if (user.password) {
            if (!body?.password || !(await verifyPassword(body.password, user.password))) {
                return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
            }
        } else {
            if (!body?.code || !(await checkCode(user.id, body.code))) {
                return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
            }
        }

        await prisma.$transaction([
            prisma.twoFactorSettings.update({ where: { userId: user.id }, data: { enabled: false } }),
            prisma.twoFactorBackupCode.deleteMany({ where: { userId: user.id } }),
            prisma.twoFactorChallenge.deleteMany({ where: { userId: user.id } }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[2FA disable] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}