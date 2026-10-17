import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/plans', '/settings', '/connections', '/onboarding'];

export function middleware(request: NextRequest) {
    const pending2fa = request.cookies.get('pending_2fa')?.value;
    const path = request.nextUrl.pathname;

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