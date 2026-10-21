import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyTwoFactorPendingToken } from '@/lib/jwt';
import { generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';
import { getOtpDestination } from '@/lib/two-factor';
import { getClientIp } from '@/lib/utils';
import { checkIpRateLimit } from '@/lib/rate-limit';

const COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
    try {
        const pendingToken = (await cookies()).get('pending_2fa')?.value;
        if (!pendingToken) {
            return NextResponse.json({ error: 'No pending 2FA session' }, { status: 401 });
        }

        const payload = await verifyTwoFactorPendingToken(pendingToken);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired 2FA session' }, { status: 401 });
        }

        const userId = payload.sub;

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

        const [settings, user] = await Promise.all([
            prisma.twoFactorSettings.findUnique({ where: { userId } }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true },
            }),
        ]);
        if (!settings || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const destination = getOtpDestination(settings);
        if (destination.type !== 'email' && process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'SMS verification is not available yet' }, { status: 501 });
        }

        const recent = await prisma.twoFactorChallenge.findMany({
            where: { userId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
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
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);

        const [, challenge] = await prisma.$transaction([
            prisma.twoFactorChallenge.updateMany({
                where: { userId, usedAt: null },
                data: { usedAt: new Date() },
            }),
            prisma.twoFactorChallenge.create({
                data: { userId, method: settings.method, codeHash, expiresAt },
                select: { id: true },
            }),
        ]);

        let sent = false;
        if (destination.type === 'email') {
            sent = await sendEmail({
                to: settings.recoveryEmail || user.email,
                toName: user.name,
                subject: 'Your FinanceFlow verification code',
                htmlContent: `<p>Hi ${user.name || 'there'},</p><p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
            });
        } else {
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
            expiresIn: OTP_TTL_MS / 1000,
            remaining: MAX_SENDS_PER_HOUR - recent.length - 1,
        });
    } catch (error) {
        console.error('[2FA challenge] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}