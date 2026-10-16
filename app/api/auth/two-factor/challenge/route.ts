import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyTwoFactorPendingToken } from '@/lib/jwt';
import { generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';
import { getOtpDestination } from '@/lib/two-factor';
const MAX_SENDS = 4;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

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

        const settings = await prisma.twoFactorSettings.findUnique({ where: { userId } });
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });
        if (!settings || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const recent = await prisma.twoFactorChallenge.findMany({
            where: { userId, createdAt: { gte: new Date(Date.now() - RESEND_WINDOW_MS) } },
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
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const destination = getOtpDestination(settings);

        if (destination.type === 'email') {
            const sent = await sendEmail({
                to: settings.recoveryEmail || user.email,
                toName: user.name,
                subject: 'Your FinanceFlow verification code',
                htmlContent: `<p>Hi ${user.name || 'there'},</p><p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
            });
            if (!sent) {
                return NextResponse.json({ error: 'Could not send the email. Please try again shortly.' }, { status: 502 });
            }
        } else {
            console.log('[2FA] SMS code to', destination.value, ':', code);
        }

        await prisma.$transaction([
            prisma.twoFactorChallenge.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
            prisma.twoFactorChallenge.create({ data: { userId, method: settings.method, codeHash, expiresAt } }),
        ]);

        return NextResponse.json({
            success: true,
            destination,
            expiresIn: 600,
            remaining: MAX_SENDS - recent.length - 1,
        });
    } catch (error) {
        console.error('[2FA challenge] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}