import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authLimiter } from '@/lib/limiters';

const protectedPrefixes = ['/plans', '/settings', '/connections', '/onboarding'];

const strictPrefixes = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/verify-email',
    '/api/auth/two-factor',
    '/api/settings/password',
];

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    if (strictPrefixes.some((p) => path.startsWith(p))) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        try {
            const { success, reset } = await authLimiter.limit(ip);
            if (!success) {
                return NextResponse.json(
                    { error: 'Too many requests. Please slow down.' },
                    {
                        status: 429,
                        headers: { 'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) },
                    }
                );
            }
        } catch (e) {
            console.error('[middleware rate limit]', e); // fail open if Redis is unreachable
        }
    }

    const pending2fa = request.cookies.get('pending_2fa')?.value;

    const twoFactorPaths = ['/two-factor', '/api/auth/two-factor'];
    const isTwoFactorRoute = twoFactorPaths.some((p) => path.startsWith(p));

    if (pending2fa && !isTwoFactorRoute) {
        return NextResponse.redirect(new URL('/two-factor/verify', request.url));
    }

    const isProtected = protectedPrefixes.some(
        (p) => path === p || path.startsWith(p + '/')
    );

    if (isProtected) {
        const hasSession =
            request.cookies.get('access_token')?.value ||
            request.cookies.get('refresh_token')?.value;

        if (!hasSession) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};