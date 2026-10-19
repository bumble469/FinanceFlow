import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AccountType } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTwoFactorPendingToken,
  REFRESH_TOKEN_TTL,
} from '@/lib/jwt';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.id_token) {
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve id_token' },
        { status: 401 }
      );
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokenData.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid Google payload' },
        { status: 401 }
      );
    }
    if (!payload.email_verified) {
      return NextResponse.json(
        { success: false, error: 'Google email is not verified' },
        { status: 401 }
      );
    }
    const providerAccountId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || null;
    const image = payload.picture || null;

    // 3️⃣ Check existing OAuthAccount
    let oauthAccount = await prisma.oAuthAccount.findFirst({
      where: {
        provider: 'google',
        providerAccountId,
      },
      include: { user: true },
    });

    let user;
    let isNewUser = false;

    if (oauthAccount) {
      user = oauthAccount.user;
    } else {
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user && !user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date(), password: null },
        });
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            image,
            emailVerified: new Date(),
            role: 'user',
          },
        });

        await prisma.account.create({
          data: {
            userId: user.id,
            name: name ? `${name}'s Account` : 'My Account',
            type: AccountType.INDIVIDUAL,
          },
        });

        isNewUser = true;
      }

      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerAccountId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_at,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          id_token: tokenData.id_token,
        },
      });
    }
    const twoFactor = await prisma.twoFactorSettings.findUnique({
      where: { userId: user.id },
    });

    if (twoFactor?.enabled) {
      const pendingToken = await generateTwoFactorPendingToken(user.id);
      const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/two-factor/verify`);
      res.cookies.set({
        name: 'pending_2fa',
        value: pendingToken,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60,
        path: '/',
      });
      return res;
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
      },
    });

    const refreshToken = await generateRefreshToken(
      user.id,
      refreshTokenRecord.id
    );

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${isNewUser ? '/onboarding/plan' : '/'}`
    );

    response.cookies.set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_TTL / 1000,
      path: '/',
    });

    // response.cookies.set({
    //   name: 'access_token',
    //   value: accessToken,
    //   httpOnly: true,
    //   sameSite: 'lax',
    //   secure: process.env.NODE_ENV === 'production',
    //   maxAge: 1 * 60,
    //   path: '/',
    // });

    return response;
  } catch (error) {
    console.error('[Google OAuth Callback] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Google authentication failed' },
      { status: 500 }
    );
  }
}