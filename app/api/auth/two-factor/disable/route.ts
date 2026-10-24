import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { verifyOtp, generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';
import { getOtpDestination } from '@/lib/two-factor';
import { getClientIp } from '@/lib/utils';
import { checkIpRateLimit } from '@/lib/rate-limit';
import { reserveTwoFactorAttempt } from '@/lib/code-attempts';
import { backupCodeLimiter, isBlocked, recordFailure } from '@/lib/limiters';

const COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

async function checkCode(userId: string, raw: string): Promise<boolean> {
    const code = raw.replace(/[\s-]/g, '').toUpperCase()

    if (/^\d{6}$/.test(code)) {
        const challenge = await prisma.twoFactorChallenge.findFirst({
            where: { userId, usedAt: null },
            orderBy: { createdAt: 'desc' },
        })
        if (challenge && new Date() <= challenge.expiresAt) {
            if (!(await reserveTwoFactorAttempt(challenge.id))) return false
            if (await verifyOtp(code, challenge.codeHash)) {
                await prisma.twoFactorChallenge.update({
                    where: { id: challenge.id },
                    data: { usedAt: new Date() },
                })
                return true
            }
        }
        return false
    }

    if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
        if (await isBlocked(backupCodeLimiter, userId)) return false
        const backups = await prisma.twoFactorBackupCode.findMany({ where: { userId, usedAt: null } })
        for (const b of backups) {
            if (await verifyOtp(code, b.codeHash)) {
                await prisma.twoFactorBackupCode.update({
                    where: { id: b.id },
                    data: { usedAt: new Date() },
                })
                return true
            }
        }
        await recordFailure(backupCodeLimiter, userId)
    }
    return false
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // IP limit first, for both sending codes and confirming (throttles password/code guessing)
        const ip = getClientIp(request);
        if (ip) {
            const ipLimit = await checkIpRateLimit(ip);
            if (!ipLimit.allowed) {
                return NextResponse.json(
                    { error: 'Too many requests from this IP. Please try again later.', remaining: 0 },
                    { status: 429 }
                );
            }
        }

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

        if (body?.sendCode) {
            const destination = getOtpDestination(settings);
            if (destination.type !== 'email' && process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'SMS verification is not available yet' }, { status: 501 });
            }

            // Failed sends are also recorded as challenges, so they count toward the limit
            const recent = await prisma.twoFactorChallenge.findMany({
                where: { userId: user.id, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            });
            if (recent.length >= MAX_SENDS_PER_HOUR) {
                return NextResponse.json(
                    { error: 'Too many codes requested. Please try again later.', remaining: 0 },
                    { status: 429 }
                );
            }
            if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS) {
                return NextResponse.json(
                    { error: 'Please wait before requesting another code.', remaining: MAX_SENDS_PER_HOUR - recent.length },
                    { status: 429 }
                );
            }

            const code = generateOtpCode(6);
            const codeHash = await hashOtp(code);

            // Record the request BEFORE sending so failures still count
            const [, challenge] = await prisma.$transaction([
                prisma.twoFactorChallenge.updateMany({
                    where: { userId: user.id, usedAt: null },
                    data: { usedAt: new Date() },
                }),
                prisma.twoFactorChallenge.create({
                    data: {
                        userId: user.id,
                        method: settings.method,
                        codeHash,
                        expiresAt: new Date(Date.now() + OTP_TTL_MS),
                    },
                    select: { id: true },
                }),
            ]);

            let sent = false;
            if (destination.type === 'email') {
                sent = await sendEmail({
                    to: settings.recoveryEmail || user.email,
                    toName: user.name,
                    subject: 'Confirm turning off two-step verification',
                    htmlContent: `<p>Your code to turn off two-step verification is <strong>${code}</strong>. It expires in 10 minutes. If this wasn't you, ignore this email.</p>`,
                });
            } else {
                // SMS only reaches here outside production
                console.log('[2FA dev] SMS code to', destination.value, ':', code);
                sent = true;
            }

            if (!sent) {
                await prisma.twoFactorChallenge.update({
                    where: { id: challenge.id },
                    data: { usedAt: new Date() },
                });
                return NextResponse.json(
                    { error: 'Could not send the email. Please try again shortly.' },
                    { status: 502 }
                );
            }

            return NextResponse.json({
                success: true,
                destination,
                remaining: MAX_SENDS_PER_HOUR - recent.length - 1,
            });
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
            // Don't delete challenges: those rows are the rate-limit history. Just invalidate them.
            prisma.twoFactorChallenge.updateMany({
                where: { userId: user.id, usedAt: null },
                data: { usedAt: new Date() },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[2FA disable] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}