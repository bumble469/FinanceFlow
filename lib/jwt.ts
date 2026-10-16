import * as jose from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET
);

const JWT_REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET
);

export const ACCESS_TOKEN_TTL = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;
export const TWO_FA_PENDING_TTL = 5 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  name?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}


export async function generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>) {
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  return token;
}

export async function generateRefreshToken(userId: string, tokenId: string) {
  const token = await new jose.SignJWT({ sub: userId, tokenId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET);

  return token;
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name:
        typeof payload.name === 'string'
          ? payload.name
          : undefined,
    };
  } catch (error) {
    console.error('[JWT] Access token verification failed:', error);
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_REFRESH_SECRET);

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.tokenId !== 'string'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      tokenId: payload.tokenId,
    };
  } catch (error) {
    console.error('[JWT] Refresh token verification failed:', error);
    return null;
  }
}

export async function setRefreshTokenCookie(token: string, expiresIn: number) {
  const cookieStore = await cookies();
  cookieStore.set('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: expiresIn / 1000,
    path: '/',
  });
}

export async function clearAccessTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set('access_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function clearRefreshTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set('refresh_token', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function getRefreshTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('refresh_token')?.value || null;
}

export async function decodeToken(token: string) {
  try {
    return jose.decodeJwt(token);
  } catch (error) {
    console.error('[JWT] Token decode failed:', error);
    return null;
  }
}

export async function generateTwoFactorPendingToken(userId: string) {
  const token = await new jose.SignJWT({ sub: userId, purpose: '2fa' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET);
  return token;
}

export async function verifyTwoFactorPendingToken(
  token: string
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    if (payload.sub && payload.purpose === '2fa') {
      return { sub: String(payload.sub) };
    }
    return null;
  } catch (error) {
    console.error('[JWT] Two-factor pending token verification failed:', error);
    return null;
  }
}

export async function clearPendingTwoFactorCookie() {
  const cookieStore = await cookies();
  cookieStore.set('pending_2fa', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}
