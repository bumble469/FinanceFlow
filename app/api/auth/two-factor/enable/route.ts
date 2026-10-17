import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_SENDS = 4;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUser();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json().catch(() => null)) as {
            method?: string;
            contact?: string;
        } | null;

        const method = body?.method;
        const rawContact = typeof body?.contact === 'string' ? body.contact.trim() : '';

        if (method !== 'EMAIL' && method !== 'SMS') {
            return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
        }
        if (!rawContact) {
            return NextResponse.json({ error: 'Method and contact are required' }, { status: 400 });
        }

        const contact =
            method === 'EMAIL' ? rawContact.toLowerCase() : rawContact.replace(/[\s()-]/g, '');

        if (method === 'EMAIL' && !EMAIL_RE.test(contact)) {
            return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
        }
        if (method === 'SMS' && !PHONE_RE.test(contact)) {
            return NextResponse.json(
                { error: 'Enter a phone number with country code, e.g. +15550000000' },
                { status: 400 }
            );
        }

        if (method === 'SMS' && process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'SMS verification is not available yet' }, { status: 501 });
        }

        const existing = await prisma.twoFactorSettings.findUnique({ where: { userId: auth.sub } });

        if (existing?.enabled) {
            return NextResponse.json(
                { error: 'Two-step verification is already enabled. Disable it first to change your recovery contact.' },
                { status: 400 }
            );
        }

        const recent = await prisma.twoFactorChallenge.findMany({
            where: { userId: auth.sub, createdAt: { gte: new Date(Date.now() - RESEND_WINDOW_MS) } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        if (recent.length >= MAX_SENDS) {
            return NextResponse.json(
                { error: 'Too many codes requested. Please try again in 15 minutes.', remaining: 0 },
                { status: 429 }
            );
        }
        if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
            return NextResponse.json(
                { error: 'Please wait a few seconds before requesting another code.', remaining: MAX_SENDS - recent.length },
                { status: 429 }
            );
        }

        const code = generateOtpCode(6);
        const codeHash = await hashOtp(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const sent = await sendEmail({
            to: contact,
            subject: 'Confirm two-step verification setup',
            htmlContent: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
        });
        if (!sent) {
            return NextResponse.json({ error: 'Could not send the email. Check the address and try again.' }, { status: 502 });
        }

        await prisma.$transaction([
            prisma.twoFactorChallenge.updateMany({
                where: { userId: auth.sub, usedAt: null },
                data: { usedAt: new Date() },
            }),
            prisma.twoFactorChallenge.create({
                data: { userId: auth.sub, method, codeHash, expiresAt },
            }),
            prisma.twoFactorSettings.upsert({
                where: { userId: auth.sub },
                create: {
                    userId: auth.sub,
                    enabled: false,
                    method,
                    recoveryEmail: method === 'EMAIL' ? contact : null,
                    recoveryPhone: method === 'SMS' ? contact : null,
                },
                update: {
                    method,
                    recoveryEmail: method === 'EMAIL' ? contact : existing?.recoveryEmail,
                    recoveryPhone: method === 'SMS' ? contact : existing?.recoveryPhone,
                },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[2FA enable] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
