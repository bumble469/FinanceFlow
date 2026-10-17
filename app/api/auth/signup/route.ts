import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AccountType } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { generateEmailVerifyPendingToken } from '@/lib/jwt';

const prisma = new PrismaClient();

interface SignupRequestBody {
  email: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  accountName?: string;
  accountType?: AccountType;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupRequestBody;
    const errors: Record<string, string> = {};

    const email = body.email?.toLowerCase().trim();

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format';
    }

    if (!body.password) {
      errors.password = 'Password is required';
    } else {
      const validation = validatePasswordStrength(body.password);
      if (!validation.valid) {
        errors.password = validation.errors.join('; ');
      }
      if (body.password !== body.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    if (body.name && body.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', errors },
        { status: 400 }
      );
    }

        const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (existingUser?.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already registered',
          errors: { email: 'This email is already in use' },
        },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(body.password!);
    const accountType =
      (body.accountType?.toUpperCase() as AccountType) || AccountType.INDIVIDUAL;

    let userId: string;

    if (existingUser) {
      // An earlier signup was never verified: let them start over with the new details
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword, name: body.name?.trim() || null },
      });
      await prisma.account.updateMany({
        where: { userId: existingUser.id },
        data: { name: body.accountName || 'My Account', type: accountType },
      });
      userId = existingUser.id;
    } else {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: body.name?.trim() || null,
          role: 'user',
          // emailVerified stays null until the code is confirmed
        },
        select: { id: true },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          name: body.accountName || 'My Account',
          type: accountType,
        },
      });
      userId = user.id;
    }

    const pendingToken = await generateEmailVerifyPendingToken(userId);

    const response = NextResponse.json(
      { success: true, requiresVerification: true, email },
      { status: 201 }
    );
    response.cookies.set({
      name: 'pending_verify',
      value: pendingToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60,
      path: '/',
    });
    return response;
    
  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error'+error },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null
  );
}
