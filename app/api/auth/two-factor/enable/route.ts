import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { generateOtpCode, hashOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email';
import { checkIpRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

const COOLDOWN_MS = 30 * 1000;       // 30 s between sends
const MAX_SENDS_PER_WINDOW = 5;       // max 5 sends …
const WINDOW_MS = 30 * 1000;         // … in any 30-second window
const LOCKOUT_MS = 60 * 60 * 1000;   // 1-hour lockout after hitting the window limit
const OTP_TTL_MS = 10 * 60 * 1000;

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

        // IP limit first: cheapest rejection, before any DB work
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

        const existing = await prisma.twoFactorSettings.findUnique({ where: { userId: auth.sub } });
        if (existing?.enabled) {
            return NextResponse.json(
                { error: 'Two-step verification is already enabled. Disable it first to change your recovery contact.' },
                { status: 400 }
            );
        }

        // Per-user limits: 5 attempts in any 30-second window → 1-hour lockout.
        const windowCutoff = new Date(Date.now() - WINDOW_MS);
        const lockoutCutoff = new Date(Date.now() - LOCKOUT_MS);

        const recent = await prisma.twoFactorChallenge.findMany({
            where: { userId: auth.sub, createdAt: { gte: windowCutoff } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        // Check if a lockout burst (5 in 30 s) happened within the last hour
        const lastHour = await prisma.twoFactorChallenge.findMany({
            where: { userId: auth.sub, createdAt: { gte: lockoutCutoff } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        const isLockedOut = (() => {
            if (lastHour.length < MAX_SENDS_PER_WINDOW) return false;
            for (let i = 0; i <= lastHour.length - MAX_SENDS_PER_WINDOW; i++) {
                const oldest = lastHour[i + MAX_SENDS_PER_WINDOW - 1].createdAt.getTime();
                const newest = lastHour[i].createdAt.getTime();
                if (newest - oldest <= WINDOW_MS) return true;
            }
            return false;
        })();

        if (isLockedOut || recent.length >= MAX_SENDS_PER_WINDOW) {
            return NextResponse.json(
                { error: 'Too many attempts. Please come back after 1 hour.', remaining: 0, lockedOut: true },
                { status: 429 }
            );
        }
        if (recent[0] && Date.now() - recent[0].createdAt.getTime() < COOLDOWN_MS) {
            return NextResponse.json(
                { error: 'Please wait 30 seconds before requesting another code.', remaining: MAX_SENDS_PER_WINDOW - recent.length },
                { status: 429 }
            );
        }

        const code = generateOtpCode(6);
        const codeHash = await hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);

        // Record the request BEFORE sending so failures still count toward the limit
        const [, challenge] = await prisma.$transaction([
            prisma.twoFactorChallenge.updateMany({
                where: { userId: auth.sub, usedAt: null },
                data: { usedAt: new Date() },
            }),
            prisma.twoFactorChallenge.create({
                data: { userId: auth.sub, method, codeHash, expiresAt },
                select: { id: true },
            }),
        ]);

        let sent = false;
        if (method === 'EMAIL') {
            sent = await sendEmail({
                to: contact,
                subject: 'Confirm two-step verification setup',
                htmlContent: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
            });
        } else {
            // SMS only reaches here outside production
            console.log(`[2FA dev] SMS code for ${contact}: ${code}`);
            sent = true;
        }

        if (!sent) {
            // Keep the row (it still counts toward limits) but make it unusable
            await prisma.twoFactorChallenge.update({
                where: { id: challenge.id },
                data: { usedAt: new Date() },
            });
            return NextResponse.json(
                { error: 'Could not send the email. Check the address and try again.' },
                { status: 502 }
            );
        }

        await prisma.twoFactorSettings.upsert({
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
        });

        return NextResponse.json({ success: true, remaining: MAX_SENDS_PER_WINDOW - recent.length - 1 });
    } catch (error) {
        console.error('[2FA enable] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}